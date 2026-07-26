import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../tenant/tenant.context';

/**
 * ============================================================================
 * ARCHITECTURE DE SÉCURITÉ MULTI-TENANT — COUCHE APPLICATIVE UNIQUEMENT
 * ============================================================================
 *
 * DÉCISION ARCHITECTURALE (2026-07-15) :
 *
 * L'isolation des données inter-tenant repose EXCLUSIVEMENT sur le filtre
 * applicatif Prisma (_registerTenantExtension). Le RLS PostgreSQL a été
 * intentionnellement retiré pour les raisons suivantes :
 *
 * PROBLÈME DIAGNOSTIQUÉ avec _registerRlsMiddleware :
 *   - `$executeRawUnsafe(set_config(..., false))` et `next(params)` sont deux
 *     appels réseau distincts. Rien ne garantit qu'ils utilisent la même
 *     connexion physique du pool Prisma.
 *   - Si le SET atterrit sur la connexion C1 et la requête Prisma sur C2,
 *     la connexion C2 porte le tenant_id de la REQUÊTE PRÉCÉDENTE → fuite.
 *   - `is_local = true` (SET LOCAL) aurait contraint la même transaction,
 *     mais Prisma hors transaction n'ouvre pas de transaction implicite
 *     durable entre le SET et la requête — il émet deux roundtrips réseau.
 *   - Le fix par $transaction() aurait fonctionné mais ajouté une
 *     transaction PostgreSQL par requête applicative (coût ~2-5ms/req).
 *
 * POURQUOI LA COUCHE APPLICATIVE SEULE EST SUFFISANTE :
 *   - _registerTenantExtension opère sur les `params` Prisma AVANT tout
 *     envoi réseau → le filtre WHERE tenantId est inclus dans la requête SQL
 *     générée par Prisma, dans le même appel réseau. Pas de split possible.
 *   - Les tests de charge (50 req parallèles, pool=2, throttler désactivé)
 *     + les tests d'isolation E2E (12 cas) valident cette approche.
 *   - Le RLS PostgreSQL restant avait une ouverture délibérée pour les
 *     migrations : `current_tenant_id() IS NULL → TOUT est visible`. Cette
 *     clause rendait le RLS contournable si set_config n'était pas posé →
 *     fausse sécurité.
 *
 * POUR RÉACTIVER LE RLS (défense en profondeur réelle avec transactions) :
 *   Voir rls-setup.sql + implémenter Option A (wrapping en $transaction).
 *   Non retenu ici pour éviter la dette technique sur $use déprécié et le
 *   surcoût transactionnel en production.
 *
 * RÉFÉRENCE : voir CONTRIBUTING.md section "Requêtes SQL Brutes".
 * ============================================================================
 */

/**
 * Ensemble des modèles Prisma qui portent une colonne `tenantId`.
 * Ces modèles seront automatiquement filtrés par tenant sur toutes les opérations.
 * Les modèles Plan, Tenant, Subscription sont EXCLUS car ils sont transversaux.
 */
const TENANT_MODELS = new Set([
  'Department',
  'Location',
  'User',
  'Asset',
  'Ticket',
  'TicketComment',
  'AssetHistory',
  'AuditLog',
  'Supplier',
  'PurchaseOrder',
  'Contract',
  'Maintenance',
  'Consumable',
  'Sale',
  'License',
  'Onboarding',
  'KBArticle',
  'Movement',
  'Depreciation',
]);

