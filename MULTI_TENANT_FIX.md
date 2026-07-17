# MULTI_TENANT_FIX — Correction de la fuite de données inter-tenant

> Date : 2026-07-09  
> Version : 2.1.0  
> Auteur : Antigravity (diagnostic + correction)

---

## Contexte

Le SaaS "Inventaire Parc Informatique" est en environnement multi-tenant :
chaque abonné (tenant) doit avoir ses données strictement cloisonnées.
Des fuites inter-tenant ont été constatées en phase de test et corrigées.

---

## Cause racine

**5 failles d'isolation + 1 faille critique d'usurpation Super-Admin** ont été identifiées et corrigées :

---

### F1 — JWT décodé sans vérification de signature dans le middleware

**Fichier :** `src/tenant/tenant.middleware.ts`  
**Symptôme :** Un attaquant pouvait forger un JWT en remplaçant le tenantId dans la section Base64 — le middleware acceptait ce faux tenantId et initialisait l'AsyncLocalStorage avec une identité d'un autre tenant.  
**Correction :** Suppression totale du décodage JWT Base64 dans le middleware. Le tenant est désormais résolu **uniquement** depuis le header `X-Tenant-ID` ou le sous-domaine HTTP, tous deux vérifiables côté base de données. La vérification cryptographique du JWT est déléguée à `JwtAuthGuard` (Passport), et la cohérence JWT/sous-domaine est ensuite vérifiée par `TenantGuard`.

---

### F2 — Aucune authentification sur les contrôleurs métier (cause principale)

