-- ============================================================================
-- Row Level Security (RLS) — KPSyDesk ITAM Multi-Tenant
-- ============================================================================
-- 
-- Ce script configure la sécurité au niveau de PostgreSQL comme SECONDE LIGNE
-- de défense, en complément des filtres applicatifs (AsyncLocalStorage + Prisma).
--
-- Principe :
--   1. L'application NestJS pose la variable de session `app.tenant_id`
--      via SET app.tenant_id = '<uuid>' avant chaque transaction.
--   2. Les politiques RLS vérifient que chaque row appartient à ce tenant.
--   3. Même si un bug applicatif oublie le filtre tenantId, la base de données
--      refusera de retourner les données d'un autre tenant.
--
-- ⚠️  IMPORTANT : ce script nécessite d'être exécuté par un superuser PostgreSQL.
--
-- Usage :
--   psql -d inventaire_parc -U postgres -f rls-setup.sql
--
-- Pour désactiver (retour en arrière) :
--   psql -d inventaire_parc -U postgres -f rls-teardown.sql
-- ============================================================================

-- ─── 0. Rôles applicatifs ────────────────────────────────────────────────────

-- Créer le rôle applicatif si inexistant
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END$$;

-- Le compte applicatif NestJS (défini dans DATABASE_URL)
-- GRANT app_user TO kpsydesk_api;  -- à adapter selon l'utilisateur de prod

-- ─── 1. Fonction utilitaire : récupérer le tenant courant ────────────────────

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION current_tenant_id() IS 
  'Retourne le tenant ID posé dans la session PostgreSQL par l''application NestJS.
   Retourne NULL si aucune session tenant n''est active (routes publiques, migrations).';

-- ─── 2. Activation du RLS sur toutes les tables métier ──────────────────────

-- Liste des tables soumises au RLS (correspond à TENANT_MODELS dans prisma.service.ts)
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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE 'RLS activé sur la table : %', tbl;
  END LOOP;
END$$;

-- ─── 3. Politiques RLS par table ─────────────────────────────────────────────

-- Macro pour créer les politiques standard sur chaque table.
-- On définit 4 politiques : SELECT, INSERT, UPDATE, DELETE.

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
    -- Supprimer les politiques existantes (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS rls_select_%s ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_insert_%s ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_update_%s ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_delete_%s ON %I', lower(tbl), tbl);

    -- ── SELECT : ne voir que les rows du tenant courant ──────────────────
    -- Si current_tenant_id() = NULL (routes publiques, migrations), TOUT est visible.
    -- C'est intentionnel : les migrations et scripts de backfill ont besoin d'un accès global.
    EXECUTE format($$
      CREATE POLICY rls_select_%s ON %I
        FOR SELECT
        USING (
          current_tenant_id() IS NULL
          OR "tenantId" = current_tenant_id()
        )
    $$, lower(tbl), tbl);

    -- ── INSERT : ne créer que dans le tenant courant ──────────────────────
    EXECUTE format($$
      CREATE POLICY rls_insert_%s ON %I
        FOR INSERT
        WITH CHECK (
          current_tenant_id() IS NULL
          OR "tenantId" = current_tenant_id()
        )
    $$, lower(tbl), tbl);

    -- ── UPDATE : ne modifier que les rows du tenant courant ──────────────
    EXECUTE format($$
      CREATE POLICY rls_update_%s ON %I
        FOR UPDATE
        USING (
          current_tenant_id() IS NULL
          OR "tenantId" = current_tenant_id()
        )
        WITH CHECK (
          current_tenant_id() IS NULL
          OR "tenantId" = current_tenant_id()
        )
    $$, lower(tbl), tbl);

    -- ── DELETE : ne supprimer que les rows du tenant courant ─────────────
    EXECUTE format($$
      CREATE POLICY rls_delete_%s ON %I
        FOR DELETE
        USING (
          current_tenant_id() IS NULL
          OR "tenantId" = current_tenant_id()
        )
    $$, lower(tbl), tbl);

    RAISE NOTICE 'Politiques RLS créées pour : %', tbl;
  END LOOP;
END$$;

-- ─── 4. Bypass RLS pour le superuser / migrations ────────────────────────────

-- Le compte de migration Prisma (qui crée les tables) doit bypasser RLS
-- pour les opérations de maintenance.
-- À adapter : remplacer 'postgres' par le compte de migration réel.

-- ALTER ROLE postgres BYPASSRLS;

-- ─── 5. Intégration avec NestJS ──────────────────────────────────────────────

-- Pour activer le RLS depuis NestJS, ajouter dans PrismaService AVANT chaque transaction :
-- 
--   await this.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`;
--
-- Ou, pour une approche par middleware :
-- 
--   this.$use(async (params, next) => {
--     const tenantId = TenantContext.getTenantId();
--     if (tenantId) {
--       await this.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`;
--     }
--     return next(params);
--   });
--
-- Note : SET LOCAL s'applique uniquement à la transaction courante.

-- ─── 6. Vérification post-installation ───────────────────────────────────────

-- Vérifier que RLS est activé sur toutes les tables :
SELECT 
  schemaname,
  tablename,
  rowsecurity AS "RLS activé",
  CASE WHEN rowsecurity THEN '✅' ELSE '❌' END AS statut
FROM pg_tables 
WHERE tablename IN (
  'Department', 'Location', 'User', 'Asset', 'Ticket', 'TicketComment',
  'AssetHistory', 'AuditLog', 'Supplier', 'PurchaseOrder', 'Contract',
  'Maintenance', 'Consumable', 'Sale', 'License', 'Onboarding',
  'KBArticle', 'Movement', 'Depreciation'
)
ORDER BY tablename;

-- Lister toutes les politiques créées :
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual, 80) AS "Condition WHERE"
FROM pg_policies
WHERE policyname LIKE 'rls_%'
ORDER BY tablename, cmd;

RAISE NOTICE '✅ RLS configuré avec succès sur toutes les tables métier.';
