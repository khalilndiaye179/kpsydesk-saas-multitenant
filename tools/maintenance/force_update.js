if (process.env.NODE_ENV === 'production') {
  throw new Error('Script de maintenance bloqué en production. Exécution manuelle uniquement.');
}
/**
 * ============================================================
 * OUTIL DE MAINTENANCE — MISE À JOUR FORCÉE D'UTILISATEUR
 * ============================================================
 * ⚠️  GARDE-FOU : Ce script est BLOQUÉ en production.
 * Usage : NODE_ENV=development TARGET_EMAIL=xxx node tools/maintenance/force_update.js
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

  const updated = await prisma.user.updateMany({
    where: { email: targetEmail },
    data: { role: 'ADMIN' } // Exemple de modification
  });
  console.log(`✅ Mise à jour forcée appliquée pour ${targetEmail} (${updated.count} record(s))`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
