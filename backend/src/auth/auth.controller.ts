import { Controller, Post, Get, Patch, Body, Param, UnauthorizedException, Req, HttpCode, HttpStatus, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { LoginDto, RequestResetDto, VerifyOtpDto, ResetPasswordDto, UpdateProfileDto } from './dto/auth.dto';

/**
 * AuthController — Authentification et récupération de compte.
 *
 * POST /api/auth/login
 *   Body: { email: string, password: string }
 *   Le tenant est résolu automatiquement par le TenantMiddleware via :
 *   - Header X-Tenant-ID (développement / agent)
 *   - Sous-domaine HTTP (production)
 *
 * Routes Super-Admin (sans tenant) :
 *   POST /api/auth/super-admin/request-reset
 *   POST /api/auth/super-admin/verify-otp
 *   POST /api/auth/super-admin/reset-password
 *   GET  /api/auth/super-admin/profile (protégé JWT)
 *   PATCH /api/auth/super-admin/profile (protégé JWT)
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: { tenantId?: string },
  ) {
    const user = await this.authService.validateUser(
      body.email,
      body.password,
      req.tenantId,
    );

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe invalide.');
    }

    return this.authService.login(user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MFA (TOTP) Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  async setupMfa(@Req() req: any) {
    const userId = req.user.userId ?? req.user.sub;
    return this.authService.setupMfa(userId, req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify-setup')
  async verifyMfaSetup(@Req() req: any, @Body('token') token: string) {
    if (!token) throw new BadRequestException('Le code est requis.');
    const userId = req.user.userId ?? req.user.sub;
    return this.authService.verifyMfaSetup(userId, token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  async disableMfa(@Req() req: any, @Body('password') password: string) {
    if (!password) throw new BadRequestException('Le mot de passe est requis.');
    const userId = req.user.userId ?? req.user.sub;
    await this.authService.disableMfa(userId, password);
    return { message: 'MFA désactivé avec succès.' };
  }

  @Public()
  @Post('mfa/validate')
  @HttpCode(HttpStatus.OK)
  async validateMfaCode(@Body('tempToken') tempToken: string, @Body('token') token: string) {
    if (!tempToken || !token) throw new BadRequestException('Le token et le code sont requis.');
    const userId = this.authService.verifyTempToken(tempToken);
    return await this.authService.validateMfaCode(userId, token);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Récupération de compte Super-Admin (routes publiques)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/auth/super-admin/request-reset
   * Demande de réinitialisation via email ou téléphone de récupération enregistré.
   * Retourne l'OTP en clair (simulation — en production : envoyer par SMS/email).
   */
  @Public()
  @Post('super-admin/request-reset')
  @HttpCode(HttpStatus.OK)
  async superAdminRequestReset(
    @Body() body: RequestResetDto,
  ) {
    return this.authService.requestSuperAdminReset(body.recoveryEmail, body.recoveryPhone);
  }

  /**
   * POST /api/auth/super-admin/verify-otp
   * Vérifie la validité d'un OTP (sans le consommer).
   */
  @Public()
  @Post('super-admin/verify-otp')
  @HttpCode(HttpStatus.OK)
  async superAdminVerifyOtp(@Body() body: VerifyOtpDto) {
    const result = this.authService.verifySuperAdminOtp(body.otp);
    if (!result.valid) {
      throw new UnauthorizedException('Code OTP invalide ou expiré.');
    }
    return { valid: true, message: 'Code OTP valide.' };
  }

  /**
   * POST /api/auth/super-admin/reset-password
   * Réinitialise le mot de passe du Super-Admin via OTP valide.
   */
  @Public()
  @Post('super-admin/reset-password')
  @HttpCode(HttpStatus.OK)
  async superAdminResetPassword(
    @Body() body: ResetPasswordDto,
  ) {
    await this.authService.resetSuperAdminPassword(body.otp, body.newPassword);
    return { message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Gestion du profil Super-Admin (routes protégées JWT)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/auth/super-admin/profile
   * Récupère le profil complet du Super-Admin connecté.
   */
  @UseGuards(JwtAuthGuard)
  @Get('super-admin/profile')
  async getSuperAdminProfile(@Req() req: any) {
    return this.authService.getSuperAdminProfile(req.user.userId ?? req.user.sub);
  }

  /**
   * PATCH /api/auth/super-admin/profile
   * Enregistre les contacts de récupération du Super-Admin.
   * Body: { recoveryEmail?: string; recoveryPhone?: string }
   */
  @UseGuards(JwtAuthGuard)
  @Patch('super-admin/profile')
  @HttpCode(HttpStatus.OK)
  async updateSuperAdminProfile(
    @Req() req: any,
    @Body() body: UpdateProfileDto,
  ) {
    const userId = req.user.userId ?? req.user.sub;
    await this.authService.updateSuperAdminRecovery(userId, body.recoveryEmail, body.recoveryPhone);
    return { message: 'Contacts de récupération mis à jour avec succès.' };
  }
}
