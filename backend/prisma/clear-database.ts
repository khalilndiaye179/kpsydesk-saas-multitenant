import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Remise à zéro des abonnés et des données ===\n');

  // Désactiver temporairement RLS ou vider les tables dans l'ordre des clés étrangères
  console.log('🧹 Suppression des données métier des tenants...');
  
  await prisma.movement.deleteMany({});
  await prisma.depreciation.deleteMany({});
  await prisma.kBArticle.deleteMany({});
  await prisma.onboarding.deleteMany({});
  await prisma.license.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.consumable.deleteMany({});
  await prisma.maintenance.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.ticketComment.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.assetHistory.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log('👤 Suppression des utilisateurs tenants...');
  // Conserver uniquement le compte super-administrateur global (qui n'a pas de tenantId)
  await prisma.user.deleteMany({
    where: {
      tenantId: { not: null },
    },
  });

  console.log('💳 Suppression des abonnements...');
  await prisma.subscription.deleteMany({});

  console.log('🏢 Suppression des abonnés (tenants)...');
  await prisma.tenant.deleteMany({});

  console.log('\n✅ Base de données réinitialisée avec succès (prête pour les tests).');
}

main()
  .catch((err) => {
    console.error('Erreur lors de la réinitialisation :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
