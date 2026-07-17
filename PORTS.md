# 🔌 PORTS.md — Répartition des Ports

> **Règle absolue** : Tous les services de ce projet utilisent **exclusivement** des ports dans la plage **3010–3015**.

---

## Tableau de répartition

| Port | Service | Container Docker | Usage |
|------|---------|-----------------|-------|
| **3010** | Backend NestJS | `itam_backend` | API REST (`/api/*`), active en dev et prod |
| **3011** | Frontend Vite | `itam_frontend` | Dev server React/TypeScript |
| **3012** | PostgreSQL 16 | `itam_postgres` | Base de données (exposé en dev uniquement, ne pas exposer en prod) |
| **3013** | *Réservé* | — | Worker de facturation / tâches cron (futur) |
| **3014** | *Réservé* | — | Service de notifications (email/webhook) (futur) |
| **3015** | *Réservé* | — | Interface admin DB (Adminer/pgAdmin, dev optionnel) |

---

## Configuration par fichier

### `docker-compose.yml`
```yaml
postgres:   "3012:5432"
backend:    "3010:3000"
frontend:   "3011:5173"
```

### `.env` (racine)
```dotenv
BACKEND_PORT=3010
FRONTEND_PORT=3011
DB_PORT=3012
```

### `backend/.env` (développement local hors Docker)
```dotenv
PORT=3010
DATABASE_URL=postgresql://...@localhost:3012/itam_db
```

### `frontend/vite.config.ts`
```typescript
server: { port: 3011 }
proxy: { '/api': 'http://localhost:3010' }
```

### `frontend/src/api.ts`
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';
```

---

## Multi-Tenant — Résolution du Tenant

| Environnement | Méthode de résolution |
|---|---|
| **Production** | Sous-domaine HTTP : `entreprise.inventaire-parc.com` → middleware extrait `entreprise` |
| **Développement** | Header HTTP : `X-Tenant-ID: <subdomain>` ou `X-Tenant-ID: legacy` |

En dev, le frontend envoie automatiquement le header `X-Tenant-ID` via l'intercepteur Axios configuré dans `api.ts`.

---

## Commandes rapides

```bash
# Démarrer tous les services
docker compose up -d

# Vérifier les ports utilisés
docker compose ps

# Accéder à l'API
curl http://localhost:3010/api/auth/login

# Accéder au frontend
open http://localhost:3011

# Connexion directe à PostgreSQL (dev)
psql postgresql://itam_user:itam_password_dev_2026@localhost:3012/itam_db
```

---

*Dernière mise à jour : 2026-07-08*
