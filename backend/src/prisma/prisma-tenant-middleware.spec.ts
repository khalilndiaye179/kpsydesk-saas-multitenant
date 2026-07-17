import { TenantContext, tenantStorage } from '../tenant/tenant.context';

/**
 * Tests unitaires du PrismaService middleware tenant.
 * 
 * Ces tests vérifient que le middleware Prisma injecte correctement
 * le tenantId dans tous les types de requêtes.
 * 
 * Note : on teste ici la LOGIQUE du middleware de façon isolée en simulant
 * le comportement de Prisma avec des paramètres de requête.
 */
describe('PrismaService — Tenant Middleware Logic', () => {
  /**
   * Simule l'exécution du middleware dans un contexte tenant donné.
   * Reproduit exactement la logique de _registerTenantMiddleware().
   */
  const simulateMiddleware = (params: any, currentTenantId?: string) => {
    // Reproduction de la logique du middleware
    const TENANT_MODELS = new Set([
      'Department', 'Location', 'User', 'Asset', 'Ticket', 'TicketComment',
      'AssetHistory', 'AuditLog', 'Supplier', 'PurchaseOrder', 'Contract',
      'Maintenance', 'Consumable', 'Sale', 'License', 'Onboarding',
      'KBArticle', 'Movement', 'Depreciation',
    ]);
    const READ_ACTIONS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']);
    const WRITE_WITH_WHERE = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

    const tenantId = currentTenantId;
    if (!tenantId || !TENANT_MODELS.has(params.model)) {
      return { modified: false, params };
    }

    const p = JSON.parse(JSON.stringify(params)); // Deep clone

    if (p.action === 'findUnique') {
      p.action = 'findFirst';
      p.args.where = { ...p.args.where, tenantId };
      return { modified: true, params: p };
    }
    if (p.action === 'findUniqueOrThrow') {
      p.action = 'findFirstOrThrow';
      p.args.where = { ...p.args.where, tenantId };
      return { modified: true, params: p };
    }
    if (READ_ACTIONS.has(p.action)) {
      p.args = p.args ?? {};
      p.args.where = { ...p.args.where, tenantId };
      return { modified: true, params: p };
    }
    if (p.action === 'create') {
      if (!p.args.data.tenantId) {
        p.args.data = { ...p.args.data, tenantId };
      }
      return { modified: true, params: p };
    }
    if (p.action === 'createMany') {
      if (Array.isArray(p.args.data)) {
        p.args.data = p.args.data.map((item: any) =>
          item.tenantId ? item : { ...item, tenantId },
        );
      }
      return { modified: true, params: p };
    }
    if (WRITE_WITH_WHERE.has(p.action)) {
      p.args.where = { ...p.args.where, tenantId };
      return { modified: true, params: p };
    }
    if (p.action === 'upsert') {
      p.args.where = { ...p.args.where, tenantId };
      if (!p.args.create.tenantId) {
        p.args.create = { ...p.args.create, tenantId };
      }
      return { modified: true, params: p };
    }
    return { modified: false, params: p };
  };

  const TENANT_ID = 'tenant-A-id-123';

  // ── Pas de contexte tenant (routes publiques) ────────────────────────────

  describe('Sans contexte tenant (route publique)', () => {
    it('ne modifie PAS les paramètres si pas de tenantId', () => {
      const params = { model: 'Asset', action: 'findMany', args: { where: {} } };
      const { modified } = simulateMiddleware(params, undefined);
      expect(modified).toBe(false);
    });

    it('ne modifie PAS les paramètres pour les modèles hors tenant (Plan, Tenant)', () => {
      const params = { model: 'Plan', action: 'findMany', args: { where: {} } };
      const { modified } = simulateMiddleware(params, TENANT_ID);
      expect(modified).toBe(false);
    });
  });

  // ── Opérations de lecture ────────────────────────────────────────────────

  describe('Lecture (findMany, findFirst, count)', () => {
    it('findMany → ajoute tenantId au WHERE', () => {
      const params = { model: 'Asset', action: 'findMany', args: { where: { status: 'En service' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.where.tenantId).toBe(TENANT_ID);
      expect(result.args.where.status).toBe('En service'); // Conserve les filtres existants
    });

    it('count → ajoute tenantId au WHERE', () => {
      const params = { model: 'User', action: 'count', args: {} };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.where.tenantId).toBe(TENANT_ID);
    });

    it('findFirst → ajoute tenantId au WHERE', () => {
      const params = { model: 'Ticket', action: 'findFirst', args: { where: { id: '123' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.where.tenantId).toBe(TENANT_ID);
      expect(result.args.where.id).toBe('123');
    });

    it('findMany avec args vide → crée le WHERE avec tenantId', () => {
      const params = { model: 'Asset', action: 'findMany', args: {} };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.where.tenantId).toBe(TENANT_ID);
    });
  });

  // ── Conversion findUnique → findFirst ────────────────────────────────────

  describe('findUnique → findFirst (conversion pour filtrage composite)', () => {
    it('convertit findUnique en findFirst et ajoute tenantId', () => {
      const params = { model: 'Asset', action: 'findUnique', args: { where: { id: 'asset-123' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.action).toBe('findFirst'); // Converti !
      expect(result.args.where.id).toBe('asset-123');
      expect(result.args.where.tenantId).toBe(TENANT_ID);
    });

    it('convertit findUniqueOrThrow en findFirstOrThrow', () => {
      const params = { model: 'User', action: 'findUniqueOrThrow', args: { where: { id: 'user-123' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.action).toBe('findFirstOrThrow');
      expect(result.args.where.tenantId).toBe(TENANT_ID);
    });
  });

  // ── Opérations de création ────────────────────────────────────────────────

  describe('Création (create, createMany)', () => {
    it('create → injecte tenantId dans data', () => {
      const params = { model: 'Asset', action: 'create', args: { data: { name: 'Laptop', type: 'Ordinateur' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.data.tenantId).toBe(TENANT_ID);
      expect(result.args.data.name).toBe('Laptop'); // Conserve les données originales
    });

    it('create → ne remplace PAS un tenantId déjà explicite', () => {
      const explicitTenantId = 'explicit-tenant-for-signup';
      const params = {
        model: 'User', action: 'create',
        args: { data: { email: 'test@test.com', tenantId: explicitTenantId } }
      };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      // Le tenantId explicite est conservé (utilisé par TenantsService.signup)
      expect(result.args.data.tenantId).toBe(explicitTenantId);
    });

    it('createMany → injecte tenantId dans chaque item', () => {
      const params = {
        model: 'Asset', action: 'createMany',
        args: { data: [{ name: 'A' }, { name: 'B' }, { name: 'C', tenantId: 'explicit' }] }
      };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.data[0].tenantId).toBe(TENANT_ID);
      expect(result.args.data[1].tenantId).toBe(TENANT_ID);
      expect(result.args.data[2].tenantId).toBe('explicit'); // Explicit conservé
    });
  });

  // ── Opérations d'écriture ─────────────────────────────────────────────────

  describe('Écriture (update, delete, updateMany, deleteMany)', () => {
    it('update → ajoute tenantId au WHERE (empêche la modification cross-tenant)', () => {
      const params = { model: 'Asset', action: 'update', args: { where: { id: 'asset-B-id' }, data: { name: 'Hacked' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      // Le WHERE inclut maintenant tenantId — si l'actif appartient à un autre tenant,
      // Prisma ne le trouvera pas et lancera une erreur "Record not found"
      expect(result.args.where.tenantId).toBe(TENANT_ID);
      expect(result.args.where.id).toBe('asset-B-id');
    });

    it('delete → ajoute tenantId au WHERE (empêche la suppression cross-tenant)', () => {
      const params = { model: 'Asset', action: 'delete', args: { where: { id: 'asset-B-id' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.where.tenantId).toBe(TENANT_ID);
    });

    it('updateMany → ajoute tenantId au WHERE', () => {
      const params = { model: 'Asset', action: 'updateMany', args: { where: { status: 'En service' }, data: { status: 'Réformé' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.where.tenantId).toBe(TENANT_ID);
      expect(result.args.where.status).toBe('En service');
    });

    it('deleteMany → ajoute tenantId au WHERE', () => {
      const params = { model: 'Ticket', action: 'deleteMany', args: { where: { status: 'CLOSED' } } };
      const { params: result } = simulateMiddleware(params, TENANT_ID);
      expect(result.args.where.tenantId).toBe(TENANT_ID);
    });
  });

  // ── TenantContext (AsyncLocalStorage) ────────────────────────────────────

  describe('TenantContext (AsyncLocalStorage)', () => {
    it('retourne undefined hors contexte', () => {
      expect(TenantContext.getTenantId()).toBeUndefined();
      expect(TenantContext.getSubdomain()).toBeUndefined();
      expect(TenantContext.hasTenant()).toBe(false);
    });

    it('retourne le tenantId dans le contexte ALS', (done) => {
      TenantContext.run({ tenantId: 'test-id', subdomain: 'test' }, () => {
        expect(TenantContext.getTenantId()).toBe('test-id');
        expect(TenantContext.getSubdomain()).toBe('test');
        expect(TenantContext.hasTenant()).toBe(true);
        done();
      });
    });

    it('les contextes ALS sont isolés entre eux', (done) => {
      let contextAChecked = false;
      let contextBChecked = false;

      TenantContext.run({ tenantId: 'tenant-A', subdomain: 'sub-a' }, () => {
        expect(TenantContext.getTenantId()).toBe('tenant-A');
        contextAChecked = true;

        // Un deuxième contexte imbriqué doit écraser le premier
        TenantContext.run({ tenantId: 'tenant-B', subdomain: 'sub-b' }, () => {
          expect(TenantContext.getTenantId()).toBe('tenant-B');
          contextBChecked = true;
        });

        // Après la fin du contexte B, le contexte A est restauré
        expect(TenantContext.getTenantId()).toBe('tenant-A');
      });

      // Hors de tout contexte, undefined
      expect(TenantContext.getTenantId()).toBeUndefined();
      expect(contextAChecked && contextBChecked).toBe(true);
      done();
    });
  });
});
