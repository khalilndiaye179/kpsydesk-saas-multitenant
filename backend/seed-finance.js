const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const randElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedFinance() {
  console.log('🌱 Alimentation de la base de données avec des données financières de test...');

  try {
    // 1. Désactiver RLS pour injecter globalement
    await prisma.$executeRawUnsafe(`SET app.current_tenant = ''`);

    // 2. Récupérer ou créer les plans de référence
    let starter = await prisma.plan.findUnique({ where: { name: 'Starter' } });
    if (!starter) starter = await prisma.plan.create({ data: { name: 'Starter', price: 15000, quotaAssets: 100, quotaUsers: 10, features: ['100 actifs', '10 utilisateurs'] } });

    let business = await prisma.plan.findUnique({ where: { name: 'Business' } });
    if (!business) business = await prisma.plan.create({ data: { name: 'Business', price: 45000, quotaAssets: 500, quotaUsers: 50, features: ['500 actifs', '50 utilisateurs', 'Support Premium'] } });

    let enterprise = await prisma.plan.findUnique({ where: { name: 'Enterprise' } });
    if (!enterprise) enterprise = await prisma.plan.create({ data: { name: 'Enterprise', price: 120000, quotaAssets: 5000, quotaUsers: 500, features: ['5000 actifs', '500 utilisateurs', 'SLA 99.9%'] } });

    const plans = [starter, business, enterprise];

    // 3. Créer 8 abonnés de test fictifs pour remplir le dashboard
    const tenantsData = [
      { name: 'SENELEC Dakar', subdomain: 'senelec' },
      { name: 'Orange SN', subdomain: 'orange' },
      { name: 'Wave Senegal', subdomain: 'wave' },
      { name: 'Bred Senegal', subdomain: 'bred' },
      { name: 'Auchan Senegal', subdomain: 'auchan' },
      { name: 'Port Autonome de Dakar', subdomain: 'pad' },
      { name: 'CBAO Attijariwafa', subdomain: 'cbao' },
      { name: 'Alamine IT Solutions', subdomain: 'alamine' }
    ];

    const tenants = [];
    for (const data of tenantsData) {
      let t = await prisma.tenant.findUnique({ where: { subdomain: data.subdomain } });
      if (!t) {
        t = await prisma.tenant.create({
          data: {
            name: data.name,
            subdomain: data.subdomain,
            status: randElement(['ACTIVE', 'ACTIVE', 'TRIAL', 'SUSPENDED']),
            planId: randElement(plans).id
          }
        });
      }
      tenants.push(t);
    }

    // 4. Générer des factures et transactions historiques sur les 12 derniers mois
    console.log('- Génération de l\'historique des factures et des transactions...');
    await prisma.invoice.deleteMany({});
    await prisma.transaction.deleteMany({});

    const now = new Date();
    let invoiceCounter = 1;

    for (let month = 0; month < 12; month++) {
      const targetDate = new Date();
      targetDate.setMonth(now.getMonth() - month);

      for (const t of tenants) {
        // Obtenir le plan configuré pour ce tenant
        const plan = plans.find(p => p.id === t.planId) || starter;
        const amountHT = plan.price;
        const tvaRate = 18.0; // Taux UEMOA standard (Sénégal)
        const tvaAmount = Math.round(amountHT * (tvaRate / 100));
        const amountTTC = amountHT + tvaAmount;

        // Statut de la facture
        // Les factures passées sont généralement payées, sauf quelques échecs/en-retard sur le mois en cours
        let status = 'PAID';
        if (month === 0 && t.status === 'SUSPENDED') status = 'OVERDUE';
        if (month === 0 && t.status === 'TRIAL') continue; // En essai pas de facture payante

        const yearStr = targetDate.getFullYear();
        const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
        const numStr = String(invoiceCounter++).padStart(4, '0');
        const invoiceNo = `FAC-${yearStr}-${monthStr}-${numStr}`;

        const invoice = await prisma.invoice.create({
          data: {
            invoiceNo,
            tenantId: t.id,
            planId: plan.id,
            amountHT,
            tvaRate,
            tvaAmount,
            amountTTC,
            status,
            dueDate: new Date(targetDate.getTime() + 15 * 24 * 60 * 60 * 1000), // Échéance J+15
            createdAt: targetDate
          }
        });

        if (status === 'PAID') {
          // Créer une transaction correspondante
          await prisma.transaction.create({
            data: {
              reference: `TX-${randElement(['STRIPE', 'PAYDUNYA', 'WAVE'])}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
              tenantId: t.id,
              invoiceId: invoice.id,
              amount: amountTTC,
              type: month === 11 ? 'SUBSCRIPTION_BUY' : 'RENEWAL',
              paymentMethod: randElement(['STRIPE', 'PAYDUNYA', 'WAVE']),
              createdAt: targetDate
            }
          });
        }
      }
    }

    console.log('🎉 Seed de données financières achevé avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors du seed :', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedFinance();
