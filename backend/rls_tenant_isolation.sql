-- =============================================================================
-- RLS (Row-Level Security) — Isolation multi-tenant au niveau base de données
-- =============================================================================
-- Ce script constitue le filet de sécurité de dernier recours :
-- même si un bug applicatif oublie d'ajouter un filtre tenantId,
-- PostgreSQL refusera de retourner des lignes d'un autre tenant.
--
-- Prérequis : le backend doit exécuter la commande suivante au début
-- de chaque connexion Prisma (via un middleware $use ou un hook $extends) :
--   SET app.current_tenant = '<tenantId>';
--
-- Usage :
--   psql "postgresql://itam_user:itam_password_dev_2026@localhost:3012/itam_db" -f rls_tenant_isolation.sql
-- =============================================================================

-- Activer RLS sur toutes les tables métier contenant tenantId

ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ticket"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetHistory"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "License"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Maintenance"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Consumable"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KBArticle"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Onboarding"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Movement"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Depreciation"  ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent (idempotent)
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'User','Asset','Ticket','TicketComment','AssetHistory',
    'Department','Location','License','Supplier','PurchaseOrder',
    'Contract','Maintenance','Consumable','Sale','KBArticle',
    'Onboarding','Movement','AuditLog','Depreciation'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON "%s"', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_bypass_superuser ON "%s"', tbl);
  END LOOP;
END
$$;

-- Créer les policies RLS sur chaque table.
-- La policy s'applique à tous les utilisateurs sauf les superusers PostgreSQL.
-- En pratique, l'utilisateur itam_user (non-superuser) sera soumis à RLS.
CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Asset"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Ticket"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "TicketComment"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "AssetHistory"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Department"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Location"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "License"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Supplier"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "PurchaseOrder"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Contract"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Maintenance"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Consumable"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Sale"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "KBArticle"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Onboarding"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Movement"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation ON "Depreciation"
  USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.current_tenant', true));

-- Vérification : lister les tables avec RLS activé
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'User','Asset','Ticket','TicketComment','AssetHistory',
    'Department','Location','License','Supplier','PurchaseOrder',
    'Contract','Maintenance','Consumable','Sale','KBArticle',
    'Onboarding','Movement','AuditLog','Depreciation'
  )
ORDER BY tablename;
