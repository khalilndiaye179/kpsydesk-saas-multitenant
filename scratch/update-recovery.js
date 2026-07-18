const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRecoveryInfo() {
  try {
    // Dans le backend, la table User est partagée. Le super-admin a tenantId: null
    const result = await prisma.user.updateMany({
      where: { email: 'admin@entreprise.com', tenantId: null },
      data: {
        recoveryEmail: 'neguinho.ndiaye@gmail.com',
        recoveryPhone: '+221 77 803 47 56',
      },
    });
    console.log(`Updated ${result.count} super admin(s) with recovery info.`);
  } catch (err) {
    console.error('Error updating recovery info:', err);
  } finally {
    await prisma.$disconnect();
  }
}

updateRecoveryInfo();
