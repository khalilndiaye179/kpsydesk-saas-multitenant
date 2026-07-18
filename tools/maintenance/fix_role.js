if (process.env.NODE_ENV === 'production') {
  throw new Error('Script de maintenance bloqué en production. Exécution manuelle uniquement.');
}
/**
 * ============================================================
 * OUTIL DE MAINTENANCE — CORRECTION DU RÔLE UTILISATEUR
 * ============================================================
 * ⚠️  GARDE-FOU : Ce script est BLOQUÉ en production.
 * Usage : NODE_ENV=development node tools/maintenance/fix_role.js
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
  const updated = await prisma.user.updateMany({
    where: { systemRole: 'Finance' },
    data: { role: 'USER' }
  });
  console.log(`✅ Rôle corrigé pour ${updated.count} utilisateur(s) Finance → USER`);
}

main().finally(() => prisma.$disconnect());
