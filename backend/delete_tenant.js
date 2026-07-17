const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subdomain = 'mipinfo';
  const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  
  if (!tenant) {
    console.log(`Tenant with subdomain ${subdomain} not found.`);
    return;
  }
  
  const tId = tenant.id;
  console.log(`Deleting tenant ${subdomain} (ID: ${tId})...`);

  // Delete dependencies first
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
  
  // Users
  await prisma.user.deleteMany({ where: { tenantId: tId } });

  // Finally, the tenant itself
  await prisma.tenant.delete({ where: { id: tId } });
  
  console.log(`Successfully deleted tenant: ${subdomain}`);
}

main()
  .catch(e => {
    console.error("Error deleting tenant:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
