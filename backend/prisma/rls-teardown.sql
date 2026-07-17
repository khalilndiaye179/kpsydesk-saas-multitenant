-- ============================================================================
-- Row Level Security (RLS) — Teardown / Désactivation
-- ============================================================================
-- À utiliser pour désactiver le RLS en cas de besoin (rollback).
-- ============================================================================

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
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE 'RLS désactivé pour : %', tbl;
  END LOOP;
END$$;

DROP FUNCTION IF EXISTS current_tenant_id();

RAISE NOTICE '✅ RLS désactivé sur toutes les tables.';
