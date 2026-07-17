-- ============================================================================
-- NEUTRALISATION DU RLS POSTGRESQL — KPSyDesk ITAM Multi-Tenant
-- ============================================================================
--
-- CONTEXTE (2026-07-15) :
--   Le RLS PostgreSQL a été retiré de la couche applicative NestJS car
--   l'implémentation via set_config + pool de connexions Prisma créait une
--   race condition structurelle (deux roundtrips réseau distincts, aucune
--   garantie de co-localisation sur la même connexion physique du pool).
--
-- L'isolation multi-tenant repose désormais EXCLUSIVEMENT sur le filtre
-- applicatif Prisma (_registerTenantMiddleware dans prisma.service.ts).
--
-- CE SCRIPT :
--   - Désactive le RLS sur toutes les tables métier
--   - Supprime les politiques créées par rls-setup.sql
--   - Supprime la fonction current_tenant_id() devenue inutilisée
--
-- USAGE :
--   psql -d itam_db -U postgres -f prisma/rls-disable.sql
--
-- POUR RÉACTIVER :
--   psql -d itam_db -U postgres -f prisma/rls-setup.sql
--   + Implémenter Option A (wrapping $transaction) dans prisma.service.ts
-- ============================================================================

-- ─── 1. Désactiver le RLS sur toutes les tables métier ───────────────────────

DO $$
DECLARE
  tbl TEXT;
  tenant_tables TEXT[] := ARRAY[
    'Department', 'Location', 'User', 'Asset', 'Ticket', 'TicketComment',
    'AssetHistory', 'AuditLog', 'Supplier', 'PurchaseOrder', 'Contract',
    'Maintenance', 'Consumable', 'Sale', 'License', 'Onboarding',
    'KBArticle', 'Movement', 'Depreciation'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    -- Désactiver le forçage RLS
    EXECUTE format('ALTER TABLE IF EXISTS %I NO FORCE ROW LEVEL SECURITY', tbl);
    -- Désactiver le RLS
    EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE 'RLS désactivé sur la table : %', tbl;
  END LOOP;
END$$;

-- ─── 2. Supprimer les politiques RLS créées par rls-setup.sql ────────────────

DO $$
DECLARE
  tbl TEXT;
  tenant_tables TEXT[] := ARRAY[
    'Department', 'Location', 'User', 'Asset', 'Ticket', 'TicketComment',
    'AssetHistory', 'AuditLog', 'Supplier', 'PurchaseOrder', 'Contract',
    'Maintenance', 'Consumable', 'Sale', 'License', 'Onboarding',
    'KBArticle', 'Movement', 'Depreciation'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS rls_select_%s ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_insert_%s ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_update_%s ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_delete_%s ON %I', lower(tbl), tbl);
    -- Politiques de rls_tenant_isolation.sql (ancien nom de politique)
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I', tbl);
    RAISE NOTICE 'Politiques RLS supprimées pour : %', tbl;
  END LOOP;
END$$;

-- ─── 3. Supprimer les fonctions utilitaires RLS devenues inutiles ─────────────

DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS public.tenant_id() CASCADE;

-- ─── 4. Vérification post-désactivation ──────────────────────────────────────

SELECT
  schemaname,
  tablename,
  rowsecurity AS "RLS activé",
  CASE WHEN rowsecurity THEN '⚠️ ENCORE ACTIF' ELSE '✅ Désactivé' END AS statut
FROM pg_tables
WHERE tablename IN (
  'Department', 'Location', 'User', 'Asset', 'Ticket', 'TicketComment',
  'AssetHistory', 'AuditLog', 'Supplier', 'PurchaseOrder', 'Contract',
  'Maintenance', 'Consumable', 'Sale', 'License', 'Onboarding',
  'KBArticle', 'Movement', 'Depreciation'
)
ORDER BY tablename;
