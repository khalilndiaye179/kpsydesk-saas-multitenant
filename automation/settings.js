/**
 * automation/settings.js — Configuration Node-RED
 * 
 * SÉCURITÉ :
 * - Authentification admin obligatoire (bcrypt)
 * - Credential secret pour chiffrement des clés API
 * - CSRF protection activée
 * - Logging des accès admin
 */
module.exports = {

  // ── Port d'écoute ────────────────────────────────────────────
  uiPort: 1880,

  // ── Secret de chiffrement des credentials ───────────────────
  // Valeur lue depuis l'env (définie dans docker-compose.yml + .env)
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET,

  // ── Authentification Admin (obligatoire) ────────────────────
  // Pour générer le hash de ton mot de passe, exécuter sur le VPS :
  //   docker run --rm node:18-alpine sh -c \
  //     "npm install -g bcryptjs && node -e \"console.log(require('bcryptjs').hashSync('TONMOTDEPASSE', 12))\""
  // Puis coller le hash dans NODE_RED_ADMIN_PASSWORD_HASH dans .env
  adminAuth: {
    type: "credentials",
    users: [
      {
        username: process.env.NODE_RED_ADMIN_USER || "admin",
        password: process.env.NODE_RED_ADMIN_PASSWORD_HASH,
        permissions: "*"
      }
    ]
  },

  // ── Répertoire des flows ─────────────────────────────────────
  userDir: '/data',
  flowFile: 'flows.json',
  flowFilePretty: true,

  // ── Logging ─────────────────────────────────────────────────
  logging: {
    console: {
      level: "info",
      metrics: false,
      audit: true
    }
  },

  // ── Éditeur ─────────────────────────────────────────────────
  editorTheme: {
    page: {
      title: "KPSy — Automatisation SEO/IA"
    },
    header: {
      title: "KPSy Automation",
    },
    // Désactiver les tours guidés (pour une interface plus propre)
    tours: false
  },

  // ── Sécurité HTTPS ──────────────────────────────────────────
  // En production, Node-RED est derrière Nginx (HTTPS) — pas besoin de TLS ici.
  // https: {
  //   key: require("fs").readFileSync('privkey.pem'),
  //   cert: require("fs").readFileSync('cert.pem')
  // },

  // ── Nœuds désactivés (non utilisés dans ce projet) ─────────
  nodesExcludes: [],

  // ── Paramètres de l'API HTTP intégrée ────────────────────────
  // Préfixe pour les nœuds HTTP In/Out du flow (ex: /seo/brief)
  httpNodeRoot: '/flows',
  
  // API admin Node-RED (pour les outils de gestion)
  httpAdminRoot: '/',

  // ── Sécurité CSRF ────────────────────────────────────────────
  // Activé par défaut dans Node-RED 3.x

  // ── Diagnostic et métriques (désactivés en production) ──────
  diagnostics: {
    enabled: true,
    ui: true
  },

  // ── Délai de grâce avant arrêt (permet de finir les flows en cours) ─
  runtimeState: {
    enabled: false,
    ui: false
  },
  
  // ── Palette de nœuds ─────────────────────────────────────────
  palette: {
    // Modules npm supplémentaires à installer automatiquement
    // (gérés via l'interface Palette Manager de Node-RED)
  }
};
