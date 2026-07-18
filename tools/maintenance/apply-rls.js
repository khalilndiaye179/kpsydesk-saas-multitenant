if (process.env.NODE_ENV === 'production') {
  throw new Error('Script de maintenance bloqué en production. Exécution manuelle uniquement.');
}
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const tables = [
  'User','Asset','Ticket','TicketComment','AssetHistory',
  'Department','Location','License','Supplier','PurchaseOrder',
  'Contract','Maintenance','Consumable','Sale','KBArticle',
  'Onboarding','Movement','AuditLog','Depreciation',
  'Invoice','Transaction'
];

async function applyRLS() {
  console.log('Activation du RLS (Row-Level Security) sur ' + tables.length + ' tables...\n');

  for (const tbl of tables) {
    try {
      // 1. Activer RLS sur la table
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" ENABLE ROW LEVEL SECURITY`);
      
      // 2. Supprimer l'ancienne policy si elle existe
      await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS tenant_isolation ON "${tbl}"`);
      
      // 3. Créer la policy d'isolation
      await prisma.$executeRawUnsafe(`
        CREATE POLICY tenant_isolation ON "${tbl}"
        USING (
          "tenantId" IS NULL
          OR "tenantId"::text = current_setting('app.current_tenant', true)
        )
      `);
      
      console.log('✅ RLS activé : ' + tbl);
    } catch (e) {
      console.error('❌ Erreur sur ' + tbl + ': ' + e.message);
    }
  }

  // Vérification finale
  const result = await prisma.$queryRaw`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  
  console.log('\n=== Statut RLS par table ===');
  for (const r of result) {
    if (tables.includes(r.tablename)) {
      const icon = r.rowsecurity ? '🔒' : '⚠️ ';
      const status = r.rowsecurity ? 'RLS ACTIF' : 'RLS INACTIF';
      console.log(icon + ' ' + r.tablename + ': ' + status);
    }
  }

  await prisma.$disconnect();
  console.log('\nTerminé.');
}

applyRLS().catch((e) => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
