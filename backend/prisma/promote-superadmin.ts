import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Promotion des comptes au rôle 'SuperAdmin'...");

  // 1. Promouvoir le compte admin par défaut (si existant)
  const defaultAdmin = await prisma.user.findFirst({
    where: { 
      email: { equals: 'admin@entreprise.com', mode: 'insensitive' },
      tenantId: null 
    }
  });

  if (defaultAdmin) {
    await prisma.user.update({
      where: { id: defaultAdmin.id },
      data: { systemRole: 'SuperAdmin' }
    });
    console.log("✅ Le compte par défaut admin@entreprise.com a été promu au rôle 'SuperAdmin'.");
  } else {
    console.log("ℹ️ Le compte par défaut admin@entreprise.com n'a pas été trouvé (peut-être déjà modifié).");
  }

  // 2. Promouvoir un autre compte spécifié par variable d'environnement (si fourni)
  const extraEmail = process.env.SUPERADMIN_EMAIL;
  if (extraEmail) {
    const user = await prisma.user.findFirst({
      where: { 
        email: { equals: extraEmail.trim(), mode: 'insensitive' },
        tenantId: null 
      }
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { systemRole: 'SuperAdmin' }
      });
      console.log(`✅ Le compte ${extraEmail} a été promu au rôle 'SuperAdmin'.`);
    } else {
      console.log(`❌ Impossible de trouver le compte global avec l'e-mail : ${extraEmail}`);
    }
  }

  console.log("🏁 Fin de la migration.");
}

main()
  .catch(err => {
    console.error("Erreur lors de la migration :", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
