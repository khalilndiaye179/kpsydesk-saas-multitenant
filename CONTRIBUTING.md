# CONTRIBUTING — KPSyDesk ITAM Multi-Tenant

## Politique de Sécurité Multi-Tenant

### Requêtes SQL Brutes (`$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe`)

**Ces méthodes Prisma bypassent le filtre tenant applicatif.** Tout usage déclenche un avertissement ESLint (`local/no-unguarded-raw-query`).

#### Règle
Chaque usage de SQL brut doit satisfaire UNE des conditions suivantes :

1. **Filtre tenant explicite** : la requête SQL contient `WHERE "tenantId" = ${tenantId}` et `tenantId` est résolu depuis le contexte ALS ou le paramètre de la fonction.
2. **Usage Super-Admin global documenté** : commentaire explicite `// eslint-disable-next-line no-restricted-syntax` + commentaire justificatif en regard.
3. **Usage de migration / CI** : hors du dossier `src/`, dans des scripts de seed ou de migration.

#### Usages actuellement autorisés dans le code de production

| Fichier | Méthode | Justification |
|---------|---------|---------------|
| `auth.service.ts` | `$queryRaw` | Login Super-Admin global (`tenantId IS NULL`) — documenté |
| `quota.guard.ts` | `$queryRaw` | Comptage quotas avec `WHERE "tenantId" = ${tenantId}` explicite |
| `tenants.service.ts` | `$queryRaw` | Comptage actifs/users avec `WHERE "tenantId" = ${tenantId}` explicite |
| `prisma.service.ts` | `$executeRawUnsafe` | **SUPPRIMÉ** — ancienne couche RLS retirée (cf. architecture ci-dessous) |

---

## Architecture d'Isolation Multi-Tenant

### Couche unique : Filtre Applicatif Prisma

L'isolation des données inter-tenant repose **exclusivement** sur `_registerTenantMiddleware` dans `prisma.service.ts`.

**Mécanisme** :
- À chaque requête HTTP, `TenantMiddleware` résout le tenant depuis le sous-domaine ou le header `X-Tenant-ID` et le stocke dans un `AsyncLocalStorage` (ALS) isolé par requête Node.js.
- `_registerTenantMiddleware` intercepte chaque opération Prisma, lit le `tenantId` depuis l'ALS et injecte `WHERE tenantId = <current>` dans la requête SQL générée.
- Ce tout se passe dans le **même appel réseau** vers PostgreSQL — pas de split de connexion possible.

### Pourquoi le RLS PostgreSQL a été retiré

Le middleware RLS (`_registerRlsMiddleware`) utilisait `set_config('app.tenant_id', ..., false)` + `next(params)`. Ces deux opérations sont des **roundtrips réseau distincts** sur le pool Prisma. Rien ne garantit qu'ils utilisent la même connexion physique PostgreSQL :

```
Requête 1 (Tenant A) :
  [set_config → connexion C1] [findMany → connexion C2 ← tenant B encore actif !]

Requête 2 (Tenant B) :
  [set_config → connexion C2] [findMany → connexion C1 ← tenant A encore actif !]
```

Le RLS `current_tenant_id() IS NULL → TOUT est visible` (ouverture pour migrations) transformait cette race condition en bypass total. Voir `rls-disable.sql` pour la neutralisation.

### Pour réactiver le RLS (défense en profondeur)

Implémenter Option A : wrapper chaque opération Prisma dans `$transaction()` avec `is_local = true` :

```typescript
// Dans _registerRlsMiddleware — Option A
(this as any).$use(async (params, next) => {
  const tenantId = TenantContext.getTenantId();
  return this.$transaction(async (tx) => {
    if (tenantId) {
      await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`;
    }
    return next(params);  // next doit utiliser tx, pas this — complexité d'implémentation
  });
});
```

Cela a un coût (~2-5ms par requête en transaction PostgreSQL supplémentaire) et nécessite une refactorisation pour passer `tx` au lieu de `this` dans les middlewares — non retenu en production à ce stade.
