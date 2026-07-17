import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Remplissage des données comptables pour les abonnés existants ===\n');

  const tenants = await prisma.tenant.findMany({
    include: {
      plan: true,
      subscriptions: {
        include: { plan: true }
      }
    }
  });

  console.log(`Trouvé ${tenants.length} abonné(s).`);

  for (const tenant of tenants) {
    const activeSub = tenant.subscriptions.find(s => s.status === 'ACTIVE' || s.status === 'TRIALING');
    const plan = activeSub?.plan || tenant.plan;

    if (!plan || plan.price === 0) {
      console.log(`- Tenant "${tenant.name}" (${tenant.subdomain}) : Plan gratuit ou sans plan. Ignoré.`);
      continue;
    }

    // Vérifier si des factures existent déjà
    const invoiceCount = await prisma.invoice.count({
      where: { tenantId: tenant.id }
    });

    if (invoiceCount > 0) {
      console.log(`- Tenant "${tenant.name}" (${tenant.subdomain}) : possède déjà ${invoiceCount} facture(s). Ignoré.`);
      continue;
    }

    console.log(`- Tenant "${tenant.name}" (${tenant.subdomain}) : Génération facture pour le plan "${plan.name}"...`);

    const interval = activeSub?.billingInterval || 'MONTHLY';
    let priceHT = plan.price;
    if (interval === 'YEARLY') {
      const discount = plan.annualDiscountPct || 20;
      priceHT = plan.price * 12 * (1 - discount / 100);
    }

    const tvaRate = 18.0;
    const tvaAmount = Math.round(priceHT * (tvaRate / 100));
    const amountTTC = priceHT + tvaAmount;

    const randomInvoiceNo = `FAC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    // Créer la facture
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: randomInvoiceNo,
        tenantId: tenant.id,
        planId: plan.id,
        amountHT: priceHT,
        tvaRate,
        tvaAmount,
        amountTTC,
        status: 'PAID',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });

    // Créer la transaction
    await prisma.transaction.create({
      data: {
        reference: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
        tenantId: tenant.id,
        invoiceId: invoice.id,
        amount: amountTTC,
        type: 'SUBSCRIPTION_BUY',
        paymentMethod: 'WAVE',
      }
    });

    console.log(`  ✅ Facture ${randomInvoiceNo} et Transaction créées pour un total TTC de ${amountTTC.toLocaleString()} XOF.`);
  }

  console.log('\n✅ Remplissage comptable terminé !');
}

main()
  .catch((err) => {
    console.error('Erreur lors du remplissage :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
