# Architecture d'Isolation Multi-Tenant et Contrôle d'Accès RBAC

Ce document détaille l'architecture de sécurité mise en place dans **KPSyDesk ITAM** pour garantir l'isolation stricte des données entre abonnés (tenants) et réguler les droits d'accès via un contrôle RBAC rigoureux.

---

## 1. Authentification & Cycle de Vie du Token

L'accès à l'application repose sur un mécanisme d'authentification par token JWT.

### Injection du `tenantId` dans le JWT
Lors de la connexion réussie (`AuthService.login`) :
1. L'identifiant de l'abonné (`tenantId`) associé à l'utilisateur est extrait de la base de données.
2. Cet identifiant est injecté dans le payload du JWT de manière immuable et signé cryptographiquement.
3. Le payload du token contient :
   ```json
   {
     "sub": "user-uuid",
     "email": "user@company.com",
     "role": "ADMIN",
     "systemRole": "Admin IT",
     "tenantId": "tenant-uuid"
   }
   ```
4. À chaque requête HTTP, le client transmet ce token via le header `Authorization: Bearer <token>`.
5. La stratégie JWT NestJS (`JwtStrategy`) décode et valide la signature cryptographique du token, attachant le payload validé à l'objet `request.user`.

### Cohérence du Contexte (TenantGuard)
Le `TenantGuard` compare l'identifiant du tenant contenu dans le JWT (`request.user.tenantId`) avec celui ciblé par l'URL ou les en-têtes HTTP de la requête (`request.tenantId`). Toute divergence entraîne une exception `403 Forbidden` immédiate, excluant toute usurpation d'identité de tenant.

---

## 2. Isolation des Données (Base de Données — RLS)

En tant que couche de défense principale, l'isolation des données est appliquée au plus bas niveau : la base de données PostgreSQL.

### Colonne `tenantId` globale
Toutes les tables contenant des données métier possèdent une colonne `tenantId` (UUID) :
- `Asset`, `Ticket`, `TicketComment`, `User`, `Department`, `Location`, `License`, `Maintenance`, `KBArticle`, etc.

### Sécurité au Niveau des Lignes (Row Level Security - RLS)
La sécurité RLS est activée de manière stricte sur toutes les tables métier :
```sql
ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" FORCE ROW LEVEL SECURITY;
```

### Mécanisme `app.tenant_id`
1. Lors de l'interception d'une requête authentifiée par NestJS, l'identifiant du tenant est placé dans l'espace de stockage local de la requête (`AsyncLocalStorage`).
2. Le client Prisma (`PrismaService`) exécute au début de la transaction PostgreSQL la commande :
   ```sql
   SELECT set_config('app.tenant_id', 'tenant-uuid', true);
   ```
   *Note : Le paramètre `true` limite la portée de cette variable à la transaction en cours, évitant les fuites inter-requêtes.*
3. Les politiques de sécurité (Policies) appliquées sur chaque table comparent la colonne `tenantId` avec la variable de session courante :
   ```sql
   CREATE POLICY rls_select_asset ON "Asset"
     FOR SELECT
     USING (
       current_tenant_id() IS NULL
       OR "tenantId" = current_tenant_id()
     );
   ```
   *Note : `current_tenant_id()` est une fonction SQL qui renvoie `app.tenant_id`. Si la variable de session est vide ou nulle (scripts de migration/super-admin global), la politique RLS laisse passer la requête.*

---

## 3. Isolation Applicative (Prisma Middleware)

En complément de la sécurité RLS de la base de données, la couche logicielle applique des filtres systématiques en amont pour éviter les erreurs de requêtage et optimiser les performances.

### Réécriture automatique des requêtes Prisma
Un middleware Prisma intercepte toutes les requêtes :
- **Lecture (findMany, findFirst, etc.)** : Injecte automatiquement `where: { tenantId: currentTenantId }` pour restreindre la portée.
- **Création (create, createMany)** : Force l'association de l'enregistrement avec le `tenantId` de la session.
- **Modification/Suppression (update, delete)** : Injecte la clause `where: { tenantId: currentTenantId }` pour empêcher l'altération d'un enregistrement tiers.

---

## 4. Contrôle d'Accès RBAC (Rôles Applicatifs)

Le contrôle RBAC régule les actions au sein d'un même tenant selon les privilèges de l'utilisateur.

### Modèle de Rôles
Trois rôles principaux sont définis au niveau de la base de données (enum `Role`) :
1. **ADMIN** : Accès complet à l'administration du tenant (gestion des utilisateurs, licences, paramètres entreprise, factures, et import/export).
2. **TECHNICIAN** (Technicien IT) : Droit de lecture/écriture sur les équipements, tickets de support, mouvements de stock et maintenances. Pas d'accès aux configurations administratives du tenant.
3. **USER** (Utilisateur standard) : Accès en lecture seule uniquement aux équipements qui lui sont personnellement assignés. Droit de création et de lecture sur ses propres tickets de support.

### Guard NestJS (`RolesGuard`)
Les contrôleurs backend NestJS sont protégés par le décorateur `@Roles` :
```typescript
@Post()
@Roles(Role.ADMIN, Role.TECHNICIAN)
createAsset(@Body() dto: CreateAssetDto) {
  return this.assetsService.create(dto);
}
```
Le `RolesGuard` vérifie le rôle présent dans le JWT décodé et bloque la requête avec une exception `403 Forbidden` en cas d'insuffisance de droits.

### Matrice simplifiée des Droits d'Accès
| Entité / Action | ADMIN | TECHNICIAN | USER (Standard) |
| :--- | :---: | :---: | :---: |
| **Assets (Lecture)** | Tout | Tout | Uniquement assignés |
| **Assets (Écriture)** | Oui | Oui | Non |
| **Tickets (Lecture)** | Tout | Tout | Uniquement créés |
| **Tickets (Écriture)** | Oui | Oui | Uniquement créés |
| **Utilisateurs (Lecture)** | Tout | Non | Uniquement propre profil |
| **Licences & Paramètres** | Oui | Non | Non |
| **Base de Connaissances (KB)**| Oui | Oui | Lecture uniquement |
