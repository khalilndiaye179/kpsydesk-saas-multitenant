import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';

export interface SignupDto {
  companyName: string;      // Nom de l'entreprise
  subdomain: string;        // Sous-domaine souhaité (ex: "acme-corp")
  adminEmail: string;       // Email de l'administrateur initial
  adminPassword: string;    // Mot de passe (sera hashé avec bcrypt)
  adminFirstName: string;
  adminLastName: string;
  adminPhone: string;
  adminCountry: string;
  adminPosition: string;
  planName?: string;        // Nom du plan (défaut: premier plan public)
}

export interface SubscriptionUpdateDto {
  planName: string;
  billingInterval?: string; // "MONTHLY" ou "YEARLY"
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ============================================================
  // INSCRIPTION D'UN NOUVEAU TENANT
  // ============================================================

  async signup(dto: SignupDto) {
    const { companyName, subdomain, adminEmail, adminPassword, adminFirstName, adminLastName, adminPhone, adminCountry, adminPosition, planName } = dto;

    // 0. Interdire l'utilisation de l'email réservé du Super-Admin global
    if (adminEmail.toLowerCase().trim() === 'admin@entreprise.com') {
      throw new BadRequestException(
        'Cette adresse email est réservée par le système et ne peut pas être utilisée pour un espace abonné.',
      );
    }

    // 1. Validation du sous-domaine — slug pur, format standard SaaS (ex: acme-corp → acme-corp.kpsy.com)
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) {
      throw new BadRequestException(
        'Le sous-domaine doit contenir entre 3 et 40 caractères (lettres minuscules, chiffres et tirets).',
      );
    }

    // 2. Sous-domaines réservés (noms système)
    const reservedSubdomains = ['www', 'api', 'admin', 'legacy', 'app', 'mail', 'support', 'help', 'blog', 'status'];
    if (reservedSubdomains.includes(subdomain)) {
      throw new BadRequestException(`Le sous-domaine "${subdomain}" est réservé par le système.`);
    }

    // 3. Vérifier unicité du sous-domaine
    const existing = await this.prisma.tenant.findFirst({ where: { subdomain } });
    if (existing) {
      throw new ConflictException(`Le sous-domaine "${subdomain}.kpsyinformatique.com" est déjà utilisé.`);
    }

    // 4. Récupérer le plan choisi
    const plan = await this.prisma.plan.findFirst({
      where: planName
        ? { name: planName, isPublic: true }
        : { isPublic: true },
      orderBy: { price: 'asc' }, // Le moins cher en premier si pas de plan précisé
    });

    if (!plan) {
      throw new NotFoundException('Aucun plan disponible. Contactez le support.');
    }

