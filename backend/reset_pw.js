const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.user.updateMany({
    where: { email: 'admin@entreprise.com' },
    data: { password: hash }
  });
  console.log('Password reset to admin123');
}

main().finally(() => prisma.$disconnect());
