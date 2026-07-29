# KPSy Automation — Node-RED SEO/IA

Stack d'automatisation SEO légère et gratuite (sauf API Claude < 0.10 €/mois).
**Entièrement isolée** de l'application KPSyDesk.

---

## 📦 Contenu

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Node-RED isolé, limites ressources, réseau propre |
| `settings.js` | Auth admin Node-RED, chiffrement credentials |
| `.env.example` | Template des secrets (copier en `.env`) |
| `flows/flow_seo_brief.json` | Génération de briefs SEO via Claude 3 Haiku |
| `flows/flow_audit_lighthouse.json` | Audit Lighthouse + synthèse Claude |
| `flows/flow_search_console.json` | Suivi positionnement GSC + alertes email |

---

## 🚀 Déploiement initial (VPS)

### Étape 1 — Préparer le dossier

```bash
# Se connecter au VPS
ssh root@TON_VPS_IP

# Cloner (ou git pull) le repo et aller dans le dossier automation
cd /root
git clone https://github.com/xalilndiaye/kpsydesk-saas-multitenant.git
# OU si déjà cloné :
# cd /root/app && git pull origin master

# Aller dans le dossier automation (SÉPARÉ de /root/app)
mkdir -p /root/automation
cp -r /root/app/automation/* /root/automation/
cd /root/automation
```

### Étape 2 — Configurer les secrets

```bash
cp .env.example .env
nano .env
```

Remplir les valeurs :
- `NODE_RED_CREDENTIAL_SECRET` : clé aléatoire 32+ chars
  ```bash
  openssl rand -hex 32
  ```
- `NODE_RED_ADMIN_PASSWORD_HASH` : hash bcrypt de ton mot de passe
  ```bash
  docker run --rm node:18-alpine sh -c \
    "npm install -g bcryptjs 2>/dev/null && \
     node -e \"console.log(require('bcryptjs').hashSync('TONMOTDEPASSE', 12))\""
  ```
- Credentials Google et SMTP (voir section dédiée)

### Étape 3 — Démarrer Node-RED

```bash
cd /root/automation

# Créer le dossier data avec les bonnes permissions
mkdir -p data/briefs data/audits data/rankings
chmod 755 data

# Démarrer
docker compose up -d

# Vérifier que c'est OK
docker compose ps
docker compose logs -f nodered
```

### Étape 4 — Accéder à l'interface

**Via SSH tunnel (recommandé — le plus sécurisé) :**
```bash
# Depuis ton poste local :
ssh -L 1880:localhost:1880 root@TON_VPS_IP -N
# Puis ouvrir : http://localhost:1880
```

**Via Nginx (sous-domaine dédié) :**
Ajouter dans la config Nginx du VPS :
```nginx
server {
    listen 443 ssl;
    server_name nodered.kpsyinformatique.com;
    
    # Auth basique en plus de l'auth Node-RED
    auth_basic "KPSy Automation";
    auth_basic_user_file /etc/nginx/.htpasswd_nodered;
    
    location / {
        proxy_pass http://127.0.0.1:1880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 📥 Importer les flows

1. Ouvrir l'interface Node-RED
2. Menu (☰) → Import → Select a file to import
3. Importer dans l'ordre :
   - `flows/flow_seo_brief.json`
   - `flows/flow_audit_lighthouse.json`
   - `flows/flow_search_console.json`
4. Cliquer **Deploy** (bouton rouge en haut à droite)

---

## 🔑 Configurer la clé API Claude

Dans l'interface Node-RED :
1. Menu → **Context Data** → **Flow** (onglet)
2. Ajouter la clé : `claude_api_key` = `sk-ant-VOTRE_CLE`
3. Cliquer **Refresh** pour confirmer

Ou via le nœud `⚙️ SET claude_api_key` dans le flow SEO Brief :
1. Double-cliquer le nœud
2. Décommenter la ligne `flow.set(...)`
3. Saisir votre clé
4. Sauvegarder, puis cliquer le bouton du nœud
5. Re-commenter la ligne (la clé reste en mémoire persistante)

---

## 📈 Configuration Google Search Console

> ⚠️ **Pré-requis** : le site `kpsyinformatique.com` doit être vérifié dans Google Search Console.

### Si le site n'est pas encore vérifié :

1. Aller sur https://search.google.com/search-console
2. Ajouter la propriété → méthode **Fichier HTML**
3. Télécharger le fichier et le placer dans le dossier public du site vitrine
4. Cliquer Vérifier

### Créer les credentials OAuth 2.0 :

1. Aller sur https://console.cloud.google.com
2. Créer un projet (ex: `kpsy-seo-automation`)
3. Activer l'API : **Google Search Console API**
4. Identifiants → Créer → **ID client OAuth 2.0** → Type : Application Web
5. URI de redirection autorisée : `http://localhost:8080`
6. Télécharger le JSON → noter `client_id` et `client_secret`

### Générer le refresh token :

```bash
# Ouvrir cette URL dans un navigateur (remplacer CLIENT_ID) :
https://accounts.google.com/o/oauth2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost:8080&scope=https://www.googleapis.com/auth/webmasters.readonly&response_type=code&access_type=offline

# Autoriser l'accès → copier le `code` dans l'URL de redirection

# Échangez le code contre un refresh_token :
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=CODE_ICI" \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:8080" \
  -d "grant_type=authorization_code"
```

Copier `refresh_token` du résultat dans Node-RED :
```
google_client_id     → Context Data flow > google_client_id
google_client_secret → Context Data flow > google_client_secret
google_refresh_token → Context Data flow > google_refresh_token
gsc_site_url         → sc-domain:kpsyinformatique.com
```

---

## 🔄 Commandes utiles

```bash
cd /root/automation

# Démarrer
docker compose up -d

# Arrêter
docker compose down

# Redémarrer Node-RED sans toucher à l'app KPSyDesk
docker compose restart nodered

# Voir les logs
docker compose logs -f nodered

# Mettre à jour Node-RED (nouvelle version)
docker compose pull
docker compose up -d

# Vérifier l'isolation réseau (ne doit PAS contenir itam_postgres)
docker network inspect automation_net
```

---

## 🛡️ Vérification de sécurité

```bash
# 1. Auth obligatoire sur Node-RED (doit retourner 401)
curl -I http://localhost:1880/
# → HTTP/1.1 401 Unauthorized ✅

# 2. Isolation réseau (Node-RED ne peut PAS joindre itam_postgres)
docker exec kpsy_nodered ping itam_postgres
# → ping: bad address 'itam_postgres' ✅

# 3. Limites mémoire respectées
docker stats kpsy_nodered --no-stream
# → MEM USAGE doit rester sous 768MB ✅
```

---

## 💰 Coût estimé API Claude

| Volume mensuel | Coût |
|---|---|
| 4 briefs | < $0.01 |
| 20 briefs + 4 audits | ~$0.08 |
| 60 briefs + 12 audits | ~$0.25 |

Suivi en temps réel : https://console.anthropic.com → Usage

---

## 📁 Données générées

| Dossier | Contenu |
|---|---|
| `/data/briefs/` | Briefs SEO Markdown horodatés |
| `/data/audits/` | Rapports Lighthouse + synthèse Claude |
| `/data/rankings/YYYY-MM.csv` | Historique positionnement Google |
| `/data/rankings/history.json` | Snapshot positions précédentes (pour diff) |
