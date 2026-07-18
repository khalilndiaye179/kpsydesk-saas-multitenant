const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  await prisma.$executeRawUnsafe("SET app.current_tenant = 'legacy'");
  const plans = await prisma.plan.findMany();
  console.log(plans);
}

test().catch(console.error);