    // 5. Hash du mot de passe
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // 6. Créer le Tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: companyName,
        subdomain: subdomain.toLowerCase(),
        status: 'TRIAL',
        planId: plan.id,
      },
    });

    // 7. Créer l'utilisateur administrateur initial
    // Note : tenantId passé explicitement car la route /signup est publique
    // (pas de contexte ALS tenant → PrismaService n'injecte pas automatiquement)
    const adminUser = await this.prisma.user.create({
      data: {
        email: adminEmail.toLowerCase(),
        username: adminEmail.split('@')[0].toLowerCase(),
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        phone: adminPhone,
        country: adminCountry,
        position: adminPosition,
        role: 'ADMIN',
        systemRole: 'Admin IT',
        status: 'Actif',
        tenantId: tenant.id,
      },
    });

    // 8. Créer la subscription
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 jours d'essai

    await this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'TRIALING',
        startDate: new Date(),
        endDate: trialEndDate,
      },
    });

    this.eventEmitter.emit('tenant.created', tenant.id);

    return {
      message: 'Inscription réussie ! Votre espace est prêt.',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        status: tenant.status,
      },
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
      },
      plan: {
        name: plan.name,
        trialEndsAt: trialEndDate,
      },
    };
  }

  // ============================================================
  // INFORMATIONS D'UN TENANT
  // ============================================================

  async getMyTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      include: {
        plan: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant introuvable.');
    }

    // Comptes actifs (via SQL brut pour éviter boucle filtre tenant)
    const assetCount = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Asset" WHERE "tenantId" = ${tenantId}
    `;
    const userCount = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "User" WHERE "tenantId" = ${tenantId}
    `;

    const activeSubscription = tenant.subscriptions[0];
    const quotaAssets =
      activeSubscription?.quotaAssets ?? activeSubscription?.plan?.quotaAssets ?? tenant.plan?.quotaAssets ?? 0;
    const quotaUsers = activeSubscription?.plan?.quotaUsers ?? tenant.plan?.quotaUsers ?? 0;

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        status: tenant.status,
        createdAt: tenant.createdAt,
        logoUrl: (tenant as any).logoUrl,
        companyAddress: (tenant as any).companyAddress,
        companyPhone: (tenant as any).companyPhone,
        companyEmail: (tenant as any).companyEmail,
        companyTaxId: (tenant as any).companyTaxId,
      },
      subscription: activeSubscription
        ? {
            plan: activeSubscription.plan?.name,
            status: activeSubscription.status,
            billingInterval: activeSubscription.billingInterval,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
            featuresIncluded: activeSubscription.plan?.featuresIncluded || tenant.plan?.featuresIncluded || {},
          }
        : null,
      usage: {
        assets: { current: Number(assetCount[0].count), quota: quotaAssets },
        users: { current: Number(userCount[0].count), quota: quotaUsers },
      },
    };
  }

  // ============================================================
  // GESTION DES PLANS DISPONIBLES (public)
  // ============================================================

  async getPublicPlans() {
    return this.prisma.plan.findMany({
      where: { isPublic: true },
      orderBy: { price: 'asc' },
    });
  }

  // ============================================================
  // MISE À JOUR DE L'ABONNEMENT (upgrade / downgrade)
  // ============================================================

  async updateSubscription(tenantId: string, dto: SubscriptionUpdateDto) {
    const plan = await this.prisma.plan.findFirst({
      where: { name: dto.planName, isPublic: true },
    });

    if (!plan) {
      throw new NotFoundException(`Plan "${dto.planName}" introuvable.`);
    }

    const interval = dto.billingInterval === 'YEARLY' ? 'YEARLY' : 'MONTHLY';

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
    });

    let createdSub;
    if (!activeSubscription) {
      // Créer une nouvelle subscription
      createdSub = await this.prisma.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: 'ACTIVE',
          billingInterval: interval,
          startDate: new Date(),
        },
        include: { plan: true },
      });
    } else {
      // Mettre à jour la subscription existante
      createdSub = await this.prisma.subscription.update({
        where: { id: activeSubscription.id },
        data: { planId: plan.id, status: 'ACTIVE', billingInterval: interval },
        include: { plan: true },
      });
    }

    // Mettre à jour le plan du tenant
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: plan.id },
    });

    // Générer la facture et la transaction (sauf pour le plan Legacy ou gratuit)
    if (plan.price > 0) {
      // Calcul du montant HT selon l'intervalle
      let priceHT = plan.price;
      if (interval === 'YEARLY') {
        const discount = plan.annualDiscountPct || 20;
        priceHT = plan.price * 12 * (1 - discount / 100);
      }

      const tvaRate = 18.0;
      const tvaAmount = Math.round(priceHT * (tvaRate / 100));
      const amountTTC = priceHT + tvaAmount;

      const randomInvoiceNo = `FAC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      // Créer la facture payée
      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNo: randomInvoiceNo,
          tenantId,
          planId: plan.id,
          amountHT: priceHT,
          tvaRate,
          tvaAmount,
          amountTTC,
          status: 'PAID',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Échéance à 30 jours
        },
      });

      // Créer la transaction de paiement associée
      await this.prisma.transaction.create({
        data: {
          reference: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
          tenantId,
          invoiceId: invoice.id,
          amount: amountTTC,
          type: activeSubscription ? 'UPGRADE' : 'SUBSCRIPTION_BUY',
          paymentMethod: 'WAVE', // Valeur de démo par défaut
        },
      });
    }

    return {
      message: `Abonnement mis à jour vers le plan "${plan.name}".`,
      subscription: createdSub,
    };
  }

  // ============================================================
  // ANNULATION DE L'ABONNEMENT
  // ============================================================

  async cancelSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
    });

    if (!sub) {
      throw new NotFoundException('Aucun abonnement actif à annuler.');
    }

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED', endDate: new Date() },
    });
  }

  // ============================================================
  // RECUPÉRATION DES PASSERELLES DE PAIEMENT DISPONIBLES
  // ============================================================

  async getAvailableGateways() {
    // Utilise le nouveau modèle PaymentProvider
    const providers = await this.prisma.paymentProvider.findMany({
      where: {
        globalStatus: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        displayName: true,
        environment: true,
        currency: true,
        globalStatus: true,
        // configEncrypted n'est jamais exposé
      },
    });
    return providers;
  }

  // ============================================================
  // CONFIRMATION DU PAIEMENT (WEBHOOK)
  // ============================================================

  async confirmPayment(tenantId: string, status: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      throw new NotFoundException('Aucun abonnement trouvé pour ce tenant.');
    }

    if (status === 'success') {
      const now = new Date();
      let baseDate = now;
      if (sub.endDate && sub.endDate > now) {
        baseDate = sub.endDate;
      }
      const newEndDate = new Date(baseDate);
      if (sub.billingInterval === 'YEARLY') {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      } else {
        newEndDate.setMonth(newEndDate.getMonth() + 1);
      }

      // Récupérer les informations du plan pour calculer le montant
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      });

      let priceHT = 0;
      let amountTTC = 0;
      let tvaAmount = 0;
      const tvaRate = 18.0;

      if (tenant && tenant.plan && tenant.plan.price > 0) {
        priceHT = tenant.plan.price;
        if (sub.billingInterval === 'YEARLY') {
          const discount = tenant.plan.annualDiscountPct || 20;
          priceHT = tenant.plan.price * 12 * (1 - discount / 100);
        }
        tvaAmount = Math.round(priceHT * (tvaRate / 100));
        amountTTC = priceHT + tvaAmount;
      }

      const randomInvoiceNo = `FAC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE', endDate: newEndDate },
        });

        await tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'ACTIVE' },
        });

        // Générer la facture et la transaction correspondantes en base si le plan est payant
        if (amountTTC > 0 && tenant && tenant.plan) {
          const invoice = await tx.invoice.create({
            data: {
              invoiceNo: randomInvoiceNo,
              tenantId,
              planId: tenant.plan.id,
              amountHT: priceHT,
              tvaRate,
              tvaAmount,
              amountTTC,
              status: 'PAID',
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          await tx.transaction.create({
            data: {
              reference: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
              tenantId,
              invoiceId: invoice.id,
              amount: amountTTC,
              type: 'RENEWAL',
              paymentMethod: 'WAVE', // Par défaut
            },
          });
        }
      });

      return {
        message: 'Paiement confirmé. Abonnement réactivé avec succès.',
        status: 'ACTIVE',
        endDate: newEndDate,
      };
    } else {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' },
        }),
        this.prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'SUSPENDED' },
        }),
      ]);

      return {
        message: 'Le paiement a échoué ou a été annulé. Accès suspendu.',
        status: 'SUSPENDED',
      };
    }
  }

  // ============================================================
  // BRANDING DU TENANT
  // ============================================================

  async updateBranding(tenantId: string, brandingData: any) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        logoUrl: brandingData.logoUrl,
        companyAddress: brandingData.companyAddress,
        companyPhone: brandingData.companyPhone,
        companyEmail: brandingData.companyEmail,
        companyTaxId: brandingData.companyTaxId,
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        companyAddress: true,
        companyPhone: true,
        companyEmail: true,
        companyTaxId: true,
      }
    });
  }

  // ============================================================
  // STATISTIQUES D'AUDIENCE ET VISITEURS (ISOLÉES)
  // ============================================================

  async getTenantAnalytics(tenantId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Pages vues aujourd'hui pour ce tenant
    const pageViewsToday = await this.prisma.pageView.count({
      where: {
        tenantId,
        createdAt: { gte: startOfToday }
      }
    });

    // 2. Visiteurs uniques aujourd'hui pour ce tenant (basé sur l'IP)
    const uniqueIPsToday = await this.prisma.pageView.groupBy({
      by: ['ip'],
      where: {
        tenantId,
        createdAt: { gte: startOfToday }
      }
    });
    const uniqueVisitorsToday = uniqueIPsToday.length;

    // 3. Pages les plus visitées par ce tenant (Top 10)
    const topPagesRaw = await this.prisma.pageView.groupBy({
      by: ['path'],
      _count: {
        path: true
      },
      where: {
        tenantId
      },
      orderBy: {
        _count: {
          path: 'desc'
        }
      },
      take: 10
    });
    const topPages = topPagesRaw.map(p => ({
      path: p.path,
      count: p._count.path
    }));

    return {
      pageViewsToday,
      uniqueVisitorsToday,
      topPages,
      note: "Estimation basée sur les adresses IP distinctes"
    };
  }
}
