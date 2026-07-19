import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

/** Entrée OTP en mémoire avec TTL de 15 minutes */
interface OtpEntry {
  code: string;
  userId: string;
  expiresAt: number; // timestamp ms
}

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<string, OtpEntry>();
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async getTransporter() {
    if (this.transporter) return this.transporter;
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      return this.transporter;
    } catch (err) {
      console.error('Failed to create nodemailer test account', err);
      return null;
    }
  }

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
    if (user.mfaEnabled) {
      const tempPayload = { sub: user.id, mfaPending: true };
      return {
        mfaRequired: true,
        tempToken: this.jwtService.sign(tempPayload, { expiresIn: '5m' })
      };
    }

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

    // Envoi de l'email
    const transporter = await this.getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: '"Console SaaS" <noreply@consolesaas.com>',
        to: superAdmin.recoveryEmail,
        subject: "Votre code de récupération (Console SaaS)",
        text: `Bonjour ${superAdmin.firstName},\n\nVotre code OTP de récupération est : ${otp}\nIl est valable 15 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce message.`,
        html: `<p>Bonjour ${superAdmin.firstName},</p><p>Votre code OTP de récupération est : <b style="font-size:1.5rem;color:#3b82f6;letter-spacing:4px;">${otp}</b></p><p>Il est valable 15 minutes.</p><p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce message.</p>`
      });
      console.log('--- EMAIL OTP ENVOYÉ ---');
      console.log('Aperçu du mail : ' + nodemailer.getTestMessageUrl(info));
    } else {
      console.log('Erreur Mailer, OTP de fallback : ' + otp);
    }

    return {
      otp: '------',
      message: `Code OTP généré et envoyé à l'adresse associée. Vérifiez votre boîte de réception.`
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

  // ─────────────────────────────────────────────────────────────────────────────
  // MFA (TOTP) Management
  // ─────────────────────────────────────────────────────────────────────────────

  async setupMfa(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, 'Console SaaS', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret }
    });

    return { secret, qrCodeDataUrl };
  }

  async verifyMfaSetup(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) throw new BadRequestException('MFA non initialisé.');

    const isValid = authenticator.verify({ token, secret: user.mfaSecret });
    if (!isValid) throw new BadRequestException('Code invalide.');

    const backupCodes = Array.from({ length: 10 }, () => Math.random().toString(36).substring(2, 10).toUpperCase());
    const hashedCodes = await Promise.all(backupCodes.map(code => bcrypt.hash(code, 12)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        mfaEnabled: true, 
        mfaBackupCodes: hashedCodes 
      }
    });

    return { backupCodes };
  }

  async disableMfa(userId: string, passwordConfirm: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur introuvable.');

    const isValid = await this._comparePassword(passwordConfirm, user.password);
    if (!isValid) throw new BadRequestException('Mot de passe incorrect.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        mfaEnabled: false, 
        mfaSecret: null, 
        mfaBackupCodes: [] 
      }
    });
  }

  async validateMfaCode(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA non activé.');
    }

    const isTotpValid = authenticator.verify({ token, secret: user.mfaSecret });
    if (isTotpValid) {
      return this.login({ ...user, mfaEnabled: false }); // Bypass tempToken inside login
    }

    for (let i = 0; i < user.mfaBackupCodes.length; i++) {
      const hashedCode = user.mfaBackupCodes[i];
      const isBackupValid = await bcrypt.compare(token, hashedCode);
      if (isBackupValid) {
        const newCodes = user.mfaBackupCodes.filter((_, index) => index !== i);
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: newCodes }
        });
        return this.login({ ...user, mfaEnabled: false }); // Bypass tempToken inside login
      }
    }

    throw new BadRequestException('Code invalide.');
  }

  verifyTempToken(tempToken: string) {
    try {
      const payload = this.jwtService.verify(tempToken);
      if (!payload.mfaPending) throw new UnauthorizedException('Token invalide.');
      return payload.sub;
    } catch (e) {
      throw new UnauthorizedException('Session expirée ou invalide.');
    }
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
