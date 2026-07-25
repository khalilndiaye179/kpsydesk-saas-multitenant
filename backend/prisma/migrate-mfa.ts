import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Démarrage de la migration de nettoyage MFA (Option A)...');

  // Trouver tous les utilisateurs avec un secret MFA défini
  const users = await prisma.user.findMany({
    where: {
      mfaSecret: {
        not: null,
      },
    },
    select: {
      id: true,
      email: true,
      mfaSecret: true,
    },
  });

  let migratedCount = 0;

  for (const user of users) {
    // Si le secret ne contient pas de ':' (ce qui indique qu'il est stocké en clair)
    if (user.mfaSecret && !user.mfaSecret.includes(':')) {
      console.log(`  🧹 Désactivation du MFA legacy en clair pour : ${user.email}`);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: [],
        },
      });
      migratedCount++;
    }
  }

  console.log(`✨ Migration terminée. Utilisateurs réinitialisés : ${migratedCount}.`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur durant la migration MFA :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
