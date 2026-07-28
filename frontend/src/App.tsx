import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import { api, initSession, clearSession } from './api';
import PasswordStrengthIndicator, { isPasswordValid } from './components/PasswordStrengthIndicator';

// Import all 19 Views
import { DashboardView } from './components/DashboardView';
import { AssetView } from './components/AssetView';
import { UserView } from './components/UserView';
import { TicketView } from './components/TicketView';
import { LicenseView } from './components/LicenseView';
import { OnboardingView } from './components/OnboardingView';
import { MaintenanceView } from './components/MaintenanceView';
import { SlaView } from './components/SlaView';
import { MovementView } from './components/MovementView';
import { StockView } from './components/StockView';
import { PurchaseView } from './components/PurchaseView';
import { ContractView } from './components/ContractView';
import { SaleView } from './components/SaleView';
import { AuditView } from './components/AuditView';
import { BackupView } from './components/BackupView';
import { KbView } from './components/KbView';
import { GuideView } from './components/GuideView';
import { AboutView } from './components/AboutView';
import { SettingsView } from './components/SettingsView';
import { TenantSettingsView } from './components/TenantSettingsView';
import { DepreciationView } from './components/DepreciationView';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { SupportPerformanceView } from './components/SupportPerformanceView';
import { TenantInvoiceView } from './components/TenantInvoiceView';
import { applyTenantTheme, applyThemeFromCache } from './themeUtils';
// Multi-tenant views
import { SignupView } from './components/SignupView';
import { PricingView } from './components/PricingView';
import { SubscriptionView } from './components/SubscriptionView';
import { SuperAdminView } from './components/SuperAdminView';
import { RecoveryFlow } from './components/RecoveryFlow';
import { SuperAdminRecoveryFlow } from './components/SuperAdminRecoveryFlow';
import { AppLandingView } from './components/AppLandingView';
import { LeavesView } from './components/LeavesView';
import { DgiInvoicesView } from './components/DgiInvoicesView';
import { TreasuryView } from './components/TreasuryView';

interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  systemRole?: string;
  mfaEnabled?: boolean;
  tenantId?: string;        // ← Multi-tenant
  tenantSubdomain?: string; // ← Pour le header X-Tenant-ID
  phone?: string;
  country?: string;
  position?: string;
}

