/**
 * ============================================================
 * OUTIL DE MAINTENANCE — VÉRIFICATION DES REQUÊTES BRUTES
 * ============================================================
 * ⚠️  GARDE-FOU : Ce script est BLOQUÉ en production.
 * Usage : NODE_ENV=development TARGET_EMAIL=xxx node tools/maintenance/check_raw.js
 * ============================================================
 */

if (process.env.NODE_ENV === 'production') {
  console.error('\n🚫 ERREUR CRITIQUE : Ce script ne peut PAS être exécuté en production.');
  console.error('   NODE_ENV=production détecté. Opération annulée.\n');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetEmail = process.env.TARGET_EMAIL || 'test@example.com';
  
  try {
    const res = await prisma.$queryRaw`SELECT * FROM "User" WHERE email = ${targetEmail}`;
    if (res && res.length > 0) {
      console.log("Raw query result keys:", Object.keys(res[0]));
      console.log("systemRole:", res[0].systemRole);
    } else {
      console.log(`Aucun utilisateur trouvé pour ${targetEmail}`);
    }
  } catch (err) {
    console.error("Erreur lors de la requête:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