/** Opérations de lecture nécessitant le filtre WHERE tenantId */
const READ_ACTIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/** Opérations d'écriture nécessitant le filtre WHERE tenantId */
const WRITE_WITH_WHERE = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    this._registerTenantMiddleware();
    // NOTE : _registerRlsMiddleware() retiré intentionnellement — voir en-tête de fichier.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Middleware Prisma (API $use — supportée en Prisma 5, migration vers $extends
   * à planifier lors du passage à Prisma 6) qui injecte automatiquement `tenantId`
   * dans toutes les opérations sur les modèles métier, en lisant depuis l'AsyncLocalStorage.
   *
   * POURQUOI $use ET PAS $extends ENCORE :
   * $extends sur Prisma 5.22 nécessite de remplacer this.prisma par le client étendu
   * PARTOUT dans l'application (injection de dépendance à refactorer). Le ROI de cette
   * migration est positif mais hors scope du correctif de sécurité immédiat.
   * $use reste fonctionnel et supporté en Prisma 5 (dépréciation = avertissement, pas erreur).
   *
   * Sécurité :
   * - Lecture  → WHERE tenantId = <current>
   * - Création → DATA  tenantId = <current>  (n'écrase pas si déjà défini)
   * - Écriture → WHERE tenantId = <current>  (empêche la modification d'un autre tenant)
   * - findUnique converti en findFirst pour permettre le filtre tenantId composite
   */
  private _registerTenantMiddleware() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    (this as any).$use(async (params: any, next: any) => {
      const tenantId = TenantContext.getTenantId();

      // Pas de contexte tenant → route publique ou migrations → on laisse passer
      if (!tenantId) {
        return next(params);
      }

      // Appliquer les filtres récursivement sur tous les includes/selects relationnels de la requête
      if (params.args) {
        this._applyRecursiveTenantFilters(params.args, tenantId);
      }

      if (!TENANT_MODELS.has(params.model)) {
        return next(params);
      }

      // 🛑 Sécurité absolue : masquer les comptes Super-Admin/SaaS pour tous les abonnés
      if (params.model === 'User' && params.action !== 'create' && params.action !== 'createMany') {
        params.args = params.args ?? {};
        params.args.where = params.args.where ?? {};
        params.args.where = {
          ...params.args.where,
          NOT: {
            OR: [
              { tenantId: null },
              { systemRole: 'SuperAdmin' }
            ]
          },
        };
      }

      // ── findUnique / findUniqueOrThrow ──────────────────────────────────
      // Prisma exige un champ unique isolé pour findUnique.
      // On le convertit en findFirst pour pouvoir ajouter tenantId au WHERE.
      if (params.action === 'findUnique') {
        params.action = 'findFirst';
        params.args.where = { ...params.args.where, tenantId };
        return next(params);
      }
      if (params.action === 'findUniqueOrThrow') {
        params.action = 'findFirstOrThrow';
        params.args.where = { ...params.args.where, tenantId };
        return next(params);
      }

      // ── Lectures (findMany, findFirst, count, aggregate, groupBy) ───────
      if (READ_ACTIONS.has(params.action)) {
        params.args = params.args ?? {};
        params.args.where = { ...params.args.where, tenantId };
        return next(params);
      }

      // ── Création (create) ───────────────────────────────────────────────
      if (params.action === 'create') {
        // Ne pas écraser si le service passe déjà un tenantId explicite
        if (!params.args.data.tenantId) {
          params.args.data = { ...params.args.data, tenantId };
        }
        return next(params);
      }

      // ── Création en masse (createMany) ──────────────────────────────────
      if (params.action === 'createMany') {
        if (Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map((item: any) =>
            item.tenantId ? item : { ...item, tenantId },
          );
        } else if (params.args.data && !params.args.data.tenantId) {
          params.args.data = { ...params.args.data, tenantId };
        }
        return next(params);
      }

      // ── Écriture avec WHERE (update, updateMany, delete, deleteMany) ────
      if (WRITE_WITH_WHERE.has(params.action)) {
        params.args.where = { ...params.args.where, tenantId };
        return next(params);
      }

      // ── Upsert ──────────────────────────────────────────────────────────
      if (params.action === 'upsert') {
        params.args.where = { ...params.args.where, tenantId };
        if (!params.args.create.tenantId) {
          params.args.create = { ...params.args.create, tenantId };
        }
        return next(params);
      }

      return next(params);
    });
  }

  private _applyRecursiveTenantFilters(obj: any, tenantId: string) {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
      if ((key === 'include' || key === 'select') && obj[key] && typeof obj[key] === 'object') {
        const relationObj = obj[key];
        for (const relName of Object.keys(relationObj)) {
          if (relationObj[relName]) {
            // Liste des relations to-many qui supportent l'argument 'where'
            const toManyRelations = new Set([
              'users',
              'assets',
              'tickets',
              'ticketComments',
              'kbArticles',
            ]);

            const isToMany = toManyRelations.has(relName);

            if (isToMany) {
              if (relationObj[relName] === true) {
                relationObj[relName] = { where: {} };
              } else if (typeof relationObj[relName] === 'object') {
                relationObj[relName].where = relationObj[relName].where ?? {};
              }

              // Dictionnaire des relations to-many vers leurs entités respectives
              const relationModelMap: Record<string, string> = {
                users: 'User',
                assets: 'Asset',
                tickets: 'Ticket',
                ticketComments: 'TicketComment',
                kbArticles: 'KBArticle',
              };

              const targetModel = relationModelMap[relName];
              if (targetModel) {
                relationObj[relName].where.tenantId = tenantId;

                if (targetModel === 'User') {
                  relationObj[relName].where.NOT = {
                    ...relationObj[relName].where.NOT,
                    OR: [
                      { tenantId: null },
                      { systemRole: 'SuperAdmin' }
                    ]
                  };
                }
              }
            }

            // Récursion pour descendre plus profondément dans l'arbre d'inclusion si c'est un objet
            if (typeof relationObj[relName] === 'object') {
              this._applyRecursiveTenantFilters(relationObj[relName], tenantId);
            }
          }
        }
      } else if (typeof obj[key] === 'object') {
        this._applyRecursiveTenantFilters(obj[key], tenantId);
      }
    }
  }
}
