if (process.env.NODE_ENV === 'production') {
  throw new Error('Script de maintenance bloqué en production. Exécution manuelle uniquement.');
}
/**
 * ============================================================
 * OUTIL DE MAINTENANCE — VÉRIFICATION DES CLÉS
 * ============================================================
 * ⚠️  GARDE-FOU : Ce script est BLOQUÉ en production.
 * Usage : NODE_ENV=development node tools/maintenance/check_keys.js
 * ============================================================
 */

if (process.env.NODE_ENV === 'production') {
  console.error('\n🚫 ERREUR CRITIQUE : Ce script ne peut PAS être exécuté en production.');
  console.error('   NODE_ENV=production détecté. Opération annulée.\n');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$queryRaw`SELECT * FROM "User" LIMIT 1`
  .then(res => {
    if (res && res.length > 0) {
      console.log(Object.keys(res[0]));
    } else {
      console.log("No users found.");
    }
  })
  .finally(() => prisma.$disconnect());
