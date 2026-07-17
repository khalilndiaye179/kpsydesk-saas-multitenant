import { TenantMiddleware } from './tenant.middleware';
import { tenantStorage } from './tenant.context';

/**
 * Tests unitaires du TenantMiddleware.
 * 
 * Vérifie la logique de résolution du tenant depuis la requête :
 * - Header X-Tenant-ID (développement / agent Windows)
 * - Sous-domaine HTTP (production)
 * - Routes publiques (pas de tenant)
 */
describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;

  // Mock du PrismaService pour les tests
  const mockPrismaService = {
    tenant: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const createMockRequest = (headers: Record<string, string>) => ({
    headers,
    tenantId: undefined as string | undefined,
    tenantSubdomain: undefined as string | undefined,
  });

  const createMockResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  };

  beforeEach(() => {
    middleware = new TenantMiddleware(mockPrismaService as any);
    jest.clearAllMocks();
  });

  // ── Résolution du sous-domaine ─────────────────────────────────────────────

  describe('_resolveSubdomain (logique interne)', () => {
    const resolveSubdomain = (headers: Record<string, string>): string | undefined => {
      // On accède à la méthode privée via le cast
      return (middleware as any)._resolveSubdomain({ headers });
    };

    it('doit résoudre depuis le header X-Tenant-ID', () => {
      expect(resolveSubdomain({ 'x-tenant-id': 'acme-corp' })).toBe('acme-corp');
    });

    it('doit normaliser le header en minuscules', () => {
      expect(resolveSubdomain({ 'x-tenant-id': 'AcMeCorp' })).toBe('acmecorp');
    });

    it('doit ignorer les espaces dans le header', () => {
      expect(resolveSubdomain({ 'x-tenant-id': '  acme-corp  ' })).toBe('acme-corp');
    });

    it('doit résoudre depuis le sous-domaine HTTP (3 segments)', () => {
      expect(resolveSubdomain({ host: 'acme.inventaire-parc.com' })).toBe('acme');
    });

    it('doit résoudre depuis le sous-domaine avec port', () => {
      expect(resolveSubdomain({ host: 'acme.inventaire-parc.com:3011' })).toBe('acme');
    });

    it('doit ignorer "www" comme sous-domaine', () => {
      expect(resolveSubdomain({ host: 'www.inventaire-parc.com' })).toBeUndefined();
    });

    it('doit retourner undefined si pas de sous-domaine (2 segments)', () => {
      expect(resolveSubdomain({ host: 'inventaire-parc.com' })).toBeUndefined();
    });

    it('doit retourner undefined si aucun header pertinent', () => {
      expect(resolveSubdomain({ 'content-type': 'application/json' })).toBeUndefined();
    });

    it('X-Tenant-ID a priorité sur le sous-domaine', () => {
      expect(resolveSubdomain({
        'x-tenant-id': 'header-tenant',
        host: 'subdomain-tenant.inventaire-parc.com',
      })).toBe('header-tenant');
    });
  });

  // ── Middleware complet ─────────────────────────────────────────────────────

  describe('use()', () => {
    it('doit appeler next() sans tenant si aucun sous-domaine résolu', async () => {
      const req = createMockRequest({ host: 'inventaire-parc.com' });
      const res = createMockResponse();
      const next = jest.fn();

      await middleware.use(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(mockPrismaService.tenant.findFirst).not.toHaveBeenCalled();
    });

    it('doit appeler next() si le tenant est trouvé et actif', async () => {
      const req = createMockRequest({ 'x-tenant-id': 'acme' });
      const res = createMockResponse();
      const next = jest.fn(() => {
        // Vérification que le contexte ALS est bien positionné
        const store = tenantStorage.getStore();
        expect(store?.tenantId).toBe('tenant-id-123');
        expect(store?.subdomain).toBe('acme');
      });

      mockPrismaService.tenant.findFirst.mockResolvedValue({
        id: 'tenant-id-123',
        status: 'ACTIVE',
        subdomain: 'acme',
      });

      await middleware.use(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.tenantId).toBe('tenant-id-123');
    });

    it('🔒 doit retourner 403 si le tenant est SUSPENDU', async () => {
      const req = createMockRequest({ 'x-tenant-id': 'suspended-corp' });
      const res = createMockResponse();
      const next = jest.fn();

      mockPrismaService.tenant.findFirst.mockResolvedValue({
        id: 'tenant-suspended',
        status: 'SUSPENDED',
        subdomain: 'suspended-corp',
      });

      await middleware.use(req as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    it('🔒 doit retourner 403 si le tenant est ANNULÉ', async () => {
      const req = createMockRequest({ 'x-tenant-id': 'cancelled-corp' });
      const res = createMockResponse();
      const next = jest.fn();

      mockPrismaService.tenant.findFirst.mockResolvedValue({
        id: 'tenant-cancelled',
        status: 'CANCELLED',
        subdomain: 'cancelled-corp',
      });

      await middleware.use(req as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('doit appeler next() sans tenant si le sous-domaine est inconnu', async () => {
      const req = createMockRequest({ 'x-tenant-id': 'unknown-tenant' });
      const res = createMockResponse();
      const next = jest.fn();

      mockPrismaService.tenant.findFirst.mockResolvedValue(null);

      await middleware.use(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.tenantId).toBeUndefined();
    });
  });
});
