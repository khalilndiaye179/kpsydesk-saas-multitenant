/**
 * ============================================================
 * OUTIL DE MAINTENANCE — PURGE COMPLÈTE DE LA BASE DE DONNÉES
 * ============================================================
 * ⚠️  GARDE-FOU : Ce script est BLOQUÉ en production.
 * ⚠️  Il supprime TOUTES les données de toutes les tables.
 * Usage : NODE_ENV=development node tools/maintenance/purge-db.js
 * ============================================================
 */

if (process.env.NODE_ENV === 'production') {
  console.error('\n🚫 ERREUR CRITIQUE : Ce script destructeur ne peut PAS être exécuté en production.');
  console.error('   NODE_ENV=production détecté. Opération annulée.\n');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeAll() {
  console.log('🧹 Purge complète des données de la base de test...');

  try {
    await prisma.$executeRawUnsafe(`SET app.current_tenant = ''`);

    console.log('- Nettoyage des tables de mouvements et audit...');
    await prisma.movement.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.assetHistory.deleteMany({});
    await prisma.depreciation.deleteMany({});

    console.log('- Nettoyage des tickets et commentaires...');
    await prisma.ticketComment.deleteMany({});
    await prisma.ticket.deleteMany({});

    console.log('- Nettoyage des consommables et ventes...');
    await prisma.consumable.deleteMany({});
    await prisma.sale.deleteMany({});

    console.log('- Nettoyage des maintenances, contrats et licences...');
    await prisma.maintenance.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.license.deleteMany({});

    console.log('- Nettoyage des actifs et commandes...');
    await prisma.asset.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.supplier.deleteMany({});
    await prisma.onboarding.deleteMany({});

    console.log('- Nettoyage des utilisateurs (tenants uniquement), départements et localisations...');
    await prisma.user.deleteMany({ where: { tenantId: { not: null } } });
    await prisma.department.deleteMany({});
    await prisma.location.deleteMany({});

    console.log('- Nettoyage des devis et souscriptions...');
    await prisma.quote.deleteMany({});
    await prisma.subscription.deleteMany({});

    console.log('- Suppression de tous les abonnés (Tenants)...');
    await prisma.tenant.deleteMany({});

    console.log('✅ Purge de la base de test effectuée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la purge :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

purgeAll();
