const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT * FROM "User" LIMIT 1`
  .then(res => console.log(Object.keys(res[0])))
  .finally(() => prisma.$disconnect());