**Fichiers :** `assets.controller.ts`, `tickets.controller.ts`, `users.controller.ts`, `extra.controller.ts`  
**Symptôme :** Toutes les routes métier étaient entièrement publiques. N'importe qui pouvait lire, créer, modifier ou supprimer des données simplement avec le header `X-Tenant-ID: <sous-domaine-cible>`.  
**Correction :** Ajout de `@UseGuards(JwtAuthGuard, TenantGuard)` sur les quatre contrôleurs. Seules les routes `/api/assets/enroll` et `/api/assets/agent/download` restent publiques (usage par l'agent Windows sans session utilisateur), marquées par le décorateur `@Public()`.

---

### F3 — Enrôlement agent sans filtre tenant (cross-matching d'équipements)

**Fichier :** `src/assets/assets.service.ts` méthode `enroll()`  
**Symptôme :** La recherche d'un équipement existant par numéro de série ou adresse MAC ne filtrait pas par `tenantId`. Un agent du Tenant A pouvait trouver et modifier un équipement du Tenant B s'ils partagnaient un identifiant matériel.  
**Correction :** La méthode `enroll()` lit maintenant le `tenantId` depuis `TenantContext.getTenantId()` (AsyncLocalStorage) et l'ajoute comme filtre dans les deux recherches.

---

### F4 — TenantGuard laissait passer les tokens sans tenantId

**Fichier :** `src/tenant/tenant.guard.ts`  
**Symptôme :** Les tokens JWT sans champ `tenantId` (tokens "legacy" pré-migration) passaient le guard sans vérification sur les routes tenant-scoped.  
**Correction :** Le guard rejette maintenant avec un `403 ForbiddenException` tout token valide mais dépourvu de `tenantId` sur une route tenant-scoped.

---

### F5 — Absence de Row-Level Security PostgreSQL

**Fichiers :** `rls_tenant_isolation.sql`, `src/prisma/prisma.service.ts`  
**Symptôme :** Si un bug applicatif oubliait un filtre `WHERE tenantId`, la base de données retournait les données d'autres tenants.  
**Correction :**
1. Script SQL `rls_tenant_isolation.sql` : active RLS et crée une policy d'isolation sur 19 tables métier.
2. Méthode `_registerRlsMiddleware()` dans `PrismaService` : exécute `SET app.current_tenant = '<tenantId>'` dans PostgreSQL avant chaque requête Prisma. Ignoré sur `executeRaw` et `queryRaw` pour éviter toute récursion infinie de mémoire (heap Out of Memory).

---

### F6 — Faille critique : Usurpation d'identité Super-Admin (nouveau)

**Fichiers :** `src/tenant/admin-tenants.controller.ts`, `src/tenant/tenants.service.ts`, `src/users/users.service.ts`  
**Symptôme :** Un abonné du tenant `alamine` pouvait s'inscrire ou créer un compte avec l'adresse email `admin@entreprise.com`. Comme la console Super-Admin backend ne vérifiait que l'adresse email sans vérifier la présence d'un `tenantId` (qui doit être nul pour le Super-Admin global), cet abonné pouvait accéder à toute la console SaaS et voir l'usage de tous les autres abonnés.  
**Correction :**
1. `AdminTenantsController._checkSuperAdmin()` : exige désormais que `user.tenantId` soit `null`/`undefined` en plus de vérifier l'adresse email.
2. `TenantsService.signup()` : interdit formellement de s'inscrire avec l'adresse réservée `admin@entreprise.com` (400 Bad Request).
3. `UsersService.create() / update()` : bloque la création ou modification d'un compte avec l'email `admin@entreprise.com` pour un espace abonné (400 Bad Request).

---

## Tests de validation

**Fichier :** `src/tenant/run-isolation-tests.mjs` (Script HTTP autonome léger)

23 assertions de test validées à 100% sans aucun échec :
- **Test 1** : Accès non authentifié bloqué (401) sur toutes les routes métier.
- **Test 2** : Accès cross-tenant bloqué (403) par comparaison JWT vs sous-domaine.
- **Test 3** : Isolation des données (filtre WHERE).
- **Test 4** : Isolation de l'enrôlement agent (SN partagé → actifs séparés).
- **Test 5** : Token sans tenantId refusé (403) sur routes tenant-scoped.
- **Test 5b** : Inscription et accès console SaaS globale refusés pour l'email usurpé `admin@entreprise.com` lié à un tenant (400 / 403).
- **Test 6** : Concurrence (10 requêtes asynchrones parallèles) sans mélange de données inter-tenant (AsyncLocalStorage validé).

**Exécuter les tests :**
```bash
node --experimental-vm-modules src/tenant/run-isolation-tests.mjs
```

---

## Synthèse des fichiers modifiés

| Fichier | Type | Changement |
|---|---|---|
| `src/tenant/tenant.middleware.ts` | MODIFY | Suppression décodage JWT non signé |
| `src/tenant/tenant.guard.ts` | MODIFY | Rejet des tokens sans tenantId + support @Public() |
| `src/auth/public.decorator.ts` | NEW | Décorateur @Public() pour routes publiques |
| `src/auth/jwt-auth.guard.ts` | MODIFY | Support du décorateur @Public() |
| `src/assets/assets.controller.ts` | MODIFY | @UseGuards() global + @Public() sur enroll et downloadAgent |
| `src/tickets/tickets.controller.ts` | MODIFY | @UseGuards() global |
| `src/users/users.controller.ts` | MODIFY | @UseGuards() global |
| `src/extra/extra.controller.ts` | MODIFY | @UseGuards() global |
| `src/assets/assets.service.ts` | MODIFY | enroll() : filtre tenantId sur serial/MAC |
| `src/prisma/prisma.service.ts` | MODIFY | RLS middleware hook avec protection anti-récursion |
| `src/tenant/admin-tenants.controller.ts` | MODIFY | _checkSuperAdmin() valide que user.tenantId est null |
| `src/tenant/tenants.service.ts` | MODIFY | signup() rejette l'adresse email réservée admin@entreprise.com |
| `src/users/users.service.ts` | MODIFY | create()/update() rejettent l'email réservé admin@entreprise.com |
| `apply-rls.js` | NEW | Script Node pour appliquer RLS sur les 19 tables |
| `src/tenant/run-isolation-tests.mjs` | NEW | 23 assertions d'isolation HTTP autonomes |on.sql` | NEW | Script RLS PostgreSQL (19 tables) |
| `src/tenant/tenant-isolation.spec.ts` | NEW | 6 tests d'isolation inter-tenant |
