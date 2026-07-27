import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from './tenant.guard';
import { Public } from '../auth/public.decorator';
import { CreateTenantDto, UpdateTenantSettingsDto, VerifySignupDto, ResendCodeDto } from './dto/tenants.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

/**
 * TenantsController — Routes liées à la gestion des tenants.
 *
 * Routes publiques (sans auth) :
 *  POST /api/tenants/signup                     → Inscription directe (rétro-compatibilité)
 *  POST /api/tenants/signup/request-verification → Étape 1 : Demande OTP Email + SMS
 *  POST /api/tenants/signup/verify               → Étape 2 : Vérification OTP et création effectif
 *  POST /api/tenants/signup/resend-code          → Renvoi des codes OTP
 *  GET  /api/tenants/plans                      → Liste des plans disponibles (page Pricing)
 *
 * Routes protégées (auth JWT + tenant) :
 *  GET  /api/tenants/me       → Informations et usage du tenant courant
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Demande de vérification d'inscription (génération & envoi OTP Email + SMS).
   */
  @Public()
  @Throttle({
    short: { limit: 3, ttl: 60000 },
    medium: { limit: 5, ttl: 60000 },
    long: { limit: 10, ttl: 60000 }
  })
  @Post('signup/request-verification')
  @HttpCode(HttpStatus.OK)
  async requestVerification(@Body() body: CreateTenantDto) {
    return this.tenantsService.requestSignupVerification(body);
  }

  /**
   * Vérification des 2 codes OTP (Email + SMS) et création effective du locataire.
   */
  @Public()
  @Throttle({
    short: { limit: 5, ttl: 60000 },
    medium: { limit: 10, ttl: 60000 },
    long: { limit: 20, ttl: 60000 }
  })
  @Post('signup/verify')
  @HttpCode(HttpStatus.CREATED)
  async verifySignup(@Body() body: VerifySignupDto) {
    return this.tenantsService.verifySignup(body);
  }

  /**
   * Renvoi d'un nouveau couple de codes OTP en cas de non-réception.
   */
  @Public()
  @Throttle({
    short: { limit: 2, ttl: 60000 },
    medium: { limit: 4, ttl: 60000 },
    long: { limit: 8, ttl: 60000 }
  })
  @Post('signup/resend-code')
  @HttpCode(HttpStatus.OK)
  async resendCode(@Body() body: ResendCodeDto) {
    return this.tenantsService.resendSignupCode(body);
  }

  /**
   * Inscription publique d'un nouveau tenant (Direct / Rétro-compatibilité).
   * Crée : Tenant + utilisateur Admin + Subscription en période d'essai.
   */
  @Public()
  @Throttle({
    short: { limit: 3, ttl: 60000 },
    medium: { limit: 3, ttl: 60000 },
    long: { limit: 5, ttl: 60000 }
  })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() body: CreateTenantDto,
  ) {
    return this.tenantsService.signup(body);
  }

  /**
   * Liste publique des plans disponibles — utilisée par la page /pricing.
   */
  @Public()
  @Get('plans')
  getPlans() {
    return this.tenantsService.getPublicPlans();
  }

  /**
   * Retourne le statut d'activation du serveur OTP SMS.
   */
  @Public()
  @Get('sms-config/status')
  async getSmsConfigStatus() {
    return this.tenantsService.getSmsConfigStatus();
  }

  /**
   * Retourne les informations du tenant courant + usage (actifs, utilisateurs).
   * Requiert : JWT valide + contexte tenant (header X-Tenant-ID ou sous-domaine).
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getMyTenant(@Req() req: { user: { tenantId?: string }; tenantId?: string }) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.tenantsService.getMyTenant(tenantId!);
  }

  /**
   * Retourne les statistiques d'audience du tenant courant (isolées strictly).
   * Requiert : JWT valide + contexte tenant + rôle ADMIN.
   */
  @Get('me/analytics/stats')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getTenantAnalytics(
    @Req() req: { tenantId?: string; user?: { tenantId?: string } }
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID non fourni.');
    }
    return this.tenantsService.getTenantAnalytics(tenantId);
  }

  /**
   * Retourne les indicateurs de performance du support IT pour le tenant courant (isolés strictly).
   * Requiert : JWT valide + contexte tenant + rôle ADMIN ou TECHNICIAN.
   */
  @Get('me/support-performance')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  async getSupportPerformance(
    @Req() req: { tenantId?: string; user?: { id: string; role: string; tenantId?: string } },
    @Query('period') period?: string
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID non fourni.');
    }
    
    const results = await this.tenantsService.getSupportPerformance(tenantId, period);
    
    // Un technicien ne doit voir que ses propres statistiques
    if (req.user?.role === Role.TECHNICIAN) {
      return results.filter(r => r.id === req.user.id);
    }
    
    return results;
  }

  /**
   * Retourne la liste des passerelles de paiement disponibles configurées par le super-admin.
   * Protégé pour n'exposer les moyens qu'aux tenants authentifiés.
   */
  @Get('payment-gateways')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getPaymentGateways() {
    return this.tenantsService.getAvailableGateways();
  }

  /**
   * Met à jour les informations de branding du tenant.
   * Protégé par TenantGuard pour l'isolation (un tenant ne peut modifier que lui-même).
   */
  @Patch('me/branding')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/tenant-logos';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const tenantId = (req as any).tenantId ?? (req as any).user?.tenantId;
          const randomName = Array(16)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${tenantId}-${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024, // 2 MB
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/i) && !file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
          return cb(new BadRequestException('Seules les images (JPG, PNG) sont autorisées.'), false);
        }
        cb(null, true);
      },
    }),
  )
  async updateBranding(
    @Req() req: { user: { tenantId?: string }; tenantId?: string },
    @Body() body: UpdateTenantSettingsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant introuvable');
    }

    const brandingData: any = { ...body };
    if (file) {
      const isValid = await this.validateImageMagicBytes(file.path);
      if (!isValid) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          // ignore
        }
        throw new BadRequestException("Le fichier envoyé est corrompu ou n'est pas une image JPG/PNG valide.");
      }
      brandingData.logoUrl = `/uploads/tenant-logos/${file.filename}`;
    }

    return this.tenantsService.updateBranding(tenantId, brandingData);
  }

  private async validateImageMagicBytes(filePath: string): Promise<boolean> {
    let fd: fs.promises.FileHandle | null = null;
    try {
      fd = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(8);
      await fd.read(buffer, 0, 8, 0);

      const isPng = buffer[0] === 0x89 &&
                    buffer[1] === 0x50 &&
                    buffer[2] === 0x4e &&
                    buffer[3] === 0x47 &&
                    buffer[4] === 0x0d &&
                    buffer[5] === 0x0a &&
                    buffer[6] === 0x1a &&
                    buffer[7] === 0x0a;

      const isJpeg = buffer[0] === 0xff &&
                     buffer[1] === 0xd8 &&
                     buffer[2] === 0xff;

      return isPng || isJpeg;
    } catch (error) {
      return false;
    } finally {
      if (fd) {
        await fd.close();
      }
    }
  }
}
