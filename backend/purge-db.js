const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeAll() {
  console.log('🧹 Purge complète des données de la base de test...');

  try {
    // ⚠️ On doit désactiver temporairement RLS ou vider les tables en tant que superuser PostgreSQL (itam_user).
    // Mais pour purger TOUTES les tables proprement, l'ordre des suppressions doit respecter les contraintes de clés étrangères.
    
    // 1. Désactiver RLS temporairement pour cette transaction
    await prisma.$executeRawUnsafe(`SET app.current_tenant = ''`);

    // 2. Vider les tables métier dépendantes
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

    console.log('- Nettoyage des utilisateurs, départements et localisations...');
    // Ne pas supprimer le compte Super-Admin global admin@entreprise.com s'il est requis !
    // On conserve uniquement les utilisateurs hors tenants ou on supprime tous les utilisateurs liés à des tenants.
    await prisma.user.deleteMany({
      where: {
        tenantId: { not: null }
      }
    });
    await prisma.department.deleteMany({});
    await prisma.location.deleteMany({});

    console.log('- Nettoyage des devis et souscriptions...');
    await prisma.quote.deleteMany({});
    await prisma.subscription.deleteMany({});

    console.log('- Suppression de tous les abonnés (Tenants)...');
    await prisma.tenant.deleteMany({});

    console.log('🎉 Purge de la base de test effectuée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la purge :', error);
  } finally {
    await prisma.$disconnect();
  }
}

purgeAll();
