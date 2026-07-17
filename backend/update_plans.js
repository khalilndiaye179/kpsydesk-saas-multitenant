const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting DB operations...");
  
  // 1. Delete 'RBACPlan'
  const rbacPlan = await prisma.plan.findFirst({ where: { name: 'RBACPlan' } });
  if (rbacPlan) {
    // Check if there are any tenants using it. If so, we might need to be careful or delete those as well
    // But assuming we can just delete it:
    await prisma.plan.delete({ where: { id: rbacPlan.id } });
    console.log(`Deleted plan: RBACPlan`);
  } else {
    console.log(`Plan 'RBACPlan' not found.`);
  }

  // 2. Rename 'TestPlan' to 'Free Plan'
  const testPlan = await prisma.plan.findFirst({ where: { name: 'TestPlan' } });
  if (testPlan) {
    await prisma.plan.update({
      where: { id: testPlan.id },
      data: { name: 'Free Plan' }
    });
    console.log(`Renamed plan 'TestPlan' to 'Free Plan'`);
  } else {
    console.log(`Plan 'TestPlan' not found.`);
  }
}

main()
  .catch(e => {
    console.error("Error occurred:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
