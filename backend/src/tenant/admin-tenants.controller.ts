import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { TenantStatus } from '@prisma/client';
import {
  UpdateTenantStatusDto,
  UpdateTenantQuotasDto,
  ConfigurePaymentDto,
  CreatePlanDto,
  CreatePromoDto,
  UpdatePromoDto,
  CreateVolumeDiscountDto,
  GenerateQuoteDto,
  UpdateQuoteStatusDto,
  TestInvoiceGenerationDto,
  GenerateInvoicesPeriodDto,
  SuperAdminCreateUserDto,
  SuperAdminUpdateUserDto,
  AssignPlanDto
} from './dto/admin-tenants.dto';

import * as bcrypt from 'bcryptjs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * AdminTenantsController — Espace de contrôle pour le Super-Administrateur SaaS.
 * 
 * Permet de piloter tous les abonnés, gérer la finance de la plateforme
 * et superviser l'utilisation globale.
 * 
 * Sécurisé par JwtAuthGuard. Seuls les comptes système de type 'ADMIN'
 * ayant le rôle système 'Admin IT' (ou SuperAdmin) ont accès à ces statistiques globales.
 */
@Controller('admin-tenants')
@UseGuards(JwtAuthGuard)
export class AdminTenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mailService: MailService
  ) {}

  /**
   * Vérifie les droits d'accès à la Console SaaS.
   * Accepte par défaut le Super-Administrateur global (admin@entreprise.com).
   * Pour les autres collaborateurs (tenantId = null), vérifie que leur systemRole fait partie des allowedRoles.
   */
  private _checkConsoleAccess(
    user: { role: string; systemRole?: string; email: string; tenantId?: string },
    allowedRoles: string[] = ['SuperAdmin']
  ) {
    if (user.tenantId !== null && user.tenantId !== undefined) {
      throw new ForbiddenException('Accès refusé. Vous appartenez à un locataire et non à la console SaaS.');
    }

    if (!allowedRoles.includes(user.systemRole || '')) {
      throw new ForbiddenException(`Accès refusé. Nécessite l'un des rôles SaaS suivants : ${allowedRoles.join(', ')}`);
    }
  }

  /**
   * Enregistre une action dans le Journal d'Audit (Traçabilité SaaS)
   */
  private async _logAction(
    user: { email: string },
    action: string,
    entityType: string,
    entityId: string,
    newData?: any,
    oldData?: any
  ) {
    try {
      const finalEntityType = entityType.startsWith('SaaS_') ? entityType : `SaaS_${entityType}`;
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: finalEntityType,
          entityId,
          oldData: oldData ? oldData : undefined,
          newData: newData ? newData : undefined,
          performedBy: user.email,
          tenantId: null // Force null for global SaaS logs
        }
      });
    } catch (e) {
      console.error("Erreur lors de l'enregistrement de l'audit log", e);
    }
  }

  /**
   * Retourne l'historique complet des actions effectuées sur la console SaaS.
   */
  @Get('audit-logs')
  async getAuditLogs(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    
    return this.prisma.auditLog.findMany({
      where: { 
        tenantId: null,
        entityType: { startsWith: 'SaaS_' }
      },
      orderBy: { createdAt: 'desc' },
      take: 200 // Limite pour la performance, à ajuster avec la pagination si nécessaire
    });
  }

  /**
   * Retourne la liste complète des abonnés (Tenants) de la plateforme,
   * avec leur plan, statut, date de création et compteurs d'usage.
   */
  @Get('list')
  async listAllTenants(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance', 'Support']);

    // Requête directe sans le filtre de tenant (on veut tout voir globalement)
    const tenants = await this.prisma.tenant.findMany({
      include: {
        plan: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
        users: {
          where: { role: 'ADMIN' },
          take: 1,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            country: true,
            position: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Pour chaque tenant, on calcule dynamiquement son usage réel en base
    const enrichedTenants = await Promise.all(
      tenants.map(async (t) => {
        const [assetCount, userCount] = await Promise.all([
          this.prisma.asset.count({ where: { tenantId: t.id } }),
          this.prisma.user.count({ where: { tenantId: t.id } }),
        ]);

        const activeSub = t.subscriptions[0];
        const quotaAssets = activeSub?.quotaAssets ?? t.plan?.quotaAssets ?? 0;
        const quotaUsers = activeSub?.plan?.quotaUsers ?? t.plan?.quotaUsers ?? 0;

        return {
          id: t.id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
          createdAt: t.createdAt,
          planName: activeSub?.plan?.name ?? t.plan?.name ?? 'Aucun',
          usage: {
            assets: { current: assetCount, quota: quotaAssets },
            users: { current: userCount, quota: quotaUsers },
          },
          primaryContact: (t as any).users?.[0] || null,
        };
      }),
    );

    return enrichedTenants;
  }

  /**
   * Retourne les indicateurs de performance financiers (MRR, abonnés, répartition, usage global).
   */
  @Get('stats-global')
  async getGlobalStats(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance', 'Support']);

    // 1. Nombre total d'abonnés et statuts
    const totalTenants = await this.prisma.tenant.count();
    const activeTenants = await this.prisma.tenant.count({
      where: { status: 'ACTIVE' },
    });
    const trialTenants = await this.prisma.tenant.count({
      where: { status: 'TRIAL' },
    });
    const suspendedTenants = await this.prisma.tenant.count({
      where: { status: 'SUSPENDED' },
    });

    // 2. Calcul du Monthly Recurring Revenue (MRR) théorique
    // Somme des prix de plans pour les tenants actifs
    const activeSubscribers = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });
    const mrr = activeSubscribers.reduce((sum, t) => sum + (t.plan?.price ?? 0), 0);

    // 3. Ventilation des plans souscrits
    const plansCount = await this.prisma.plan.findMany({
      include: {
        tenants: {
          where: { status: { in: ['ACTIVE', 'TRIAL'] } },
        },
      },
    });
    const planDistribution = plansCount.map((p) => ({
      name: p.name,
      count: p.tenants.length,
      revenue: p.tenants.filter((t) => t.status === 'ACTIVE').length * p.price,
    }));

    // 4. Compteurs globaux d'infrastructure (pour la facturation)
    const [totalAssets, totalUsers, totalTickets] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.user.count(),
      this.prisma.ticket.count(),
    ]);

    return {
      revenue: {
        mrr,
        annualized: mrr * 12,
        currency: 'XOF',
      },
      counts: {
        tenants: totalTenants,
        active: activeTenants,
        trial: trialTenants,
        suspended: suspendedTenants,
      },
      infrastructure: {
        assets: totalAssets,
        users: totalUsers,
        tickets: totalTickets,
      },
      distribution: planDistribution,
    };
  }

  /**
   * Retourne les indicateurs de santé (Stats Avancées) pour prévenir le churn et repérer l'upsell.
   */
  @Get('stats-advanced')
  async getAdvancedStats(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance', 'Support']);

    // 1. Taux de conversion global
    const activeCount = await this.prisma.tenant.count({ where: { status: 'ACTIVE' } });
    const trialCount = await this.prisma.tenant.count({ where: { status: 'TRIAL' } });
    const totalEngaged = activeCount + trialCount;
    const conversionRate = totalEngaged > 0 ? Math.round((activeCount / totalEngaged) * 100) : 0;

    // Récupérer tous les tenants avec leur abonnement et leur plan
    const tenants = await this.prisma.tenant.findMany({
      include: {
        plan: true,
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });

    const nearQuotaTenants = [];
    const inactiveTenants = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const t of tenants) {
      // Calcul des quotas
      const assetCount = await this.prisma.asset.count({ where: { tenantId: t.id } });
      const activeSub = t.subscriptions[0];
      const quotaAssets = activeSub?.quotaAssets ?? t.plan?.quotaAssets ?? 0;

      if (quotaAssets > 0) {
        const usagePct = (assetCount / quotaAssets) * 100;
        if (usagePct >= 85) {
          nearQuotaTenants.push({
            id: t.id,
            name: t.name,
            subdomain: t.subdomain,
            planName: activeSub?.plan?.name ?? t.plan?.name ?? 'Aucun',
            usagePct: Math.round(usagePct),
            currentAssets: assetCount,
            quotaAssets: quotaAssets,
          });
        }
      }

      // Calcul de l'inactivité (si pas mis à jour depuis 30 jours et pas nouvellement créé)
      // En production réelle, on regarderait les logs de connexion.
      if (t.updatedAt < thirtyDaysAgo && t.createdAt < thirtyDaysAgo && t.status !== 'SUSPENDED') {
        inactiveTenants.push({
          id: t.id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
          lastActivity: t.updatedAt,
          daysInactive: Math.floor((new Date().getTime() - new Date(t.updatedAt).getTime()) / (1000 * 3600 * 24))
        });
      }
    }

    // Trier les inactifs par nombre de jours décroissant
    inactiveTenants.sort((a, b) => b.daysInactive - a.daysInactive);
    nearQuotaTenants.sort((a, b) => b.usagePct - a.usagePct);

    return {
      conversionRate,
      activeCount,
      trialCount,
      nearQuotaTenants,
      inactiveTenants,
    };
  }

  /**
   * Modérer le statut d'un abonné (ex: le suspendre pour non-paiement ou le réactiver).
   */
  @Put('moderate/:id')
  async moderateTenant(
    @Param('id') id: string,
    @Body() body: UpdateTenantStatusDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: body.status },
    });

    // Si on suspend le tenant, on suspend également ses abonnements actifs
    if (body.status === 'SUSPENDED') {
      await this.prisma.subscription.updateMany({
        where: { tenantId: id, status: 'ACTIVE' },
        data: { status: 'PAST_DUE' },
      });
    } else if (body.status === 'ACTIVE') {
      await this.prisma.subscription.updateMany({
        where: { tenantId: id, status: 'PAST_DUE' },
        data: { status: 'ACTIVE' },
      });
    }

    this._logAction(req.user, 'MODERATION_TENANT', 'Tenant', id, { status: body.status });

    return {
      message: `Le locataire "${updated.name}" est désormais dans le statut ${updated.status}.`,
      tenant: updated,
    };
  }

  /**
   * Modifier manuellement les quotas d'attribution (licences d'actifs et utilisateurs)
   * d'un locataire (overrides personnalisés sur l'abonnement).
   */
  @Put('quota/:id')
  async updateTenantQuota(
    @Param('id') id: string,
    @Body() body: UpdateTenantQuotasDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    // Récupérer la dernière subscription active
    const activeSub = await this.prisma.subscription.findFirst({
      where: { tenantId: id, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeSub) {
      throw new NotFoundException("Aucun abonnement actif trouvé pour modifier les quotas.");
    }

    const updatedSub = await this.prisma.subscription.update({
      where: { id: activeSub.id },
      data: {
        quotaAssets: body.quotaAssets,
      },
    });

    this._logAction(req.user, 'MODIFICATION_QUOTA', 'Subscription', activeSub.id, { quotaAssets: body.quotaAssets }, { quotaAssets: activeSub.quotaAssets });

    return {
      message: `Quotas d'attribution mis à jour avec succès.`,
      subscription: updatedSub,
    };
  }

  /**
   * Récupérer les fournisseurs de paiement (route legacy pour compatibilité)
   */
  @Get('payment-gateway')
  async getPaymentGateways(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    // Retourne la liste des PaymentProvider pour compatibilité avec l'ancienne UI
    const providers = await this.prisma.paymentProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });
    // Mappe vers l'ancien format attendu par le frontend
    return providers.map(p => ({
      id: p.id,
      provider: p.code,
      apiKey: '',  // Ne jamais exposer les clés chiffrées
      apiSecret: '',
      merchantId: '',
      isSandbox: p.environment === 'SANDBOX',
      isActive: p.globalStatus === 'ACTIVE',
    }));
  }

  /**
   * Enregistrer ou mettre à jour la configuration d'un fournisseur (route legacy)
   */
  @Post('payment-gateway')
  async savePaymentGateway(
    @Body() body: ConfigurePaymentDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    const { provider, apiKey, apiSecret, merchantId, isSandbox, isActive } = body;

    const environment = isSandbox ? 'SANDBOX' : 'PRODUCTION';
    const globalStatus = isActive ? 'ACTIVE' : 'INACTIVE';

    // Validation minimale
    const isValid = apiKey && apiKey.length >= 8 && apiSecret && apiSecret.length >= 8;
    const validationError = isValid ? null : 'Clés invalides — non publié vers les abonnés';

    // Upsert via le nouveau modèle PaymentProvider
    const existing = await this.prisma.paymentProvider.findUnique({ where: { code: provider } });
    let gateway;
    if (existing) {
      gateway = await this.prisma.paymentProvider.update({
        where: { code: provider },
        data: { environment, globalStatus },
      });
    } else {
      gateway = await this.prisma.paymentProvider.create({
        data: {
          code: provider,
          displayName: provider,
          currency: 'XOF',
          environment,
          globalStatus,
        },
      });
    }

    this._logAction(req.user, 'CONFIGURATION_PAIEMENT', 'PaymentProvider', provider, { globalStatus, environment });

    return { gateway, validationError };
  }

  // ============================================================
  // GESTION DES PLANS TARIFAIRES (SUPER-ADMIN)
  // ============================================================

  @Get('plans')
  async getAllPlans(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    return this.prisma.plan.findMany({
      include: {
        promos: true,
        volumeDiscounts: true,
      },
      orderBy: { price: 'asc' },
    });
  }

  @Put('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() body: CreatePlanDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    const updatedPlan = await this.prisma.plan.update({
      where: { id },
      data: {
        price: body.price,
        quotaAssets: body.quotaAssets,
        quotaUsers: body.quotaUsers,
        description: body.description,
        features: body.features || [],
        annualDiscountPct: body.annualDiscountPct !== undefined ? body.annualDiscountPct : 20.0,
        featuresIncluded: body.featuresIncluded !== undefined ? body.featuresIncluded : undefined,
      },
    });
    this._logAction(req.user, 'MODIFICATION_PLAN', 'Plan', id, updatedPlan);
    return updatedPlan;
  }

  // ============================================================
  // GESTION DES CODES PROMO (SUPER-ADMIN)
  // ============================================================

  @Get('promos')
  async getAllPromos(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    const promos = await this.prisma.promo.findMany({
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`[DEBUG] /admin-tenants/promos called by ${req.user.email}, returning ${promos.length} promos`);
    return promos;
  }

  @Post('promos')
  async createPromo(
    @Body() body: CreatePromoDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    
    const code = body.code.toUpperCase().trim();
    const existing = await this.prisma.promo.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Un code promo avec ce nom existe déjà.');
    }

    const promo = await this.prisma.promo.create({
      data: {
        code,
        label: body.label,
        discountPct: body.discountPct,
        maxUses: body.maxUses || null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        planId: body.planId || null,
      },
    });
    this._logAction(req.user, 'CREATION_PROMO', 'Promo', promo.id, promo);
    return promo;
  }

  @Put('promos/:id')
  async updatePromo(
    @Param('id') id: string,
    @Body() body: UpdatePromoDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    const updatedPromo = await this.prisma.promo.update({
      where: { id },
      data: {
        label: body.label,
        discountPct: body.discountPct,
        maxUses: body.maxUses !== undefined ? body.maxUses : undefined,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        isActive: body.isActive,
      },
    });
    this._logAction(req.user, 'MODIFICATION_PROMO', 'Promo', id, updatedPromo);
    return updatedPromo;
  }

  @Delete('promos/:id')
  async deletePromo(
    @Param('id') id: string,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    await this.prisma.promo.delete({ where: { id } });
    this._logAction(req.user, 'SUPPRESSION_PROMO', 'Promo', id);
    return { message: 'Code promo supprimé avec succès.' };
  }

  // ============================================================
  // GESTION DES RÉDUCTIONS VOLUMÉTRIQUES (SUPER-ADMIN)
  // ============================================================

  @Get('volume-discounts')
  async getAllVolumeDiscounts(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    return this.prisma.volumeDiscount.findMany({
      include: { plan: true },
      orderBy: { discountPct: 'asc' },
    });
  }

  @Post('volume-discounts')
  async createVolumeDiscount(
    @Body() body: CreateVolumeDiscountDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    const discount = await this.prisma.volumeDiscount.create({
      data: {
        planId: body.planId,
        minAssets: body.minAssets,
        minUsers: body.minUsers,
        discountPct: body.discountPct,
        label: body.label,
      },
    });
    this._logAction(req.user, 'CREATION_REDUCTION_VOL', 'VolumeDiscount', discount.id, discount);
    return discount;
  }

  @Delete('volume-discounts/:id')
  async deleteVolumeDiscount(
    @Param('id') id: string,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    await this.prisma.volumeDiscount.delete({ where: { id } });
    this._logAction(req.user, 'SUPPRESSION_REDUCTION_VOL', 'VolumeDiscount', id);
    return { message: 'Réduction volumétrique supprimée avec succès.' };
  }

  // ============================================================
  // GÉNERATEUR DE DEVIS (SUPER-ADMIN)
  // ============================================================

  @Get('quotes')
  async getAllQuotes(@Req() req: { user: { role: string; systemRole?: string; email: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    return this.prisma.quote.findMany({
      include: { plan: true, tenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('quotes/generate')
  async generateQuote(
    @Body() body: GenerateQuoteDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);

    const plan = await this.prisma.plan.findUnique({
      where: { id: body.planId },
      include: { volumeDiscounts: true },
    });
    if (!plan) throw new NotFoundException('Plan introuvable.');

    // 1. Calcul du prix de base (mensuel)
    let basePrice = plan.price;
    const reqAssets = body.assetsCount || plan.quotaAssets;
    const reqUsers = body.usersCount || plan.quotaUsers;

    // Surcoûts si dépassement des quotas de base
    if (body.assetsCount && body.assetsCount > plan.quotaAssets) {
      const extraAssets = body.assetsCount - plan.quotaAssets;
      basePrice += extraAssets * 100; // 100 FCFA par actif supplémentaire
    }
    if (body.usersCount && body.usersCount > plan.quotaUsers) {
      const extraUsers = body.usersCount - plan.quotaUsers;
      basePrice += extraUsers * 1000; // 1000 FCFA par utilisateur supplémentaire
    }

    // Si facturation annuelle, multiplier le prix mensuel de base par 12 avant remises
    const isYearly = body.billingCycle === 'yearly';
    if (isYearly) {
      basePrice = basePrice * 12;
    }

    // 2. Réductions volumétriques
    let volumeDiscountPct = 0;
    if (plan.volumeDiscounts && plan.volumeDiscounts.length > 0) {
      for (const rule of plan.volumeDiscounts) {
        if (reqAssets >= rule.minAssets && reqUsers >= rule.minUsers) {
          if (rule.discountPct > volumeDiscountPct) {
            volumeDiscountPct = rule.discountPct; // on applique la réduction max disponible
          }
        }
      }
    }
    const volumeDiscountAmount = basePrice * (volumeDiscountPct / 100);
    let tempPrice = basePrice - volumeDiscountAmount;

    // 3. Réduction Plan Annuel (par défaut ou customisée)
    if (isYearly) {
      const annualDiscountPct = (body as any).customAnnualDiscountPct !== undefined 
        ? Number((body as any).customAnnualDiscountPct) 
        : (plan.annualDiscountPct || 0);
      const annualDiscountAmount = tempPrice * (annualDiscountPct / 100);
      tempPrice -= annualDiscountAmount;
    }

    // 4. Réduction Promo
    let promoDiscountPct = 0;
    if (body.promoCode) {
      const promo = await this.prisma.promo.findFirst({
        where: {
          code: body.promoCode.toUpperCase().trim(),
          isActive: true,
          OR: [
            { planId: null },
            { planId: plan.id }
          ]
        }
      });
      if (promo) {
        promoDiscountPct = promo.discountPct;
        const promoDiscountAmount = tempPrice * (promoDiscountPct / 100);
        tempPrice -= promoDiscountAmount;

        // Incrémenter le compteur d'utilisation
        await this.prisma.promo.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } }
        });
      }
    }

    const subtotal = tempPrice;

    // 5. Calcul de la TVA (optionnelle à 18%)
    const tvaRate = body.applyTva ? 18 : 0;
    const tvaAmount = subtotal * (tvaRate / 100);
    const total = subtotal + tvaAmount;

    // 6. Générer le devis
    const quoteNo = `DEV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30); // Devis valide 30 jours

    return this.prisma.quote.create({
      data: {
        quoteNo,
        tenantId: body.tenantId || null,
        planId: plan.id,
        clientName: body.clientName || null,
        clientEmail: body.clientEmail || null,
        promoCode: body.promoCode || null,
        discountPct: promoDiscountPct,
        volumeDiscPct: volumeDiscountPct,
        subtotal,
        tvaRate,
        tvaAmount,
        total,
        notes: body.notes || null,
        validUntil,
        billingCycle: body.billingCycle || 'monthly'
      } as any,
      include: { plan: true, tenant: true },
    });
  }

  @Put('quotes/:id/status')
  async updateQuoteStatus(
    @Param('id') id: string,
    @Body() body: UpdateQuoteStatusDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } },
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    return this.prisma.quote.update({
      where: { id },
      data: { status: body.status },
    });
  }

  @Delete('quotes/:id')
  async deleteQuote(
    @Param('id') id: string,
    @Req() req: { user: { role: string; systemRole?: string; email: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    return this.prisma.quote.delete({
      where: { id }
    });
  }

  // ─── NOUVEAU : FACTURES & TRANSACTIONS ──────────────────────────────────────

  @Put('invoices/:id/cancel')
  async cancelInvoice(
    @Param('id') id: string,
    @Req() req: { user: { role: string; systemRole?: string; email: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'Annulée' }
    });
  }

  @Get('invoices')
  async getInvoices(
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    return this.prisma.invoice.findMany({
      include: { plan: true, tenant: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    return this.prisma.transaction.findMany({
      include: { tenant: true, invoice: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  @Post('invoices/:id/pdf')
  async downloadInvoicePdf(
    @Param('id') id: string,
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } },
    @Body() body: TestInvoiceGenerationDto,
    @Res() res: any // Utilise Response
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { plan: true, tenant: true }
    });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    
    const { PdfGenerator } = require('./pdf-generator');
    return PdfGenerator.generateInvoicePdf(res, invoice, body.generatorUser || req.user.email);
  }

  @Post('reports/consolidated-pdf')
  async downloadConsolidatedReport(
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } },
    @Body() body: GenerateInvoicesPeriodDto,
    @Res() res: any
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    
    const start = body.startDate ? new Date(body.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = body.endDate ? new Date(body.endDate) : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: 'PAID'
      },
      include: { plan: true, tenant: true },
      orderBy: { createdAt: 'asc' }
    });

    const periodLabel = `${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;
    const { PdfGenerator } = require('./pdf-generator');
    return PdfGenerator.generateConsolidatedReportPdf(res, invoices, periodLabel, body.generatorUser || req.user.email);
  }

  // ─── NOUVEAU : STATISTIQUES AVANCÉES ────────────────────────────────────────

  @Get('stats-usage')
  async getQuotaUsageStats(
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    
    // Calculer les taux d'utilisation moyens des quotas d'actifs par plan
    const starterPlan = await this.prisma.plan.findUnique({ where: { name: 'Starter' } });
    const businessPlan = await this.prisma.plan.findUnique({ where: { name: 'Business' } });
    const enterprisePlan = await this.prisma.plan.findUnique({ where: { name: 'Enterprise' } });

    const getAverageUsage = async (planId: string | null) => {
      if (!planId) return 0;
      const tenants = await this.prisma.tenant.findMany({ where: { planId } });
      if (tenants.length === 0) return 0;

      let totalPct = 0;
      for (const t of tenants) {
        const assetCount = await this.prisma.asset.count({ where: { tenantId: t.id } });
        const sub = await this.prisma.subscription.findFirst({ where: { tenantId: t.id }, orderBy: { createdAt: 'desc' } });
        const quota = sub?.quotaAssets ?? 100;
        totalPct += (assetCount / quota) * 100;
      }
      return Math.round(totalPct / tenants.length);
    };

    return {
      starterAverageUsage: await getAverageUsage(starterPlan?.id || null),
      businessAverageUsage: await getAverageUsage(businessPlan?.id || null),
      enterpriseAverageUsage: await getAverageUsage(enterprisePlan?.id || null),
    };
  }

  @Get('cohorts')
  async getCohortStats(
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin', 'Finance']);
    
    // Cohorte simplifiée de rétention sur les 4 derniers mois
    const now = new Date();
    const months = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(); d.setMonth(now.getMonth() - i);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    const cohorts = await Promise.all(
      months.map(async (m) => {
        const start = new Date(m.year, m.month, 1);
        const end = new Date(m.year, m.month + 1, 0, 23, 59, 59);

        // Nombre de nouveaux abonnés inscrits ce mois-là (Cohorte de départ)
        const initialTenants = await this.prisma.tenant.findMany({
          where: { createdAt: { gte: start, lte: end } }
        });

        if (initialTenants.length === 0) {
          return {
            cohort: `${start.toLocaleString('fr-FR', { month: 'long' })} ${m.year}`,
            size: 0,
            retention: [0, 0, 0]
          };
        }

        const initialIds = initialTenants.map(t => t.id);

        // Calculer la rétention sur M+1, M+2, M+3
        const getRetainedCount = async (offsetMonths: number) => {
          const checkDate = new Date(m.year, m.month + offsetMonths + 1, 0);
          const activeSubscriptions = await this.prisma.subscription.count({
            where: {
              tenantId: { in: initialIds },
              status: 'ACTIVE',
              createdAt: { lte: checkDate }
            }
          });
          return activeSubscriptions;
        };

        const size = initialTenants.length;
        const m1 = await getRetainedCount(1);
        const m2 = await getRetainedCount(2);

        return {
          cohort: `${start.toLocaleString('fr-FR', { month: 'long' })} ${m.year}`,
          size,
          retention: [
            100, // M0 = 100%
            Math.round((m1 / size) * 100) || 100, // M1
            Math.round((m2 / size) * 100) || 100  // M2
          ]
        };
      })
    );

    return cohorts.reverse();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GESTION DES COLLABORATEURS SAAS (CONSOLE)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('collaborators/list')
  async listCollaborators(@Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    return this.prisma.user.findMany({
      where: { tenantId: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        systemRole: true,
        status: true,
        entryDate: true,
      },
      orderBy: { entryDate: 'desc' },
    });
  }

  @Post('collaborators')
  async createCollaborator(
    @Body() body: SuperAdminCreateUserDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    
    const existingUser = await this.prisma.user.findFirst({
      where: { email: body.email.toLowerCase(), tenantId: null },
    });
    if (existingUser) {
      throw new ForbiddenException('Un collaborateur avec cet email existe déjà sur la console.');
    }

    const clearPassword = body.password || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(clearPassword, 12);

    const newUser = await this.prisma.user.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email.toLowerCase(),
        password: hashedPassword,
        role: 'ADMIN',
        systemRole: body.systemRole,
        entryDate: new Date(),
        status: 'Actif',
      },
      select: { id: true, firstName: true, lastName: true, email: true, systemRole: true }
    });

    this._logAction(req.user, 'CREATION_COLLABORATEUR', 'User', newUser.id, newUser);

    return { message: 'Collaborateur créé', user: newUser, tempPassword: clearPassword };
  }

  @Put('collaborators/:id')
  async updateCollaborator(
    @Param('id') id: string,
    @Body() body: SuperAdminUpdateUserDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    const userToUpdate = await this.prisma.user.findUnique({ where: { id } });
    if (!userToUpdate || userToUpdate.tenantId !== null) {
      throw new NotFoundException('Collaborateur introuvable.');
    }
    if (userToUpdate.email.toLowerCase() === req.user.email.toLowerCase()) {
      throw new ForbiddenException('Impossible de modifier votre propre compte depuis la console.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        systemRole: body.systemRole,
        status: body.status,
      },
      select: { id: true, firstName: true, lastName: true, email: true, systemRole: true, status: true }
    });

    this._logAction(req.user, 'MODIFICATION_COLLABORATEUR', 'User', id, updated);

    return { message: 'Collaborateur mis à jour', user: updated };
  }

  @Delete('collaborators/:id')
  async deleteCollaborator(
    @Param('id') id: string,
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    const userToDelete = await this.prisma.user.findUnique({ where: { id } });
    if (!userToDelete || userToDelete.tenantId !== null) {
      throw new NotFoundException('Collaborateur introuvable.');
    }
    if (userToDelete.email.toLowerCase() === req.user.email.toLowerCase()) {
      throw new ForbiddenException('Impossible de supprimer votre propre compte.');
    }

    await this.prisma.user.delete({ where: { id } });
    this._logAction(req.user, 'SUPPRESSION_COLLABORATEUR', 'User', id, undefined, userToDelete);
    return { message: 'Collaborateur supprimé avec succès.' };
  }

  /**
   * PURGE : Récupère les locataires inactifs éligibles à la purge
   * Critère : status = 'TRIAL' ET date de création > 29 jours
   */
  @Get('purgeable')
  async getPurgeableTenants(
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 29);

    const purgeableTenants = await this.prisma.tenant.findMany({
      where: {
        status: 'TRIAL',
        createdAt: {
          lt: cutoffDate,
        },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return purgeableTenants;
  }

  /**
   * PURGE : Supprime définitivement une liste de locataires et toutes leurs données
   */
  /**
   * Purge complète d'un locataire (Super-Admin uniquement)
   * Génère d'abord une sauvegarde complète JSON locale, puis supprime définitivement toutes les données en cascade.
   */
  @Delete(':id/purge')
  async purgeTenantWithBackup(
    @Param('id') tenantId: string,
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Locataire introuvable.');
    }

    // 1. Sauvegarde des données
    const backupData = {
      tenant,
      assets: await this.prisma.asset.findMany({ where: { tenantId } }),
      users: await this.prisma.user.findMany({ where: { tenantId } }),
      auditLogs: await this.prisma.auditLog.findMany({ where: { tenantId } }),
      transactions: await this.prisma.transaction.findMany({ where: { tenantId } }),
      invoices: await this.prisma.invoice.findMany({ where: { tenantId } }),
      quotes: await this.prisma.quote.findMany({ where: { tenantId } }),
      subscriptions: await this.prisma.subscription.findMany({ where: { tenantId } }),
      ticketComments: await this.prisma.ticketComment.findMany({ where: { tenantId } }),
      tickets: await this.prisma.ticket.findMany({ where: { tenantId } }),
      assetHistories: await this.prisma.assetHistory.findMany({ where: { tenantId } }),
      movements: await this.prisma.movement.findMany({ where: { tenantId } }),
      maintenances: await this.prisma.maintenance.findMany({ where: { tenantId } }),
      depreciations: await this.prisma.depreciation.findMany({ where: { tenantId } }),
      consumables: await this.prisma.consumable.findMany({ where: { tenantId } }),
      licenses: await this.prisma.license.findMany({ where: { tenantId } }),
      contracts: await this.prisma.contract.findMany({ where: { tenantId } }),
      purchaseOrders: await this.prisma.purchaseOrder.findMany({ where: { tenantId } }),
      suppliers: await this.prisma.supplier.findMany({ where: { tenantId } }),
      locations: await this.prisma.location.findMany({ where: { tenantId } }),
      departments: await this.prisma.department.findMany({ where: { tenantId } }),
      onboardings: await this.prisma.onboarding.findMany({ where: { tenantId } }),
      sales: await this.prisma.sale.findMany({ where: { tenantId } }),
      kbArticles: await this.prisma.kBArticle.findMany({ where: { tenantId } }),
      leaveRequests: await this.prisma.leaveRequest.findMany({ where: { tenantId } }),
      tenantPaymentMethods: await this.prisma.tenantPaymentMethod.findMany({ where: { tenantId } }),
      tenantInvoices: await this.prisma.tenantInvoice.findMany({ where: { tenantId } }),
      tenantInvoiceSequences: await this.prisma.tenantInvoiceSequence.findMany({ where: { tenantId } }),
    };

    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const backupDir = path.join(os.tmpdir(), 'itam-tenants-backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `tenant_${tenant.subdomain}_${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    // 2. Suppression en cascade complète
    const tId = tenantId;
    await this._cascadeDeleteTenantData(tId);

    this._logAction(req.user, 'PURGE_MANUELLE_ABONNE', 'Tenant', tId, undefined, { deleted: true, backupPath });

    return { 
      message: `L'abonné ${tenant.name} a été purgé définitivement.`,
      backupFile: backupFilename,
      backupPath
    };
  }

  /**
   * Helper privé exécutant la suppression en cascade exhaustive de toutes les entités liées à un tenant
   */
  private async _cascadeDeleteTenantData(tId: string) {
    // 1. Logs, Analytics, Reminders
    await this.prisma.auditLog.deleteMany({ where: { tenantId: tId } });
    await this.prisma.transaction.deleteMany({ where: { tenantId: tId } });
    await this.prisma.invoice.deleteMany({ where: { tenantId: tId } });
    await this.prisma.quote.deleteMany({ where: { tenantId: tId } });
    await this.prisma.subscription.deleteMany({ where: { tenantId: tId } });
    await this.prisma.subscriptionReminderLog.deleteMany({ where: { tenantId: tId } });
    await this.prisma.pageView.deleteMany({ where: { tenantId: tId } });

    // 2. Paiements & Facturation DGI Tenant
    await this.prisma.tenantInvoice.deleteMany({ where: { tenantId: tId } });
    await this.prisma.tenantInvoiceSequence.deleteMany({ where: { tenantId: tId } });
    await this.prisma.tenantPaymentMethod.deleteMany({ where: { tenantId: tId } });

    // 3. RH & Support
    await this.prisma.leaveRequest.deleteMany({ where: { tenantId: tId } });
    await this.prisma.ticketComment.deleteMany({ where: { tenantId: tId } });
    await this.prisma.ticket.deleteMany({ where: { tenantId: tId } });

    // 4. Actifs, Mouvements, Dépréciations, Maintenances
    await this.prisma.assetHistory.deleteMany({ where: { tenantId: tId } });
    await this.prisma.movement.deleteMany({ where: { tenantId: tId } });
    await this.prisma.maintenance.deleteMany({ where: { tenantId: tId } });
    await this.prisma.depreciation.deleteMany({ where: { tenantId: tId } });
    await this.prisma.asset.deleteMany({ where: { tenantId: tId } });

    // 5. Consommables, Licences, Contrats, Achats, Ventes, Connaissances
    await this.prisma.consumable.deleteMany({ where: { tenantId: tId } });
    await this.prisma.license.deleteMany({ where: { tenantId: tId } });
    await this.prisma.contract.deleteMany({ where: { tenantId: tId } });
    await this.prisma.purchaseOrder.deleteMany({ where: { tenantId: tId } });
    await this.prisma.supplier.deleteMany({ where: { tenantId: tId } });
    await this.prisma.onboarding.deleteMany({ where: { tenantId: tId } });
    await this.prisma.sale.deleteMany({ where: { tenantId: tId } });
    await this.prisma.kBArticle.deleteMany({ where: { tenantId: tId } });

    // 6. Utilisateurs, Départements, Emplacements
    await this.prisma.user.deleteMany({ where: { tenantId: tId } });
    await this.prisma.department.deleteMany({ where: { tenantId: tId } });
    await this.prisma.location.deleteMany({ where: { tenantId: tId } });

    // 7. Supprimer le Tenant
    await this.prisma.tenant.delete({ where: { id: tId } });
  }

  @Post('purge-inactive')
  async purgeInactiveTenants(
    @Body('tenantIds') tenantIds: string[],
    @Req() req: { user: { role: string; systemRole?: string; email: string; tenantId?: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new BadRequestException('Aucun locataire sélectionné pour la purge.');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 29);

    const tenantsToDelete = await this.prisma.tenant.findMany({
      where: {
        id: { in: tenantIds },
        status: 'TRIAL',
        createdAt: { lt: cutoffDate },
      },
      select: { id: true, subdomain: true },
    });

    const validTenantIds = tenantsToDelete.map(t => t.id);

    if (validTenantIds.length === 0) {
      return { message: 'Aucun locataire éligible trouvé parmi la sélection.' };
    }

    // Suppression en cascade complète (ordre respectueux des FK)
    for (const tId of validTenantIds) {
      await this._cascadeDeleteTenantData(tId);
      this._logAction(req.user, 'PURGE_LOCATAIRE', 'Tenant', tId, undefined, { deleted: true, reason: 'Inactive trial' });
    }

    return { 
      message: `${validTenantIds.length} locataire(s) ont été purgés avec succès.`,
      purgedIds: validTenantIds 
    };
  }

  /**
   * Réinitialise le mot de passe d'un abonné sans procédure de récupération self-service.
   */
  @Post('reset-no-recovery')
  async resetNoRecovery(
    @Body() body: { targetUserId: string; reason: string },
    @Req() req: any
  ) {
    this._checkConsoleAccess(req.user);
    
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: body.targetUserId },
          {
            tenantId: body.targetUserId,
            role: 'ADMIN',
          },
          {
            tenantId: body.targetUserId,
          }
        ]
      },
      include: { tenant: true }
    });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable. Aucun utilisateur n'est associé à cet abonné ou cet identifiant.");
    }

    // Générer et enregistrer l'OTP
    const otp = await this.authService.generateAndStoreOtp(user.id);
    
    // Envoyer l'email avec le code OTP de récupération
    const subject = "[KPSyDesk] Réinitialisation de sécurité de votre compte";
    const text = `Bonjour ${user.firstName},\n\nLe Super-Administrateur SaaS a initié une procédure de réinitialisation de votre mot de passe (Motif : ${body.reason}).\n\nVotre code OTP de sécurité est : ${otp}\nIl est valable 15 minutes.\n\nUtilisez ce code sur la page de récupération pour définir votre nouveau mot de passe.`;
    const html = `<p>Bonjour <b>${user.firstName}</b>,</p>
<p>Le Super-Administrateur SaaS a initié une procédure de réinitialisation de votre mot de passe suite à votre demande (Motif : <i>${body.reason}</i>).</p>
<p>Votre code OTP de récupération est : <b style="font-size:1.5rem;color:#d97706;letter-spacing:4px;">${otp}</b></p>
<p>Il est valable 15 minutes.</p>
<p>Rendez-vous sur la page de récupération de mot de passe de votre tenant pour finaliser l'opération.</p>`;

    await this.mailService.sendMail(user.email, subject, text, html);

    // Log SaaS action
    this._logAction(req.user, 'RESET_NO_RECOVERY', 'User', user.id, { reason: body.reason });

    return { message: "Lien de réinitialisation envoyé avec succès." };
  }

  /**
   * Affecte manuellement un plan à un locataire (SaaS Super Admin)
   */
  @Put('assign-plan/:id')
  async assignPlan(
    @Param('id') id: string,
    @Body() body: AssignPlanDto,
    @Req() req: { user: { role: string; systemRole?: string; email: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { plan: true }
    });
    if (!tenant) {
      throw new NotFoundException("Locataire introuvable.");
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: body.planId }
    });
    if (!plan) {
      throw new NotFoundException("Plan introuvable.");
    }

    // Calculer la date de fin d'activation
    const endDate = new Date();
    const months = body.durationMonths || (body.billingInterval === 'YEARLY' ? 12 : 1);
    endDate.setMonth(endDate.getMonth() + months);

    // Mettre à jour le plan du tenant et son statut
    await this.prisma.tenant.update({
      where: { id },
      data: {
        planId: plan.id,
        status: 'ACTIVE'
      }
    });

    // Annuler les abonnements actifs précédents
    await this.prisma.subscription.updateMany({
      where: { tenantId: id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      data: { status: 'CANCELLED', endDate: new Date() }
    });

    // Créer le nouvel abonnement actif affecté manuellement
    const newSub = await this.prisma.subscription.create({
      data: {
        tenantId: id,
        planId: plan.id,
        status: 'ACTIVE',
        billingInterval: body.billingInterval,
        startDate: new Date(),
        endDate: endDate,
        quotaAssets: plan.quotaAssets,
      }
    });

    // Logger l'action dans le journal d'audit global
    this._logAction(req.user, 'MANUAL_ASSIGN_PLAN', 'Tenant', id, { planId: plan.id, billingInterval: body.billingInterval, durationMonths: months });

    return {
      message: `Le plan "${plan.name}" a été affecté manuellement au locataire "${tenant.name}" avec succès.`,
      subscription: newSub
    };
  }

  /**
   * Enregistrer une visite / page vue (Public)
   */
  @Post('analytics/track')
  @Public()
  async trackPageView(
    @Body() body: { path: string; referrer?: string; tenantId?: string },
    @Req() req: any
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.prisma.pageView.create({
      data: {
        tenantId: body.tenantId || null,
        ip: Array.isArray(ip) ? ip[0] : (ip as string || null),
        userAgent: userAgent || null,
        path: body.path,
        referrer: body.referrer || null,
      },
    });

    return { success: true };
  }

  /**
   * Récupérer toutes les statistiques d'audience pour le tableau de bord SaaS (Super Admin)
   */
  @Get('analytics/stats')
  async getAnalyticsStats(
    @Req() req: { user: { role: string; systemRole?: string; email: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    // 1. Nombre total de pages vues
    const totalPageViews = await this.prisma.pageView.count();

    // 2. Visiteurs uniques totaux (basé sur l'IP)
    const uniqueIPs = await this.prisma.pageView.groupBy({
      by: ['ip'],
    });
    const totalUniqueVisitors = uniqueIPs.length;

    // 3. Pages vues aujourd'hui
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const pageViewsToday = await this.prisma.pageView.count({
      where: {
        createdAt: { gte: startOfToday }
      }
    });

    // 4. Visiteurs uniques aujourd'hui
    const uniqueIPsToday = await this.prisma.pageView.groupBy({
      by: ['ip'],
      where: {
        createdAt: { gte: startOfToday }
      }
    });
    const uniqueVisitorsToday = uniqueIPsToday.length;

    // 5. Pages les plus visitées (Top 10)
    const topPagesRaw = await this.prisma.pageView.groupBy({
      by: ['path'],
      _count: {
        path: true
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

    // 6. Répartition des visiteurs par locataire (Top 10)
    const tenantShareRaw = await this.prisma.pageView.groupBy({
      by: ['tenantId'],
      _count: {
        tenantId: true
      },
      orderBy: {
        _count: {
          tenantId: 'desc'
        }
      }
    });
    
    // Récupérer les noms des tenants
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true }
    });
    const tenantMap = new Map(tenants.map(t => [t.id, t.name]));
    
    const tenantShare = tenantShareRaw.map(t => ({
      tenantName: t.tenantId ? (tenantMap.get(t.tenantId) || t.tenantId) : 'Portail Public / SaaS',
      count: t._count.tenantId
    }));

    // 7. Évolution quotidienne (30 derniers jours)
    const dailyStats = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const views = await this.prisma.pageView.count({
        where: {
          createdAt: { gte: start, lte: end }
        }
      });

      const ips = await this.prisma.pageView.groupBy({
        by: ['ip'],
        where: {
          createdAt: { gte: start, lte: end }
        }
      });

      const dayName = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date);
      dailyStats.push({
        date: dayName,
        pageViews: views,
        uniqueVisitors: ips.length
      });
    }

    // 8. Répartition par navigateurs / OS (simplifié à partir du UserAgent)
    const userAgents = await this.prisma.pageView.findMany({
      select: { userAgent: true },
      take: 1000 // Échantillon récent
    });

    const browserCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};

    userAgents.forEach(ua => {
      const str = (ua.userAgent || '').toLowerCase();
      
      // Navigateur
      let browser = 'Autre';
      if (str.includes('firefox')) browser = 'Firefox';
      else if (str.includes('chrome') && !str.includes('chromium')) browser = 'Chrome';
      else if (str.includes('safari') && !str.includes('chrome')) browser = 'Safari';
      else if (str.includes('edge')) browser = 'Edge';
      
      browserCounts[browser] = (browserCounts[browser] || 0) + 1;

      // Appareil
      let device = 'Bureau';
      if (str.includes('iphone') || str.includes('ipad') || str.includes('android')) device = 'Mobile/Tablette';
      
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });

    const devices = Object.keys(deviceCounts).map(name => ({ name, count: deviceCounts[name] }));
    const browsers = Object.keys(browserCounts).map(name => ({ name, count: browserCounts[name] }));

    // 9. Pages vues externes (public) vs internes (app)
    const viewsPublic = await this.prisma.pageView.count({
      where: { path: { startsWith: '/public' } }
    });
    const viewsApp = await this.prisma.pageView.count({
      where: { path: { startsWith: '/app' } }
    });

    // 10. Principaux Referrers (Sites d'origine)
    const referrersRaw = await this.prisma.pageView.groupBy({
      by: ['referrer'],
      _count: {
        referrer: true
      },
      where: {
        referrer: {
          not: { in: ['', 'null'] }
        }
      },
      orderBy: {
        _count: {
          referrer: 'desc'
        }
      },
      take: 10
    });
    const topReferrers = referrersRaw
      .filter(r => r.referrer !== null)
      .map(r => ({
        referrer: r.referrer,
        count: r._count.referrer
      }));

    // 11. Journal des 15 dernières visites en temps réel
    const recentVisitsRaw = await this.prisma.pageView.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15
    });
    
    const recentVisits = recentVisitsRaw.map(v => {
      const tenantName = v.tenantId ? (tenantMap.get(v.tenantId) || v.tenantId) : 'Portail Public';
      
      // Parse User-Agent simple pour affichage
      const ua = (v.userAgent || '').toLowerCase();
      let browser = 'Autre';
      if (ua.includes('firefox')) browser = 'Firefox';
      else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
      else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
      else if (ua.includes('edge')) browser = 'Edge';

      let device = 'Bureau';
      if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('android')) device = 'Mobile';

      return {
        id: v.id,
        createdAt: v.createdAt,
        path: v.path,
        ip: v.ip || 'Inconnue',
        browser,
        device,
        referrer: v.referrer || 'Accès Direct',
        tenantName
      };
    });

    return {
      summary: {
        totalPageViews,
        totalUniqueVisitors,
        pageViewsToday,
        uniqueVisitorsToday,
        avgPageViewsPerVisitor: parseFloat((totalPageViews / (totalUniqueVisitors || 1)).toFixed(1))
      },
      publicVsApp: {
        public: viewsPublic,
        app: viewsApp
      },
      topPages,
      tenantShare,
      topReferrers,
      recentVisits,
      dailyStats,
      devices,
      browsers
    };
  }

  /**
   * Déclencher manuellement la purge des visites de plus de 90 jours (Tests et Conformité)
   */
  @Post('analytics/purge-test')
  async triggerPurgeTest(
    @Req() req: { user: { role: string; systemRole?: string; email: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);
    
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleteResult = await this.prisma.pageView.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    return {
      success: true,
      purgedCount: deleteResult.count,
      message: `Purged entries older than ${cutoffDate.toISOString()}`
    };
  }

  /**
   * Exécuter un audit de sécurité (npm audit) en temps réel sur backend et frontend
   */
  @Post('security-audit')
  async runSecurityAudit(
    @Req() req: { user: { role: string; systemRole?: string; email: string } }
  ) {
    this._checkConsoleAccess(req.user, ['SuperAdmin']);

    let backendAudit: any = {};
    let frontendAudit: any = {};

    // 1. Audit Backend
    try {
      const { stdout } = await execPromise('npm audit --json', { cwd: './backend' });
      backendAudit = JSON.parse(stdout);
    } catch (error: any) {
      if (error.stdout) {
        try {
          backendAudit = JSON.parse(error.stdout);
        } catch (e) {
          backendAudit = { error: 'Failed to parse backend audit json', details: error.message };
        }
      } else {
        backendAudit = { error: 'Backend audit execution failed', details: error.message };
      }
    }

    // 2. Audit Frontend
    try {
      const { stdout } = await execPromise('npm audit --json', { cwd: './frontend' });
      frontendAudit = JSON.parse(stdout);
    } catch (error: any) {
      if (error.stdout) {
        try {
          frontendAudit = JSON.parse(error.stdout);
        } catch (e) {
          frontendAudit = { error: 'Failed to parse frontend audit json', details: error.message };
        }
      } else {
        frontendAudit = { error: 'Frontend audit execution failed', details: error.message };
      }
    }

    const formatVulnerabilities = (vulnsObj: any) => {
      if (!vulnsObj) return [];
      return Object.keys(vulnsObj).map(key => {
        const v = vulnsObj[key];
        return {
          name: v.name || key,
          severity: v.severity,
          range: v.range,
          via: Array.isArray(v.via) ? v.via.map((item: any) => typeof item === 'object' ? item.name || 'unknown' : item) : [v.via],
          fixAvailable: v.fixAvailable,
        };
      });
    };

    return {
      success: true,
      timestamp: new Date().toISOString(),
      backend: {
        metadata: backendAudit['metadata'] || { vulnerabilities: { low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
        vulnerabilities: formatVulnerabilities(backendAudit['vulnerabilities']),
      },
      frontend: {
        metadata: frontendAudit['metadata'] || { vulnerabilities: { low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
        vulnerabilities: formatVulnerabilities(frontendAudit['vulnerabilities']),
      }
    };
  }
}
