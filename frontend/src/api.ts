import axios from 'axios';

const getDynamicApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:3010`;
  }
  return 'http://localhost:3010';
};

const API_URL = typeof (import.meta as any).env?.VITE_API_URL === 'string' 
  ? (import.meta as any).env.VITE_API_URL 
  : getDynamicApiUrl();

export const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Interceptor Requêtes ──────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  // 1. Token JWT (si disponible dans localStorage)
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // 2. Header multi-tenant X-Tenant-ID
  //    Règle de sécurité : on n'émet JAMAIS un header X-Tenant-ID dégradé (null,
  //    undefined, 'legacy', chaîne vide). Si le sous-domaine tenant est absent et
  //    que l'utilisateur est authentifié, on force une redirection vers /login pour
  //    qu'il se reconnecte — plutôt que d'envoyer une requête sans contexte tenant
  //    qui provoquerait un accès non filtré (fail-open).
  const tenantSubdomain = localStorage.getItem('tenant_subdomain');
  const isValidTenant =
    tenantSubdomain &&
    tenantSubdomain !== 'null' &&
    tenantSubdomain !== 'undefined' &&
    tenantSubdomain !== 'legacy' &&
    tenantSubdomain.trim() !== '';

  if (isValidTenant) {
    config.headers['X-Tenant-ID'] = tenantSubdomain;
  } else if (token) {
    // Utilisateur authentifié (a un token JWT) mais sans contexte tenant valide
    // → redirection forcée vers le login pour éviter une requête dégradée
    const isAuthOrPublicRoute =
      config.url?.includes('/auth/') ||
      config.url?.includes('/tenants/plans') ||
      config.url?.includes('/admin-tenants');

    if (!isAuthOrPublicRoute) {
      // Annuler la requête proprement
      const controller = new AbortController();
      controller.abort('Contexte tenant absent — reconnexion requise');
      config.signal = controller.signal;

      // Rediriger vers le login (avec délai minimal pour laisser la requête s'annuler)
      setTimeout(() => {
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          window.location.href = '/login';
        }
      }, 100);
    }
    // Si c'est une route publique ou admin, on laisse passer sans header X-Tenant-ID
  }
  // Si pas de token ET pas de sous-domaine : route publique, rien à faire

  // 3. Conversion automatique des dates YYYY-MM-DD → ISO-8601 pour Prisma
  if (config.data && typeof config.data === 'object') {
    const convertDates = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj[key])) {
          try {
            obj[key] = new Date(obj[key]).toISOString();
          } catch (e) {
            // ignore invalid dates
          }
        } else if (
          typeof obj[key] === 'string' &&
          obj[key] === '' &&
          key.toLowerCase().includes('date')
        ) {
          obj[key] = null;
        } else if (typeof obj[key] === 'object') {
          convertDates(obj[key]);
        }
      }
    };
    convertDates(config.data);
  }

  return config;
});

// ── Interceptor Réponses ──────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isSuperAdminRequest = error.config?.url?.includes('/admin-tenants');
    
    // Token expiré ou invalide (401), ou accès refusé à la console SaaS (403)
    if (error.response?.status === 401 || (error.response?.status === 403 && isSuperAdminRequest)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('tenant_subdomain');
      localStorage.removeItem('currentUser');
      
      // Rediriger vers la page de login si on est dans l'app
      if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Utilitaire pour initialiser la session après un login réussi.
 * Stocke le token JWT et le sous-domaine tenant dans localStorage (persistant).
 */
export function initSession(accessToken: string, tenantSubdomain?: string) {
  localStorage.setItem('access_token', accessToken);
  if (tenantSubdomain) {
    localStorage.setItem('tenant_subdomain', tenantSubdomain);
  }
}

/**
 * Utilitaire pour effacer la session (logout).
 */
export function clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('tenant_subdomain');
}