function App() {
  // Appliquer immédiatement le thème depuis le cache localStorage (avant tout appel API).
  // Cela évite le "flash" vert lors du rechargement de page ou de la reconnexion.
  // L'appel est synchrone et se termine en <1ms.
  applyThemeFromCache();

  // Authentication & Session States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [tempUser, setTempUser] = useState<UserSession | null>(null);
  const [tempToken, setTempToken] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginSubdomain, setLoginSubdomain] = useState(''); // ← champ subdomain tenant
  const [loginError, setLoginError] = useState('');
  const [enteredPassword, setEnteredPassword] = useState(''); // Keep track for first login check

  const [publicRoute, setPublicRoute] = useState<'landing' | 'login' | 'signup' | 'pricing' | 'recovery' | 'superadmin-recovery' | 'privacy'>(() => {
    // 1. Check for ?skip=true in URL parameter
    const params = new URLSearchParams(window.location.search);
    if (params.get('skip') === 'true') {
      localStorage.setItem('hasSeenLandingScreen', 'true');
      return 'login';
    }

    // 2. Check if already authenticated (has active token or session)
    const token = localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('currentUser');
    if (token) {
      return 'login'; // Let session check hook handle auto-login
    }

    // 3. Check if they have already seen the landing screen
    const hasSeen = localStorage.getItem('hasSeenLandingScreen') === 'true';
    if (hasSeen) {
      return 'login';
    }

    return 'landing';
  });

  // Security Steps
  const [showMfa, setShowMfa] = useState<boolean>(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  
  const [showForcePassword, setShowForcePassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forcePasswordError, setForcePasswordError] = useState('');

  const [showProfileCompletion, setShowProfileCompletion] = useState<boolean>(false);
  const [profPhone, setProfPhone] = useState('');
  const [profCountry, setProfCountry] = useState('');
  const [profPosition, setProfPosition] = useState('');
  const [profError, setProfError] = useState('');

  // UI States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);

  // ── Alertes Maintenance Helpdesk ──────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<any[]>([]);
  const [sendingTicket, setSendingTicket] = useState<string | null>(null);
  const [ticketSent, setTicketSent] = useState<Set<string>>(new Set());

  // Subscription lifecycle states
  const [tenantStatus, setTenantStatus] = useState<string>('ACTIVE');
  const [tenantName, setTenantName] = useState<string>('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('ACTIVE');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
  const [trialCountdownStr, setTrialCountdownStr] = useState<string>('');

  const fetchMaintenanceAlerts = useCallback(async () => {
    try {
      const res = await api.get('/maintenances');
      const list: any[] = res.data || [];
      const now = new Date(); now.setHours(0,0,0,0);
      const urgent = list
        .filter(m => m.status !== 'Terminée')
        .map(m => {
          const target = m.nextDate || m.date;
          if (!target) return null;
          const d = new Date(target); d.setHours(0,0,0,0);
          const days = Math.round((d.getTime() - now.getTime()) / 86400000);
          const threshold = m.alertDaysBefore ?? 7;
          if (days > threshold) return null;
          let level = 'soon', label = `Dans ${days} j`, color = '#f97316';
          if (days < 0)  { level = 'overdue'; label = `En retard ${Math.abs(days)} j`; color = '#ef4444'; }
          if (days === 0){ level = 'today';   label = "Aujourd'hui !";              color = '#ef4444'; }
          return { ...m, _days: days, _level: level, _label: label, _color: color, _target: target };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a._days - b._days);
      setMaintenanceAlerts(urgent);
    } catch { /* API indisponible, pas d'alertes */ }
  }, []);

  const createHelpdeskTicket = async (alert: any) => {
    setSendingTicket(alert.id);
    const targetDate = new Date(alert._target).toLocaleDateString('fr-FR');
    const priorityMap: Record<string,string> = { Critique: 'CRITICAL', Haute: 'HIGH', Normale: 'MEDIUM', Basse: 'LOW' };
    try {
      await api.post('/tickets', {
        title: `🔧 [MAINTENANCE] ${alert.type} — ${alert.assetCode}`,
        description: `⚠️ Alerte maintenance (${alert._label}) — Date prévue : ${targetDate}\n\n📋 Équipement : ${alert.assetCode}\n🔧 Type : ${alert.type} (${alert.periodicite || 'Unique'})\n👷 Technicien : ${alert.technicien || 'Non assigné'}\n\n📝 Travaux : ${alert.description}\n\nCe ticket a été généré automatiquement par le système d'alertes KPSyDesk ITAM.`,
        status: 'OPEN',
        priority: priorityMap[alert.priority] || 'HIGH',
      });
      setTicketSent(prev => new Set(prev).add(alert.id));
    } catch (err: any) {
      alert('Erreur création ticket : ' + (err.response?.data?.message || err.message));
    } finally {
      setSendingTicket(null);
    }
  };

  // Check existing session
  useEffect(() => {
    const session = localStorage.getItem('currentUser');
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (session) {
      const parsedUser = JSON.parse(session);
      setCurrentUser(parsedUser);
      setIsAuthenticated(true);
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Restaurer le header X-Tenant-ID depuis localStorage (ou fallback sur legacy si manquant ou invalide)
        let subdomain = localStorage.getItem('tenant_subdomain');
        if (!subdomain || subdomain === 'undefined' || subdomain === 'null') {
          subdomain = 'legacy';
          localStorage.setItem('tenant_subdomain', 'legacy');
        }
        api.defaults.headers.common['X-Tenant-ID'] = subdomain;
      }
    }
  }, []);

  // Pointer automatiquement sur la Console SaaS si l'utilisateur est un collaborateur SaaS (SuperAdmin, Finance, Support)
  useEffect(() => {
    const isSaaSCollaborator = currentUser && (
      currentUser.email?.toLowerCase() === 'admin@entreprise.com' ||
      (['SuperAdmin', 'Finance', 'Support'].includes(currentUser.systemRole || '') && !currentUser.tenantId)
    );

    if (isSaaSCollaborator) {
      setActiveTab('superadmin');
      // Activer toutes les fonctionnalités pour le dashboard de la console
      setTenantFeatures({
        helpdesk: true,
        financial: true,
        agent: true,
        kb: true,
        onboarding: true,
        depreciation: true,
        hr: true,
        dgi: true,
      });
    } else if (currentUser && isAuthenticated) {
      // Charger les fonctionnalités de l'abonné connecté
      api.get('/tenants/me')
        .then(res => {
          const feats = res.data.subscription?.featuresIncluded || {};
          setTenantFeatures(feats);
          if (res.data.tenant) {
            setTenantStatus(res.data.tenant.status);
            setTenantName(res.data.tenant.name || '');
            // Appliquer le thème automatiquement aux couleurs du logo si activé
            applyTenantTheme(res.data.tenant.logoUrl, res.data.tenant.useLogoColors);
          }
          if (res.data.subscription) {
            setSubscriptionStatus(res.data.subscription.status);
            setSubscriptionEndDate(res.data.subscription.endDate);
          }
        })
        .catch((err) => {
          console.error("Failed to load tenant details:", err);
          // Activer tout par défaut en cas d'erreur de chargement (fallback local)
          setTenantFeatures({
            helpdesk: true,
            financial: true,
            agent: true,
            kb: true,
            onboarding: true,
            depreciation: true,
            hr: true,
            dgi: true,
          });
        });
    } else {
      setTenantFeatures({});
    }
  }, [currentUser, isAuthenticated]);

  // Fetch maintenance alerts every 5 minutes when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const subdomain = localStorage.getItem('tenant_subdomain');
      if (subdomain && subdomain !== 'legacy' && subdomain !== 'null' && subdomain !== 'undefined') {
        fetchMaintenanceAlerts();
      }
    }
    const timer = setInterval(() => {
      if (isAuthenticated) {
        const subdomain = localStorage.getItem('tenant_subdomain');
        if (subdomain && subdomain !== 'legacy' && subdomain !== 'null' && subdomain !== 'undefined') {
          fetchMaintenanceAlerts();
        }
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated, fetchMaintenanceAlerts]);

  // Sync theme to body class
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Live countdown timer for Trial mode
  useEffect(() => {
    if (!isAuthenticated || subscriptionStatus !== 'TRIALING' || !subscriptionEndDate) {
      setTrialCountdownStr('');
      return;
    }

    const updateTimer = () => {
      const end = new Date(subscriptionEndDate).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTrialCountdownStr("00h 00m 00s");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const daysText = days > 0 ? `${days}j ` : '';
      const pad = (num: number) => String(num).padStart(2, '0');
      setTrialCountdownStr(`${daysText}${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, subscriptionStatus, subscriptionEndDate]);

  // Analytics tracking effect
  useEffect(() => {
    const track = async () => {
      try {
        const path = isAuthenticated ? `/app/${activeTab}` : `/public/${publicRoute}`;
        const tenantId = localStorage.getItem('tenant_subdomain') || null;
        
        await api.post('/admin-tenants/analytics/track', {
          path,
          tenantId,
          referrer: document.referrer || null
        });
      } catch (e) {
        // Silent catch
      }
    };
    track();
  }, [activeTab, publicRoute, isAuthenticated]);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // Appliquer le header X-Tenant-ID avant la requête de login
    // pour que le backend puisse résoudre le bon tenant
    const subdomain = loginSubdomain.trim().toLowerCase();
    if (subdomain && subdomain !== 'legacy') {
      api.defaults.headers.common['X-Tenant-ID'] = subdomain;
    } else {
      delete api.defaults.headers.common['X-Tenant-ID'];
    }
    
    try {
      // Attempt backend API login
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.mfaRequired) {
        setTempToken(response.data.tempToken);
        setShowMfa(true);
        // On ne stocke pas encore de session
        return;
      }

      const { access_token, user } = response.data;

      // Sauvegarder le token JWT et le tenantId
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Utiliser le subdomain saisi, ou 'legacy' si aucun (super-admin)
      const activeSubdomain = subdomain || user.tenantSubdomain || (user.tenant && user.tenant.subdomain) || 'legacy';
      initSession(access_token, activeSubdomain);
      api.defaults.headers.common['X-Tenant-ID'] = activeSubdomain;
      localStorage.setItem('token', access_token); // compatibilité legacy
      
      // Store entered password to check for default values
      setEnteredPassword(password);
      
      handleUserPostValidate(user);
    } catch (err: any) {
      console.error("Backend auth failed:", err);
      if (err.response?.status === 401) {
        setLoginError('Email ou mot de passe incorrect.');
      } else {
        setLoginError('Erreur de connexion au serveur. Veuillez réessayer.');
      }
    }
  };

  // Determine security checks (Force password change / MFA) after credentials validation
  const handleUserPostValidate = (user: UserSession) => {
    // 1. Force password change check
    const defaultPasswords = ['admin123', 'tech', 'log', 'finance', 'rh'];
    const isDefaultPassword = defaultPasswords.includes(enteredPassword);

    if (isDefaultPassword) {
      setTempUser(user);
      setShowForcePassword(true);
      return;
    }

    // 2. Profile Completion Check for TENANT ADMINS ONLY
    // The Global Super Admin (admin@entreprise.com / tenantId: null) is excluded from this check
    if (user.role === 'ADMIN' && user.tenantId && (!user.phone || !user.country || !user.position)) {
      setTempUser(user);
      setShowProfileCompletion(true);
      return;
    }

    // 3. MFA verification check
    const mfaIsEnabledOnStorage = localStorage.getItem(`mfa_${user.email}`) === 'true';
    if (user.mfaEnabled || mfaIsEnabledOnStorage) {
      setTempUser(user);
      setShowMfa(true);
      return;
    }

    // 4. Complete authentication
    completeAuthentication(user);
  };

  const handleProfileCompletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfError('');

    if (!profPhone.trim() || !profCountry.trim() || !profPosition.trim()) {
      setProfError('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    if (!tempUser) return;

    try {
      await api.put(`/users/${tempUser.id}`, {
        phone: profPhone,
        country: profCountry,
        position: profPosition
      });

      const updatedUser = { ...tempUser, phone: profPhone, country: profCountry, position: profPosition };
      setShowProfileCompletion(false);
      handleUserPostValidate(updatedUser);
    } catch (err: any) {
      setProfError(err.response?.data?.message || 'Erreur lors de la mise à jour du profil.');
    }
  };

  const completeAuthentication = (user: UserSession) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Clear temporary auth states
    setTempUser(null);
    setShowMfa(false);
    setShowForcePassword(false);
    setShowProfileCompletion(false);
    setEmail('');
    setPassword('');
  };

  // Force Password change submission
  const handleForcePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForcePasswordError('');

    if (!isPasswordValid(newPassword)) {
      setForcePasswordError('Le mot de passe ne respecte pas les critères de sécurité.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForcePasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      if (tempUser) {
        // Le token a déjà été reçu lors du login précédent, on doit l'injecter temporairement
        // pour autoriser la mise à jour du mot de passe de l'utilisateur.
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        
        // Try calling the update API
        await api.put(`/users/${tempUser.id}`, { password: newPassword });
        
        // After successful change, check if MFA is enabled
        const mfaIsEnabledOnStorage = localStorage.getItem(`mfa_${tempUser.email}`) === 'true';
        if (tempUser.mfaEnabled || mfaIsEnabledOnStorage) {
          setShowForcePassword(false);
          setShowMfa(true);
        } else {
          completeAuthentication(tempUser);
        }
      }
    } catch (err: any) {
      console.warn("Backend unavailable to update password, applying changes locally.", err);
      if (err.response) {
        alert("Erreur critique: Le serveur a refusé de mettre à jour le mot de passe. Statut: " + err.response.status + " Message: " + JSON.stringify(err.response.data));
      } else {
        alert("Erreur critique: Impossible de contacter le serveur pour mettre à jour le mot de passe.");
      }
      if (tempUser) {
        const mfaIsEnabledOnStorage = localStorage.getItem(`mfa_${tempUser.email}`) === 'true';
        if (tempUser.mfaEnabled || mfaIsEnabledOnStorage) {
          setShowForcePassword(false);
          setShowMfa(true);
        } else {
          completeAuthentication(tempUser);
        }
      }
    }
  };

  // MFA code submission
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError('');

    if (mfaCode.length < 6) {
      setMfaError('Code MFA invalide.');
      return;
    }

    try {
      const response = await api.post('/auth/mfa/validate', { tempToken, token: mfaCode });
      const { access_token, user } = response.data;

      // Compléter la connexion comme un login normal
      const subdomain = loginSubdomain.trim().toLowerCase();
      const activeSubdomain = subdomain || user.tenantSubdomain || (user.tenant && user.tenant.subdomain) || 'legacy';
      
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      initSession(access_token, activeSubdomain);
      api.defaults.headers.common['X-Tenant-ID'] = activeSubdomain;
      localStorage.setItem('token', access_token);
      
      setEnteredPassword(password);
      handleUserPostValidate(user);
    } catch (err: any) {
      setMfaError(err.response?.data?.message || 'Code MFA incorrect.');
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    clearSession(); // efface access_token + tenant_subdomain
    localStorage.removeItem('token'); // compatibilité legacy
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['X-Tenant-ID'];
    setCurrentUser(null);
    setIsAuthenticated(false);
    setTempUser(null);
    setTempToken('');
    setShowMfa(false);
    setShowForcePassword(false);
    setActiveTab('dashboard');
    setPublicRoute('login');
  };

    // RBAC checks for sidebar items
    const isTabAccessible = (tabKey: string) => {
      if (!currentUser) return false;
      const role = currentUser.role;
      const systemRole = currentUser.systemRole || '';

      const isSuperAdmin = currentUser.email?.toLowerCase() === 'admin@entreprise.com';
      const isSaaSCollaborator = ['SuperAdmin', 'Finance', 'Support'].includes(systemRole) && !currentUser.tenantId;

      // Si l'utilisateur est le Super-Admin global ou un collaborateur SaaS, 
      // il ne doit voir QUE la console SaaS.
      // Tous les modules métier des tenants ainsi que le dashboard lui sont invisibles.
      if (isSuperAdmin || isSaaSCollaborator) {
        return tabKey === 'superadmin';
      }

      // Si c'est l'onglet superadmin, restriction absolue :
      // Il a déjà été intercepté plus haut si l'utilisateur y a droit.
      // S'il arrive ici, c'est qu'il n'est ni SuperAdmin ni SaaS Collaborator.
      if (tabKey === 'superadmin') {
        return false;
      }

      // Admin IT a accès à tous les autres modules normaux
      if (role === 'ADMIN' || systemRole === 'Admin IT') {
        return true;
      }

      switch (tabKey) {
      case 'tenant_settings':
        // Seuls les Admins IT peuvent modifier le branding de l'entreprise
        return role === 'ADMIN' || systemRole === 'Admin IT';

      case 'dashboard':
      case 'kb':
      case 'guide':
      case 'about':
      case 'settings':
      case 'leaves':
        return true; // open to everyone

      case 'assets':
        return ['TECHNICIAN', 'ADMIN', 'USER'].includes(role) || systemRole === 'Logistique / Achat' || systemRole === 'RH' || systemRole === 'Finance';

      case 'movements':
        return ['TECHNICIAN', 'ADMIN'].includes(role) || systemRole === 'Logistique / Achat' || systemRole === 'RH' || systemRole === 'Finance';

      case 'tickets':
        return ['TECHNICIAN', 'ADMIN', 'USER'].includes(role) || systemRole === 'Utilisateur Standard';

      case 'users':
        return ['TECHNICIAN', 'ADMIN'].includes(role) || systemRole === 'RH';

      case 'licenses':
      case 'maintenance':
      case 'sla':
        return ['TECHNICIAN', 'ADMIN'].includes(role);

      case 'onboarding':
        return ['TECHNICIAN', 'ADMIN'].includes(role) || systemRole === 'RH';

      case 'stock':
        return systemRole === 'Logistique / Achat';

      case 'purchase':
        return systemRole === 'Logistique / Achat' || systemRole === 'Finance';

      case 'contract':
      case 'sale':
      case 'dgi_invoices':
        return ['ADMIN'].includes(role) || systemRole === 'Finance' || systemRole === 'Admin IT';

      case 'audit':
        return ['ADMIN'].includes(role) || systemRole === 'Admin IT' || systemRole === 'Finance';

      case 'support_perf':
        return ['ADMIN', 'TECHNICIAN'].includes(role);

      case 'depreciation':
        return ['TECHNICIAN', 'ADMIN'].includes(role) || systemRole === 'Finance' || systemRole === 'Admin IT';
      
      case 'superadmin': {
        // La console de pilotage SaaS est strictement réservée au SuperAdmin global sur le portail legacy
        const subdomain = localStorage.getItem('tenant_subdomain');
        const isLegacyPortal = !subdomain || subdomain === 'legacy';
        const isSaaSCollaborator = ['SuperAdmin', 'Finance', 'Support'].includes(systemRole) && !currentUser.tenantId;
        return isLegacyPortal && (isSaaSCollaborator || (role === 'ADMIN' && systemRole === 'Admin IT') || isSuperAdmin);
      }

      case 'backup':
        return false; // restricted to Admins only

      default:
        return false;
    }
  };

  // Vérifie si une fonctionnalité est indisponible/bloquée par le plan de l'abonné
  const isFeatureDisabled = (tabKey: string) => {
    // Si c'est le super-administrateur global, rien n'est bloqué
    const isSuperAdmin = currentUser?.email?.toLowerCase() === 'admin@entreprise.com';
    if (isSuperAdmin) return false;

    // Si pas connecté, rien à faire
    if (!currentUser) return false;

    // Mappage des onglets vers les clés de fonctionnalités
    const featureMap: Record<string, string> = {
      tickets: 'helpdesk',
      kb: 'kb',
      onboarding: 'onboarding',
      depreciation: 'depreciation',
      purchase: 'financial',
      contract: 'financial',
      sale: 'financial',
      leaves: 'hr',
      dgi_invoices: 'dgi',
      treasury: 'treasury_dashboard',
    };

    const requiredFeature = featureMap[tabKey];
    if (!requiredFeature) return false; // Onglets généraux non restreints par fonctionnalité

    // Si la fonctionnalité n'est pas incluse dans le plan, elle est désactivée (disabled)
    return !tenantFeatures[requiredFeature];
  };

  // Define sidebar menu categories and entries
  const menuSections = [
    {
      title: 'Général',
      items: [
        { key: 'superadmin', label: 'Console SaaS (Global)', icon: 'ph-duotone ph-shield-star' },
        { key: 'dashboard', label: 'Tableau de bord', icon: 'ph-duotone ph-chart-pie' },
        { key: 'assets', label: 'Actifs Informatiques', icon: 'ph-duotone ph-desktop' },
        { key: 'movements', label: 'Mouvements d\'actifs', icon: 'ph-duotone ph-arrows-left-right' },
        { key: 'tickets', label: 'Tickets & Support', icon: 'ph-duotone ph-ticket' },
        { key: 'users', label: 'Collaborateurs', icon: 'ph-duotone ph-users' },
      ]
    },
    {
      title: 'Logistique & Stock',
      items: [
        { key: 'stock', label: 'Magasins & Stocks', icon: 'ph-duotone ph-package' },
      ]
    },
    {
      title: 'Appro & Contrats',
      items: [
        { key: 'purchase', label: 'Achats & Fournisseurs', icon: 'ph-duotone ph-shopping-cart' },
        { key: 'contract', label: 'Contrats & Garanties', icon: 'ph-duotone ph-file-text' },
        { key: 'sale', label: 'Vente & Cession', icon: 'ph-duotone ph-hand-coins' },
        { key: 'treasury', label: 'Dashboard Trésorerie', icon: 'ph-duotone ph-chart-line-up' },
        { key: 'depreciation', label: 'Amortissement & Cycle de Vie', icon: 'ph-duotone ph-chart-line-down' },
        { key: 'dgi_invoices', label: 'Factures Client DGI', icon: 'ph-duotone ph-file-invoice' },
      ]
    },
    {
      title: 'Services & Logiciels',
      items: [
        { key: 'licenses', label: 'Licences & Quotas', icon: 'ph-duotone ph-key' },
        { key: 'maintenance', label: 'Maintenances & Pannes', icon: 'ph-duotone ph-wrench' },
        { key: 'sla', label: 'Niveau de Service (SLA)', icon: 'ph-duotone ph-shield-check' },
        { key: 'onboarding', label: 'Onboarding IT', icon: 'ph-duotone ph-user-plus' },
      ]
    },
    {
      title: 'Ressources Humaines',
      items: [
        { key: 'leaves', label: 'Espace RH & Cotisations', icon: 'ph-duotone ph-users' },
      ]
    },
    {
      title: 'Support & Wiki',
      items: [
        { key: 'kb', label: 'Base de Connaissances', icon: 'ph-duotone ph-book-open' },
        { key: 'guide', label: 'Guide d\'utilisation', icon: 'ph-duotone ph-question' },
      ]
    },
    {
      title: 'Système & Admin',
      items: [
        { key: 'audit', label: 'Traçabilité / Audit', icon: 'ph-duotone ph-list-magnifying-glass' },
        { key: 'support_perf', label: 'Performance Support', icon: 'ph-duotone ph-chart-bar' },
        { key: 'tenant_invoices', label: 'Factures Client DGI', icon: 'ph-duotone ph-file-text' },
        { key: 'backup', label: 'Sauvegardes', icon: 'ph-duotone ph-database' },
        { key: 'subscription', label: 'Mon Abonnement', icon: 'ph-duotone ph-crown' },
        { key: 'settings', label: 'Paramètres & Sécurité', icon: 'ph-duotone ph-gear' },
        { key: 'tenant_settings', label: 'Personnalisation (Branding)', icon: 'ph-duotone ph-palette' },
        { key: 'about', label: 'À Propos', icon: 'ph-duotone ph-info' },
      ]
    }
  ];

  // Render view depending on the selected active tab
  const renderActiveView = () => {
    if (!isTabAccessible(activeTab)) {
      return <DashboardView />;
    }
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'assets': return <AssetView />;
      case 'movements': return <MovementView />;
      case 'tickets': return <TicketView />;
      case 'users': return <UserView />;
      case 'stock': return <StockView />;
      case 'purchase': return <PurchaseView />;
      case 'contract': return <ContractView />;
      case 'sale': return <SaleView />;
      case 'treasury': return <TreasuryView />;
      case 'dgi_invoices': return <DgiInvoicesView />;
      case 'licenses': return <LicenseView />;
      case 'maintenance': return <MaintenanceView />;
      case 'sla': return <SlaView />;
      case 'onboarding': return <OnboardingView />;
      case 'leaves': return <LeavesView currentUser={currentUser} />;
      case 'kb': return <KbView />;
      case 'guide': return <GuideView />;
      case 'audit': return <AuditView />;
      case 'support_perf': return <SupportPerformanceView />;
      case 'tenant_invoices': return <TenantInvoiceView />;
      case 'backup': return <BackupView />;
      case 'settings': return <SettingsView />;
      case 'tenant_settings': return <TenantSettingsView />;
      case 'about': return <AboutView />;
      case 'depreciation': return <DepreciationView />;
      case 'subscription': return <SubscriptionView />;
      case 'superadmin': return <SuperAdminView currentUser={currentUser} />;
      default: return <DashboardView />;
    }
  };

  // Get active view title
  const getActiveViewTitle = () => {
    for (const section of menuSections) {
      const match = section.items.find(item => item.key === activeTab);
      if (match) return match.label;
    }
    return 'Tableau de Bord';
  };

  // Render Login Card
  if (!isAuthenticated) {
    // Route : Écran d'accueil (Landing)
    if (publicRoute === 'landing') {
      return (
        <AppLandingView 
          onAccess={() => {
            localStorage.setItem('hasSeenLandingScreen', 'true');
            setPublicRoute('login');
          }} 
        />
      );
    }

    // Route : Politique de confidentialité
    if (publicRoute === 'privacy') {
      return <PrivacyPolicyView onBack={() => setPublicRoute('login')} />;
    }

    // Route : Page d'inscription
    if (publicRoute === 'signup') {
      return (
        <SignupView
          onSignupSuccess={(token, user, subdomain) => {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            api.defaults.headers.common['X-Tenant-ID'] = subdomain;
            const userWithTenant = { ...user, tenantSubdomain: subdomain };
            localStorage.setItem('currentUser', JSON.stringify(userWithTenant));
            setCurrentUser(userWithTenant);
            setIsAuthenticated(true);
          }}
          onBackToLogin={() => setPublicRoute('login')}
          onGoToPricing={() => setPublicRoute('pricing')}
        />
      );
    }

    // Route : Récupération de compte (abonnés)
    if (publicRoute === 'recovery') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
          <div className="login-card-custom" style={{ maxWidth: '400px', width: '100%' }}>
            <RecoveryFlow
              onBack={() => setPublicRoute('login')}
              onSuccess={(msg) => alert(msg)}
              onError={(msg) => alert(msg)}
            />
          </div>
        </div>
      );
    }

    // Route : Récupération de compte Super-Admin (Console SaaS)
    if (publicRoute === 'superadmin-recovery') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
          <div className="login-card-custom" style={{ maxWidth: '430px', width: '100%' }}>
            <SuperAdminRecoveryFlow onBack={() => setPublicRoute('login')} />
          </div>
        </div>
      );
    }

    // Route : Page de tarification
    if (publicRoute === 'pricing') {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
          <div style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img src="/logo.png" alt="KPSyDesk" style={{ height: '36px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setPublicRoute('login')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Connexion</button>
              <button onClick={() => setPublicRoute('signup')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Commencer →</button>
            </div>
          </div>
          <PricingView onSignup={() => setPublicRoute('signup')} />
        </div>
      );
    }

    // Route par défaut : Login
    if (showForcePassword) {
      return (
        <div className="auth-page">
          <div className="auth-card">
            <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src="/logo.png" alt="K'PSy Informatique" style={{ maxHeight: '60px', maxWidth: '200px', width: 'auto', marginBottom: '15px' }} />
              <div className="auth-subtitle">Première connexion : modification de mot de passe obligatoire</div>
            </div>
            {forcePasswordError && <div className="auth-alert-error">{forcePasswordError}</div>}
            <form onSubmit={handleForcePasswordSubmit} className="auth-form">
              <div className="auth-field">
                <label>Nouveau mot de passe</label>
                <input 
                  type="password"
                  className="auth-input"
                  placeholder="Minimum 10 caractères"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <PasswordStrengthIndicator password={newPassword} />
              </div>
              <div className="auth-field">
                <label>Confirmer le mot de passe</label>
                <input 
                  type="password"
                  className="auth-input"
                  placeholder="Ressaisir le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', opacity: (!isPasswordValid(newPassword) || newPassword !== confirmPassword) ? 0.5 : 1 }}
                disabled={!isPasswordValid(newPassword) || newPassword !== confirmPassword}
              >
                Enregistrer & Continuer
              </button>
            </form>
          </div>
        </div>
      );
    }
    if (showProfileCompletion && tempUser) {
      return (
        <div className="auth-page">
          <div className="auth-card" style={{ maxWidth: '500px' }}>
            <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src="/logo.png" alt="K'PSy Informatique" style={{ maxHeight: '60px', maxWidth: '200px', width: 'auto', marginBottom: '15px' }} />
              <div className="auth-subtitle">Complétez votre profil administrateur</div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', textAlign: 'center' }}>
              Afin de garantir un meilleur suivi de votre compte locataire, veuillez renseigner les informations complémentaires suivantes.
            </p>
            {profError && <div className="auth-alert-error">{profError}</div>}
            <form onSubmit={handleProfileCompletionSubmit} className="auth-form">
              <div className="auth-field">
                <label>Numéro de téléphone *</label>
                <div className="login-input-container">
                  <i className="ph ph-phone" />
                  <input
                    type="tel"
                    className="login-input-field"
                    placeholder="+221 77 000 00 00"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="auth-field">
                <label>Pays / Zone géographique *</label>
                <div className="login-input-container">
                  <i className="ph ph-globe" />
                  <input
                    type="text"
                    className="login-input-field"
                    placeholder="Sénégal, France..."
                    value={profCountry}
                    onChange={(e) => setProfCountry(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="auth-field">
                <label>Poste occupé *</label>
                <div className="login-input-container">
                  <i className="ph ph-briefcase" />
                  <input
                    type="text"
                    className="login-input-field"
                    placeholder="DSI, Gérant..."
                    value={profPosition}
                    onChange={(e) => setProfPosition(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Enregistrer & Continuer
              </button>
            </form>
          </div>
        </div>
      );
    }

    if (showMfa) {
      return (
        <div className="auth-page">
          <div className="auth-card">
            <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src="/logo.png" alt="K'PSy Informatique" style={{ maxHeight: '60px', maxWidth: '200px', width: 'auto', marginBottom: '15px' }} />
              <div className="auth-subtitle">Authentification multifacteur requise pour sécuriser l'accès</div>
            </div>
            {mfaError && <div className="auth-alert-error">{mfaError}</div>}
            <div className="auth-alert-info" style={{ textAlign: 'center' }}>
              Utilisez le code de test <strong>123456</strong> pour valider.
            </div>
            <form onSubmit={handleMfaSubmit} className="auth-form">
              <div className="auth-field">
                <label>Entrez le code à 6 chiffres</label>
                <input 
                  type="text"
                  maxLength={6}
                  className="auth-input"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>Valider le code</button>
              <button type="button" className="btn-icon" onClick={() => { setShowMfa(false); setTempUser(null); }} style={{ width: '100%', borderColor: 'transparent', color: 'var(--text-muted)' }}>Annuler</button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="login-layout-split">
        {/* Toast Notification */}
        <div className="login-toast-custom">
          <i className="ph-fill ph-check-circle"></i>
          <span>Bienvenue dans KPSyDesk ITAM !</span>
        </div>

        {/* Left Pane (Presentation) */}
        <div className="login-left-pane">
          {/* Brand Header */}
          <div className="login-brand-header">
            <img src="/logo.png" alt="K'PSy Informatique Logo" className="login-brand-logo" />
            <div className="login-brand-text">
              <div className="login-brand-name">
                <span className="kpsy">K'PSY</span> <span className="informatique">INFORMATIQUE</span>
              </div>
              <div className="login-brand-desc">Khalil* Prestation Systèmes Informatiques</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start', marginTop: '2rem' }}>
            {/* Left Column: Old layout (Grid & Info) */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '300px' }}>
              {/* Slogan */}
              <div className="login-slogan-banner" style={{ margin: 0 }}>
                <div className="login-slogan-text">Votre Partenaire en Technologie</div>
              </div>

              {/* Services Grid (2x2) */}
              <div className="login-services-grid" style={{ margin: 0 }}>
                <div className="login-service-item">
                  <i className="ph-duotone ph-desktop"></i>
                  <span>Matériels Informatiques</span>
                </div>
                <div className="login-service-item">
                  <i className="ph-duotone ph-keyboard"></i>
                  <span>Consommables & Périph.</span>
                </div>
                <div className="login-service-item">
                  <i className="ph-duotone ph-cloud"></i>
                  <span>Services Cloud & Réseau</span>
                </div>
                <div className="login-service-item">
                  <i className="ph-duotone ph-code"></i>
                  <span>Logiciels Métier & ERP</span>
                </div>
              </div>

              {/* App Info Box */}
              <div className="login-app-box" style={{ margin: 0 }}>
                <div className="login-app-box-header">
                  <div className="login-app-box-title">
                    <i className="ph-duotone ph-shield-check"></i>
                    <span>KPSyDesk ITAM</span>
                  </div>
                  <span className="login-app-box-version">v3.0.0</span>
                </div>
                <div className="login-app-box-desc">
                  Solution complète de gestion d'actifs informatiques, suivi des inventaires, mouvements de stock et gestion des tickets d'assistance (ITAM & ITSM).
                </div>
              </div>

              {/* Highlight Promo Box pointing to Site Vitrine */}
              <a 
                href="https://kpsyinformatique.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="login-app-box"
                style={{ 
                  margin: 0, 
                  textDecoration: 'none', 
                  border: '2px solid rgba(139, 92, 246, 0.4)', 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(37, 211, 102, 0.05) 100%)', 
                  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.15)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'pointer',
                  display: 'block'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--success)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(37, 211, 102, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.15)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: 'rgba(37, 211, 102, 0.15)', 
                    color: 'var(--success)' 
                  }}>
                    <i className="ph-fill ph-sparkle" style={{ fontSize: '1.2rem', color: 'var(--success)' }}></i>
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                    Nos Services & Prestations
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.5' }}>
                  Vous souhaitez en savoir plus sur l'ensemble de nos offres d'infogérance, maintenance et intégration ? <span style={{ color: 'var(--success)', fontWeight: 700, textDecoration: 'underline' }}>Cliquez ici pour visiter notre site vitrine →</span>
                </div>
              </a>
            </div>

            {/* Right Column: Marketing Text */}
            <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '350px' }}>
              <h1 style={{ 
                fontSize: '2.2rem', 
                fontWeight: '800', 
                color: 'var(--text-primary, #f6effc)', 
                lineHeight: '1.2',
                letterSpacing: '-0.02em',
                margin: 0
              }}>
                KPSyDesk — La fin du casse-tête de l'inventaire informatique
              </h1>
              
              <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', lineHeight: '1.6', margin: 0 }}>
                Tableur Excel introuvable, ordinateurs achetés il y a 5 ans dont personne ne connaît plus l'état, amortissements calculés à la main au moment de l'audit... Le parc informatique de votre entreprise mérite mieux qu'un fichier partagé.
              </p>
              
              <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', lineHeight: '1.6', margin: 0 }}>
                KPSyDesk centralise l'intégralité de votre inventaire informatique — postes, serveurs, licences, contrats fournisseurs — dans un espace unique et sécurisé. Chaque actif est suivi de son achat jusqu'à sa réforme : durée de vie, garantie, affectation, historique de maintenance. Les amortissements sont calculés automatiquement selon les normes SYSCOHADA, sans tableur ni recalcul manuel en fin d'exercice.
              </p>
              
              <p style={{ fontSize: '1.1rem', color: 'var(--text-primary, #f6effc)', lineHeight: '1.6', fontWeight: '500', margin: 0, borderLeft: '3px solid #8b5cf6', paddingLeft: '1rem' }}>
                Que vous gériez 20 ou 2 000 équipements, sur un ou plusieurs sites, KPSyDesk vous donne enfin une vue claire de ce que possède réellement votre entreprise — et ce que ça vous coûte.
              </p>
            </div>
          </div>
          {/* Left Footer Credit */}
          <div className="login-left-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
            <div style={{ flex: 1 }}>
              <div className="login-footer-copy">© 2026 K'PSY INFORMATIQUE — TOUS DROITS RÉSERVÉS.</div>
              <div className="login-footer-dev">Développeur : <span>Ibrahima NDIAYE</span></div>
              <div className="login-footer-contacts">
                <a href="tel:+221778034758" className="login-footer-contact-item">
                  <i className="ph-bold ph-phone"></i>
                  <span>+221 77 803 47 58</span>
                </a>
                <a href="tel:+221762613939" className="login-footer-contact-item">
                  <i className="ph-bold ph-phone"></i>
                  <span>+221 76 261 39 39</span>
                </a>
                <a href="mailto:khalil.ndiaye@kpsyinformatique.com" className="login-footer-contact-item">
                  <i className="ph-bold ph-envelope"></i>
                  <span>khalil.ndiaye@kpsyinformatique.com</span>
                </a>
                <a href="https://kpsyinformatique.com" target="_blank" rel="noopener noreferrer" className="login-footer-contact-item">
                  <i className="ph-bold ph-globe"></i>
                  <span>kpsyinformatique.com</span>
                </a>
              </div>
            </div>
            
            {/* Thumbnail Image at bottom left */}
            <div>
              <img 
                src="/kpsy-thumbnail.png" 
                alt="K'PSy Informatique Thumbnail" 
                style={{ width: '120px', height: 'auto', borderRadius: '8px', border: '2px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }} 
              />
            </div>
          </div>
        </div>

        {/* Right Pane (Login) */}
        <div className="login-right-pane">
          {/* Location / Site Banner */}
          <div className="login-location-banner">
            <div className="login-location-icon-wrapper">
              <i className="ph-fill ph-buildings"></i>
            </div>
            <div className="login-location-info">
              <div className="login-location-title">IT Service Desk</div>
              <div className="login-location-subtitle">Sicap Foire, Dakar, Sénégal</div>
            </div>
          </div>

          {/* Secure Login Card */}
          <div className="login-card-custom">
            <div className="login-card-header">
              <i className="ph-fill ph-shield-check login-card-header-icon"></i>
              <div className="login-card-header-text">
                <div className="login-card-header-title">KPSyDesk ITAM</div>
                <div className="login-card-header-subtitle">Portail d'Accès Sécurisé</div>
              </div>
            </div>

            <div className="login-form-title">Connexion</div>
            <div className="login-form-subtitle">Accès réservé au personnel autorisé. Veuillez vous identifier.</div>

            {loginError && <div className="auth-alert-error" style={{ marginBottom: '1.25rem' }}>{loginError}</div>}

            <form onSubmit={handleLoginSubmit}>
              <div className="login-field-wrapper">
                <label className="login-field-label">Identifiant entreprise</label>
                <div className="login-input-container">
                  <i className="ph ph-buildings"></i>
                  <input
                    type="text"
                    className="login-input-field"
                    placeholder="ex : ladin, alamine…"
                    value={loginSubdomain}
                    onChange={(e) => setLoginSubdomain(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className="login-field-wrapper">
                <label className="login-field-label">Adresse e-mail</label>
                <div className="login-input-container">
                  <i className="ph ph-envelope"></i>
                  <input
                    type="email"
                    className="login-input-field"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-field-wrapper">
                <label className="login-field-label">Mot de passe</label>
                <div className="login-input-container">
                  <i className="ph ph-lock"></i>
                  <input
                    type="password"
                    className="login-input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '-10px', marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => setPublicRoute('recovery')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <button type="submit" className="btn-submit-gradient">
                Se Connecter →
              </button>
            </form>

            <div className="login-test-account-box" style={{ padding: '15px', marginTop: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button type="button" onClick={() => setPublicRoute('signup')} style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                  <i className="ph ph-rocket-launch" style={{ marginRight: '6px' }} />Créer un compte
                </button>
                <button type="button" onClick={() => setPublicRoute('pricing')} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                  <i className="ph ph-tag" style={{ marginRight: '6px' }} />Voir les tarifs
                </button>
              </div>
            </div>

            {/* Privacy Notice */}
            <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                <i className="ph-fill ph-lock-key" style={{ fontSize: '1rem' }}></i>
                <span style={{ fontWeight: 600 }}>Protection des données</span>
              </div>
              Vos données sont hébergées et protégées conformément à la loi sénégalaise n° 2008-12 sur la protection des données à caractère personnel, sous le contrôle de la Commission de Protection des Données Personnelles (CDP). Chaque entreprise abonnée dispose d'un espace strictement isolé, inaccessible aux autres utilisateurs de la plateforme.
              <div style={{ marginTop: '8px' }}>
                <button onClick={() => setPublicRoute('privacy')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0, textDecoration: 'underline' }}>En savoir plus</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Trial Logic
  let trialDaysLeft = 0;
  let isTrialLocked = false;
  let isGracePeriod = false;

  if (subscriptionStatus === 'TRIALING' && subscriptionEndDate) {
    const end = new Date(subscriptionEndDate).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    trialDaysLeft = Math.ceil(diff / (1000 * 3600 * 24));
    
    if (trialDaysLeft <= 0) {
      if (trialDaysLeft >= -2) {
        // Période de grâce de 2 jours (jours 0, -1, -2)
        isGracePeriod = true;
      } else {
        // Verrouillage total
        isTrialLocked = true;
      }
    }
  }

  // Render Main Layout when Authenticated
  if (isAuthenticated && (tenantStatus === 'SUSPENDED' || isTrialLocked) && currentUser?.email?.toLowerCase() !== 'admin@entreprise.com') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'white' }}>
        <header style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
          <img src="/logo.png" alt="KPSyDesk" style={{ height: '36px' }} />
          <button className="btn-primary" style={{ backgroundColor: 'var(--danger)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none', color: 'white', fontWeight: 600 }} onClick={handleLogout}>
            <i className="ph ph-sign-out" style={{ marginRight: '6px' }} />Déconnexion
          </button>
        </header>
        <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '600px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', textAlign: 'center', marginBottom: '2rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#ef444415', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <i className="ph ph-warning" style={{ fontSize: '2.5rem', color: '#ef4444' }} />
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>
              {isTrialLocked ? "Période d'Essai Terminée" : "Accès Suspendu - Abonnement Expiré"}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {isTrialLocked 
                ? "Votre période d'essai gratuite ainsi que votre délai de grâce sont arrivés à échéance. L'accès à vos fonctionnalités est temporairement restreint."
                : "Le délai de grâce de votre abonnement a expiré. L'accès à vos fonctionnalités et à vos données est temporairement restreint."}
              <br /><strong>Rassurez-vous, aucune de vos données n'a été supprimée ou altérée.</strong>
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Veuillez sélectionner ou renouveler un plan d'abonnement ci-dessous pour rétablir immédiatement vos accès.
            </p>
          </div>
          <div style={{ maxWidth: '900px', width: '100%' }}>
            <SubscriptionView />
          </div>
        </main>
      </div>
    );
  }

  const whatsappSupportNumber = (import.meta as any).env?.VITE_WHATSAPP_SUPPORT_NUMBER;

  const getWhatsappSupportUrl = () => {
    if (!whatsappSupportNumber) return '';
    const userName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '';
    const company = tenantName || localStorage.getItem('tenant_subdomain') || 'Inconnu';
    const message = `Bonjour, je sollicite l'assistance du support KPSyDesk. Utilisateur : ${userName || 'Inconnu'} (Entreprise : ${company})`;
    return `https://wa.me/${whatsappSupportNumber.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          {!sidebarCollapsed ? (
            <img src="/logo.png" alt="K'PSy Informatique" style={{ maxHeight: '36px', maxWidth: '160px', width: 'auto' }} />
          ) : (
            <img src="/logo.png" alt="K'PSy" style={{ height: '30px', width: '30px', objectFit: 'cover', borderRadius: '4px' }} />
          )}
          <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Agrandir" : "Réduire"}>
            <i className={`ph-bold ${sidebarCollapsed ? 'ph-caret-right' : 'ph-caret-left'}`}></i>
          </button>
        </div>

        <nav className="sidebar-menu">
          {menuSections.map((section, sIdx) => {
            // Filter section items based on permissions (RBAC)
            const visibleItems = section.items.filter(item => {
              if (item.key === 'support_perf') {
                return currentUser?.role === 'ADMIN';
              }
              return isTabAccessible(item.key);
            });
            
            if (visibleItems.length === 0) return null;

            return (
              <React.Fragment key={sIdx}>
                <div className="menu-group-header">{section.title}</div>
                {visibleItems.map(item => {
                  const disabled = isFeatureDisabled(item.key);
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (disabled) {
                          alert(`Cette fonctionnalité n'est pas incluse dans votre plan actuel. \n\nRendez-vous dans "Mon Abonnement" pour changer de plan.`);
                          return;
                        }
                        setActiveTab(item.key);
                      }}
                      className={`menu-item ${activeTab === item.key ? 'active' : ''}`}
                      title={sidebarCollapsed ? (disabled ? `${item.label} (Plan supérieur)` : item.label) : undefined}
                      style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    >
                      <i className={item.icon}></i>
                      <span className="menu-item-text" style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                        {item.label}
                        {disabled && (
                          <span style={{ 
                            marginLeft: 'auto', background: 'rgba(245, 158, 11, 0.2)', 
                            color: '#f59e0b', fontSize: '0.65rem', padding: '2px 6px', 
                            borderRadius: '50px', fontWeight: 700 
                          }}>
                            🔒
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer Credit & Author Info */}
        <div style={{
          padding: '15px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          {!sidebarCollapsed ? (
            <div style={{ textAlign: 'center' }}>
              <div>KPSyDesk v3.0</div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>Conçu par I. NDIAYE</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <i className="ph ph-info" style={{ fontSize: '1rem' }} title="Conçu par Ibrahima NDIAYE"></i>
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace container */}
      <div className="main-wrapper">
        {/* Top bar with theme toggle, view details, profile dropdown */}
        <header className="top-bar">
          <div className="top-bar-left">
            <h2 className="view-title-breadcrumb">{getActiveViewTitle()}</h2>
          </div>

          <div className="top-bar-right">
            {/* Theme Toggle Button */}
            <button 
              className="theme-toggle-btn" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? "Mode clair" : "Mode sombre"}
            >
              <i className={`ph-bold ${theme === 'dark' ? 'ph-sun' : 'ph-moon'}`}></i>
            </button>

            {/* ── Cloche Alertes Maintenance ── */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchMaintenanceAlerts(); }}
                title="Alertes Maintenance Helpdesk"
                style={{
                  position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '1.3rem', color: maintenanceAlerts.length > 0 ? '#f97316' : 'var(--text-muted)',
                  padding: '6px 8px', borderRadius: '8px',
                  transition: 'color 0.2s, background 0.2s',
                }}
              >
                <i className={`ph${maintenanceAlerts.length > 0 ? '-fill' : ''} ph-bell${maintenanceAlerts.length > 0 ? '-ringing' : ''}`}
                  style={{ animation: maintenanceAlerts.some(a => a._level === 'overdue' || a._level === 'today') ? 'bellShake 1.5s ease infinite' : 'none' }} />
                {maintenanceAlerts.length > 0 && (
                  <span style={{
                    position: 'absolute', top: '2px', right: '2px',
                    background: maintenanceAlerts.some(a => a._level === 'overdue') ? '#ef4444' : '#f97316',
                    color: 'white', borderRadius: '50%', width: '17px', height: '17px',
                    fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--bg-secondary)'
                  }}>
                    {maintenanceAlerts.length > 9 ? '9+' : maintenanceAlerts.length}
                  </span>
                )}
              </button>

              {/* Dropdown Alertes */}
              {notifOpen && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 199 }}
                    onClick={() => setNotifOpen(false)} />
                  <div style={{
                    position: 'absolute', top: '110%', right: 0, width: '420px', maxWidth: '95vw',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 200,
                    overflow: 'hidden'
                  }}>
                    {/* Header du panneau */}
                    <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg,#d9770620,#f9731608)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ph-fill ph-bell-ringing" style={{ color: '#f97316', fontSize: '1.1rem' }} />
                        <strong style={{ fontSize: '0.9rem' }}>Alertes Maintenance Helpdesk</strong>
                        {maintenanceAlerts.length > 0 && (
                          <span style={{ background: '#f97316', color: 'white', borderRadius: '12px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                            {maintenanceAlerts.length}
                          </span>
                        )}
                      </div>
                      <button onClick={() => { fetchMaintenanceAlerts(); }}
                        style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="ph ph-arrows-clockwise" /> Actualiser
                      </button>
                    </div>

                    {/* Corps */}
                    <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {maintenanceAlerts.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <i className="ph ph-check-circle" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', color: '#22c55e' }} />
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Aucune alerte en cours</div>
                          <div style={{ fontSize: '0.78rem' }}>Toutes les maintenances sont dans les délais ✅</div>
                        </div>
                      ) : maintenanceAlerts.map((alert: any) => (
                        <div key={alert.id} style={{
                          padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                          borderLeft: `3px solid ${alert._color}`,
                          background: ticketSent.has(alert.id) ? '#22c55e08' : 'transparent',
                          transition: 'background 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <i className={`ph ${alert._level === 'overdue' || alert._level === 'today' ? 'ph-warning-circle' : 'ph-clock-countdown'}`}
                                  style={{ color: alert._color, fontSize: '1rem' }} />
                                <span style={{ fontWeight: 700, fontSize: '0.83rem', color: alert._color }}>{alert._label}</span>
                                <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px',
                                  background: alert.type === 'Préventive' ? '#22c55e20' : '#ef444420',
                                  color: alert.type === 'Préventive' ? '#4ade80' : '#f87171' }}>
                                  {alert.type}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '2px' }}>
                                <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>{alert.assetCode}</span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', lineClamp: '2', overflow: 'hidden' }}>
                                {alert.description}
                              </div>
                              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', gap: '10px' }}>
                                <span><i className="ph ph-calendar" /> {new Date(alert._target).toLocaleDateString('fr-FR')}</span>
                                {alert.technicien && <span><i className="ph ph-user" /> {alert.technicien}</span>}
                                {alert.priority && <span style={{ color: alert._color }}>{alert.priority}</span>}
                              </div>
                            </div>
                            <div>
                              {ticketSent.has(alert.id) ? (
                                <span style={{ fontSize: '0.72rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                                  <i className="ph-fill ph-check-circle" /> Ticket créé
                                </span>
                              ) : (
                                <button
                                  onClick={() => createHelpdeskTicket(alert)}
                                  disabled={sendingTicket === alert.id}
                                  title="Créer un ticket helpdesk pour cette alerte"
                                  style={{
                                    padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                    background: `linear-gradient(135deg, ${alert._color}90, ${alert._color})`,
                                    color: 'white', fontSize: '0.73rem', fontWeight: 700,
                                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                                    opacity: sendingTicket === alert.id ? 0.7 : 1
                                  }}
                                >
                                  {sendingTicket === alert.id
                                    ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite' }} /> Envoi...</>
                                    : <><i className="ph ph-ticket" /> Ticket Helpdesk</>}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Seuil d'alerte configurable par fiche de maintenance</span>
                      <button onClick={() => { setActiveTab('maintenance'); setNotifOpen(false); }}
                        style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="ph ph-arrow-right" /> Voir Maintenance
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown container */}
            <div className="user-dropdown-container">
              <div className="user-profile-summary" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>
                  {currentUser?.firstName?.charAt(0) || 'U'}
                </div>
                <div className="user-info-text">
                  <span className="user-display-name">{currentUser?.firstName} {currentUser?.lastName}</span>
                  <span className="user-role-badge">{currentUser?.systemRole || currentUser?.role}</span>
                </div>
                <i className={`ph-bold ph-caret-down`} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}></i>
              </div>

              {userMenuOpen && (
                <>
                  {/* Backdrop click to close */}
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99 }} onClick={() => setUserMenuOpen(false)}></div>
                  <div className="user-dropdown-menu">
                    <button className="dropdown-item" onClick={() => { setActiveTab('settings'); setUserMenuOpen(false); }}>
                      <i className="ph ph-gear"></i> Paramètres
                    </button>
                    <button className="dropdown-item" onClick={() => { setActiveTab('about'); setUserMenuOpen(false); }}>
                      <i className="ph ph-info"></i> À propos de
                    </button>
                    <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                    <button className="dropdown-item danger-item" onClick={() => { handleLogout(); setUserMenuOpen(false); }}>
                      <i className="ph ph-sign-out"></i> Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Trial Banner */}
        {subscriptionStatus === 'TRIALING' && trialDaysLeft > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '10px 20px',
            color: '#fff', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: '0 2px 8px rgba(245,158,11,0.2)'
          }}>
            <i className="ph-fill ph-clock" style={{ fontSize: '1.1rem' }}></i>
            <span>Vous utilisez actuellement la <strong>Version d'Essai</strong> (KPSyDesk Trial)</span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)', padding: '3px 10px',
              borderRadius: '50px', fontSize: '0.85rem', fontWeight: 700,
              fontFamily: 'monospace', letterSpacing: '0.5px'
            }}>
              ⏳ {trialCountdownStr || `${trialDaysLeft}j`}
            </span>
          </div>
        )}
        {subscriptionStatus === 'TRIALING' && isGracePeriod && (
          <div style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '10px 20px',
            color: '#fff', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: '0 2px 8px rgba(239,68,68,0.2)'
          }}>
            <i className="ph-fill ph-warning" style={{ fontSize: '1.1rem' }}></i>
            <span>Votre période d'essai a expiré ! Période de grâce restante avant suspension :</span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)', padding: '3px 10px',
              borderRadius: '50px', fontSize: '0.85rem', fontWeight: 700,
              fontFamily: 'monospace', letterSpacing: '0.5px'
            }}>
              ⚠️ {trialCountdownStr || `${trialDaysLeft + 2}j`}
            </span>
          </div>
        )}

        {/* Content body wrapper */}
        <main className="main-content" style={{ maxWidth: '100%', margin: '0', padding: '2rem' }}>
          {renderActiveView()}
        </main>

        {whatsappSupportNumber && isAuthenticated && currentUser?.email?.toLowerCase() !== 'admin@entreprise.com' && !(currentUser?.systemRole && ['SuperAdmin', 'Finance', 'Support'].includes(currentUser.systemRole) && !currentUser.tenantId) && (
          <a
            href={getWhatsappSupportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              backgroundColor: '#25D366',
              color: '#fff',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(37,211,102,0.4)',
              zIndex: 9999,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,211,102,0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,211,102,0.4)';
            }}
            title="Besoin d'aide ? Contactez le support sur WhatsApp !"
          >
            <i className="ph ph-whatsapp" style={{ fontSize: '2rem' }} />
          </a>
        )}
      </div>
    </div>
  );
}

export default App;
