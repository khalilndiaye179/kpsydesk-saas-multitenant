const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.updateMany({
    where: { systemRole: 'Finance' },
    data: { role: 'USER' }
  });
  console.log("Updated role to USER for Finance");
}

main().finally(() => prisma.$disconnect());
