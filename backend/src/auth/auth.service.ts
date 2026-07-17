import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

/** Entrée OTP en mémoire avec TTL de 15 minutes */
interface OtpEntry {
  code: string;
  userId: string;
  expiresAt: number; // timestamp ms
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /** Map en mémoire OTP → Super-Admin (TTL 15 min) */
  private readonly otpStore = new Map<string, OtpEntry>();

  /**
   * Valide les identifiants d'un utilisateur dans le contexte d'un tenant.
   *
   * Stratégie de comparaison des mots de passe (rétrocompatible) :
   * - Si le password stocké ressemble à un hash bcrypt ($2b$ prefix) → bcrypt.compare
   * - Sinon (données legacy) → comparaison directe (à migrer ultérieurement)
   *
   * @param email      Email de l'utilisateur
   * @param pass       Mot de passe en clair
   * @param tenantId   ID du tenant résolu par le middleware (optionnel en legacy)
   */
  async validateUser(email: string, pass: string, tenantId?: string): Promise<any> {
    let user: any;

    if (tenantId) {
      // Multi-tenant : recherche scoped au tenant via le filtre ALS automatique.
      user = await this.prisma.user.findFirst({
        where: { email: email.toLowerCase() },
      });
    } else {
      // Contexte legacy : accès RESTREINT au Super-Admin global (tenantId IS NULL).
      // eslint-disable-next-line no-restricted-syntax
      const results = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM "User"
        WHERE email = ${email.toLowerCase()}
          AND "tenantId" IS NULL
        LIMIT 1
      `;
      user = results[0] ?? null;

      if (user && user.tenantId) {
        return null;
      }
    }

    if (!user) return null;

    const isValid = await this._comparePassword(pass, user.password);
    if (!isValid) return null;

    const { password, ...result } = user;
    return result;
  }

  /**
   * Génère un token JWT incluant le tenantId.
   */
  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      systemRole: user.systemRole,
      tenantId: user.tenantId ?? null,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        systemRole: user.systemRole,
        tenantId: user.tenantId ?? null,
        recoveryEmail: user.recoveryEmail ?? null,
        recoveryPhone: user.recoveryPhone ?? null,
        phone: user.phone ?? null,
        country: user.country ?? null,
        position: user.position ?? null,
      },
    };
  }

  /**
   * Hashage d'un mot de passe avec bcrypt.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Récupération de compte Super-Admin (OTP en mémoire, TTL 15 min)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Étape 1 : demande de réinitialisation via email ou téléphone de récupération.
   * Génère un OTP à 6 chiffres et le stocke en mémoire (TTL 15 min).
   * Retourne le code OTP dans la réponse (simulation — en prod : envoyer par SMS/email).
   */
  async requestSuperAdminReset(recoveryEmail?: string, recoveryPhone?: string): Promise<{ otp: string; message: string }> {
    if (!recoveryEmail && !recoveryPhone) {
      throw new BadRequestException("Veuillez fournir un email ou un téléphone de récupération.");
    }

    let results: any[] = [];
    if (recoveryEmail) {
      // eslint-disable-next-line no-restricted-syntax
      results = await this.prisma.$queryRaw<any[]>`
        SELECT id, email, "firstName", "lastName", "recoveryEmail", "recoveryPhone"
        FROM "User"
        WHERE lower("recoveryEmail") = ${recoveryEmail.toLowerCase().trim()}
          AND "tenantId" IS NULL
        LIMIT 1
      `;
    } else if (recoveryPhone) {
      // eslint-disable-next-line no-restricted-syntax
      results = await this.prisma.$queryRaw<any[]>`
        SELECT id, email, "firstName", "lastName", "recoveryEmail", "recoveryPhone"
        FROM "User"
        WHERE "recoveryPhone" = ${recoveryPhone.trim()}
          AND "tenantId" IS NULL
        LIMIT 1
      `;
    }

    // Anti-énumération : on répond toujours avec succès
    if (!results || results.length === 0) {
      return {
        otp: '------',
        message: "Aucun compte Super-Admin trouvé avec ce contact. Vérifiez votre profil Console SaaS."
      };
    }

    const superAdmin = results[0];

    // Générer un OTP à 6 chiffres
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000; // TTL : 15 minutes

    // Nettoyer les anciens OTP pour ce userId
    for (const [key, entry] of this.otpStore.entries()) {
      if (entry.userId === superAdmin.id) this.otpStore.delete(key);
    }

    this.otpStore.set(otp, { code: otp, userId: superAdmin.id, expiresAt });

    return {
      otp,
      message: `Code OTP généré pour ${superAdmin.firstName} ${superAdmin.lastName}. Valable 15 minutes.`
    };
  }

  /**
   * Étape 2 : vérification de l'OTP.
   */
  verifySuperAdminOtp(otp: string): { valid: boolean; userId?: string } {
    this._cleanExpiredOtps();
    const entry = this.otpStore.get(otp);
    if (!entry || entry.expiresAt < Date.now()) {
      return { valid: false };
    }
    return { valid: true, userId: entry.userId };
  }

  /**
   * Étape 3 : réinitialisation du mot de passe via OTP valide.
   */
  async resetSuperAdminPassword(otp: string, newPassword: string): Promise<void> {
    this._cleanExpiredOtps();
    const entry = this.otpStore.get(otp);

    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException("Code OTP invalide ou expiré.");
    }

    if (newPassword.length < 6) {
      throw new BadRequestException("Le mot de passe doit contenir au moins 6 caractères.");
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    // eslint-disable-next-line no-restricted-syntax
    await this.prisma.$executeRaw`
      UPDATE "User"
      SET password = ${hashed}
      WHERE id = ${entry.userId}
        AND "tenantId" IS NULL
    `;

    // Invalider l'OTP après utilisation
    this.otpStore.delete(otp);
  }

  /**
   * Met à jour les contacts de récupération du Super-Admin.
   */
  async updateSuperAdminRecovery(userId: string, recoveryEmail?: string, recoveryPhone?: string): Promise<void> {
    // eslint-disable-next-line no-restricted-syntax
    await this.prisma.$executeRaw`
      UPDATE "User"
      SET "recoveryEmail" = ${recoveryEmail ?? null},
          "recoveryPhone" = ${recoveryPhone ?? null}
      WHERE id = ${userId}
        AND "tenantId" IS NULL
    `;
  }

  /**
   * Récupère le profil complet du Super-Admin.
   */
  async getSuperAdminProfile(userId: string): Promise<any> {
    // eslint-disable-next-line no-restricted-syntax
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT id, email, "firstName", "lastName", username, "recoveryEmail", "recoveryPhone", phone, "mfaEnabled"
      FROM "User"
      WHERE id = ${userId}
        AND "tenantId" IS NULL
      LIMIT 1
    `;
    if (!results || results.length === 0) throw new BadRequestException("Super-Admin introuvable.");
    return results[0];
  }

  /**
   * Comparaison intelligente : bcrypt si hash détecté, sinon plain text (legacy).
   */
  private async _comparePassword(plain: string, stored: string): Promise<boolean> {
    if (stored && stored.startsWith('$2')) {
      return bcrypt.compare(plain, stored);
    }
    return plain === stored;
  }

  /** Supprime les OTP expirés du store */
  private _cleanExpiredOtps(): void {
    const now = Date.now();
    for (const [key, entry] of this.otpStore.entries()) {
      if (entry.expiresAt < now) this.otpStore.delete(key);
    }
  }
}
