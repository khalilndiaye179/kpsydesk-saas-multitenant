/**
 * ============================================================
 * OUTIL DE MAINTENANCE — SUPPRESSION D'UN LOCATAIRE (TENANT)
 * ============================================================
 * ⚠️  GARDE-FOU : Ce script est BLOQUÉ en production.
 * ⚠️  Il supprime DÉFINITIVEMENT un tenant et toutes ses données.
 * Usage : NODE_ENV=development TENANT_SUBDOMAIN=xxx node tools/maintenance/delete_tenant.js
 * ============================================================
 */

if (process.env.NODE_ENV === 'production') {
  console.error('\n🚫 ERREUR CRITIQUE : Ce script destructeur ne peut PAS être exécuté en production.');
  console.error('   NODE_ENV=production détecté. Opération annulée.\n');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subdomain = process.env.TENANT_SUBDOMAIN || 'mipinfo';

  if (!subdomain) {
    console.error('❌ Erreur : Veuillez définir la variable TENANT_SUBDOMAIN.');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { subdomain } });

  if (!tenant) {
    console.log(`Tenant avec le sous-domaine "${subdomain}" introuvable.`);
    return;
  }

  const tId = tenant.id;
  console.log(`⚠️  Suppression du tenant "${subdomain}" (ID: ${tId})...`);

  await prisma.auditLog.deleteMany({ where: { tenantId: tId } });
  await prisma.transaction.deleteMany({ where: { tenantId: tId } });
  await prisma.invoice.deleteMany({ where: { tenantId: tId } });
  await prisma.quote.deleteMany({ where: { tenantId: tId } });
  await prisma.subscription.deleteMany({ where: { tenantId: tId } });
  await prisma.ticketComment.deleteMany({ where: { tenantId: tId } });
  await prisma.ticket.deleteMany({ where: { tenantId: tId } });
  await prisma.assetHistory.deleteMany({ where: { tenantId: tId } });
  await prisma.movement.deleteMany({ where: { tenantId: tId } });
  await prisma.maintenance.deleteMany({ where: { tenantId: tId } });
  await prisma.depreciation.deleteMany({ where: { tenantId: tId } });
  await prisma.asset.deleteMany({ where: { tenantId: tId } });
  await prisma.consumable.deleteMany({ where: { tenantId: tId } });
  await prisma.license.deleteMany({ where: { tenantId: tId } });
  await prisma.contract.deleteMany({ where: { tenantId: tId } });
  await prisma.purchaseOrder.deleteMany({ where: { tenantId: tId } });
  await prisma.supplier.deleteMany({ where: { tenantId: tId } });
  await prisma.location.deleteMany({ where: { tenantId: tId } });
  await prisma.department.deleteMany({ where: { tenantId: tId } });
  await prisma.onboarding.deleteMany({ where: { tenantId: tId } });
  await prisma.sale.deleteMany({ where: { tenantId: tId } });
  await prisma.kBArticle.deleteMany({ where: { tenantId: tId } });
  await prisma.user.deleteMany({ where: { tenantId: tId } });
  await prisma.tenant.delete({ where: { id: tId } });

  console.log(`✅ Tenant "${subdomain}" supprimé avec succès.`);
}

main()
  .catch(e => {
    console.error('❌ Erreur lors de la suppression du tenant :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
