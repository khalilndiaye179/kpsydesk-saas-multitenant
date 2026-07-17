import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

/**
 * Tests unitaires du TenantGuard.
 * 
 * Ces tests vérifient que le guard bloque correctement les accès
 * cross-tenant, même avec un JWT valide d'un autre tenant.
 */
describe('TenantGuard', () => {
  let guard: TenantGuard;

  const createMockContext = (user: any, tenantId?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          tenantId,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    const mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;
    guard = new TenantGuard(mockReflector);
  });

  // ── Cas nominaux ──────────────────────────────────────────────────────────

  it('doit autoriser si pas de contexte tenant (route publique)', () => {
    const ctx = createMockContext({ userId: 'u1', tenantId: 'tenant-A' }, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('doit autoriser si le tenantId JWT correspond au tenant de la requête', () => {
    const ctx = createMockContext(
      { userId: 'u1', tenantId: 'tenant-A' },
      'tenant-A',
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('doit autoriser un token legacy (sans tenantId) pour la rétrocompatibilité', () => {
    const ctx = createMockContext(
      { userId: 'legacy-user', tenantId: undefined },
      'tenant-A',
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── Cas de sécurité critiques ─────────────────────────────────────────────

  it('🔒 doit BLOQUER si le tenantId JWT ne correspond pas au tenant de la requête (accès cross-tenant)', () => {
    const ctx = createMockContext(
      { userId: 'user-from-A', tenantId: 'tenant-A' },
      'tenant-B', // L'utilisateur de A essaie d'accéder à B
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('🔒 doit BLOQUER si pas d\'utilisateur dans le contexte (requête non authentifiée)', () => {
    const ctx = createMockContext(undefined, 'tenant-A');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('🔒 doit BLOQUER avec un tenantId forgé différent', () => {
    // Simule un attaquant qui modifie son JWT pour changer le tenantId
    const ctx = createMockContext(
      { userId: 'attacker', tenantId: 'fake-tenant-id-XYZ' },
      'target-tenant-id',
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('🔒 doit BLOQUER même si les deux IDs sont des UUIDs valides mais différents', () => {
    const ctx = createMockContext(
      { userId: 'u1', tenantId: '550e8400-e29b-41d4-a716-446655440000' },
      '550e8400-e29b-41d4-a716-446655440001', // UUID différent d'un seul caractère
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
