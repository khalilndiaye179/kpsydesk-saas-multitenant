import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating Business plan features...');

  const features = {
    helpdesk: true,
    financial: true,
    agent: true,
    kb: true,
    onboarding: true,
    depreciation: true,
  };

  const businessPlan = await prisma.plan.upsert({
    where: { name: 'Business' },
    update: {
      price: 150000,
      quotaAssets: 300,
      quotaUsers: 75,
      featuresIncluded: features,
      isPublic: true,
    },
    create: {
      name: 'Business',
      price: 150000,
      quotaAssets: 300,
      quotaUsers: 75,
      featuresIncluded: features,
      isPublic: true,
    },
  });

  console.log('✅ Business plan upserted successfully:', businessPlan);
}

main()
  .catch((err) => {
    console.error('Error seeding Business plan:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
