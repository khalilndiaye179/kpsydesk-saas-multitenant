import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';

export const PAYROLL_DEFAULTS = {
  ipresGeneralRate: 5.6,
  ipresGeneralCeiling: 360000,
  ipresExecutiveRate: 5.6,
  ipresExecutiveCeiling: 1080000,
  cssFamilyRate: 3.0,
  cssFamilyCeiling: 63000,
  cssAccidentRate: 1.0,
  cssAccidentCeiling: 63000,
  employerIpresGeneralRate: 8.4,
  employerIpresExecutiveRate: 8.4
};

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  private async getTenantHrConfig(): Promise<typeof PAYROLL_DEFAULTS> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return PAYROLL_DEFAULTS;
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { hrConfig: true }
    });
    if (!tenant || !tenant.hrConfig) {
      return PAYROLL_DEFAULTS;
    }
    const customConfig = tenant.hrConfig as any;
    return {
      ipresGeneralRate: typeof customConfig.ipresGeneralRate === 'number' ? customConfig.ipresGeneralRate : PAYROLL_DEFAULTS.ipresGeneralRate,
      ipresGeneralCeiling: typeof customConfig.ipresGeneralCeiling === 'number' ? customConfig.ipresGeneralCeiling : PAYROLL_DEFAULTS.ipresGeneralCeiling,
      ipresExecutiveRate: typeof customConfig.ipresExecutiveRate === 'number' ? customConfig.ipresExecutiveRate : PAYROLL_DEFAULTS.ipresExecutiveRate,
      ipresExecutiveCeiling: typeof customConfig.ipresExecutiveCeiling === 'number' ? customConfig.ipresExecutiveCeiling : PAYROLL_DEFAULTS.ipresExecutiveCeiling,
      cssFamilyRate: typeof customConfig.cssFamilyRate === 'number' ? customConfig.cssFamilyRate : PAYROLL_DEFAULTS.cssFamilyRate,
      cssFamilyCeiling: typeof customConfig.cssFamilyCeiling === 'number' ? customConfig.cssFamilyCeiling : PAYROLL_DEFAULTS.cssFamilyCeiling,
      cssAccidentRate: typeof customConfig.cssAccidentRate === 'number' ? customConfig.cssAccidentRate : PAYROLL_DEFAULTS.cssAccidentRate,
      cssAccidentCeiling: typeof customConfig.cssAccidentCeiling === 'number' ? customConfig.cssAccidentCeiling : PAYROLL_DEFAULTS.cssAccidentCeiling,
      employerIpresGeneralRate: typeof customConfig.employerIpresGeneralRate === 'number' ? customConfig.employerIpresGeneralRate : PAYROLL_DEFAULTS.employerIpresGeneralRate,
      employerIpresExecutiveRate: typeof customConfig.employerIpresExecutiveRate === 'number' ? customConfig.employerIpresExecutiveRate : PAYROLL_DEFAULTS.employerIpresExecutiveRate,
    };
  }

  async getSimulation(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, baseSalary: true, transportAllowance: true, isExecutive: true }
    });

    if (!user) {
      throw new NotFoundException(`Collaborateur #${userId} introuvable.`);
    }

    const baseSalary = user.baseSalary || 0;
    const transportAllowance = user.transportAllowance || 0;
    const config = await this.getTenantHrConfig();

    // 1. Assiette de cotisation (IPRES et CSS se basent sur le salaire brut hors indemnités exonérées)
    // Au Sénégal, l'indemnité de transport est exonérée d'impôts et cotisations jusqu'à 20 000 FCFA
    const taxableTransport = Math.max(0, transportAllowance - 20000);
    const contributionBase = baseSalary + taxableTransport;

    // 2. Calcul IPRES Régime Général (RG) - Plafond : 360 000 FCFA
    const rgBase = Math.min(contributionBase, config.ipresGeneralCeiling);
    const ipresRgEmployee = rgBase * (config.ipresGeneralRate / 100);
    const ipresRgEmployer = rgBase * (config.employerIpresGeneralRate / 100);

    // 3. Calcul IPRES Régime des Cadres (RC) - Plafond : 1 080 000 FCFA
    let ipresRcEmployee = 0;
    let ipresRcEmployer = 0;
    let rcBase = 0;

    if (user.isExecutive && contributionBase > config.ipresGeneralCeiling) {
      rcBase = Math.min(contributionBase, config.ipresExecutiveCeiling) - config.ipresGeneralCeiling;
      ipresRcEmployee = rcBase * (config.ipresExecutiveRate / 100);
      ipresRcEmployer = rcBase * (config.employerIpresExecutiveRate / 100);
    }

    // 4. Calcul Caisse de Sécurité Sociale (CSS) - Uniquement Patronal - Plafond : 63 000 FCFA
    const cssBase = Math.min(contributionBase, config.cssFamilyCeiling);
    const cssFamilyEmployer = cssBase * (config.cssFamilyRate / 100);
    const cssAccidentEmployer = cssBase * (config.cssAccidentRate / 100);

    // 5. Synthèse Totaux
    const totalIpresEmployee = ipresRgEmployee + ipresRcEmployee;
    const totalIpresEmployer = ipresRgEmployer + ipresRcEmployer;
    const totalCssEmployer = cssFamilyEmployer + cssAccidentEmployer;

    const netSalaryBeforeTax = baseSalary + transportAllowance - totalIpresEmployee;

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      isExecutive: user.isExecutive,
      baseSalary,
      transportAllowance,
      contributionBase,
      taxableTransport,
      ipres: {
        rgBase,
        rcBase,
        employeeGeneral: ipresRgEmployee,
        employerGeneral: ipresRgEmployer,
        employeeExecutive: ipresRcEmployee,
        employerExecutive: ipresRcEmployer,
        totalEmployee: totalIpresEmployee,
        totalEmployer: totalIpresEmployer
      },
      css: {
        base: cssBase,
        familyEmployer: cssFamilyEmployer,
        accidentEmployer: cssAccidentEmployer,
        totalEmployer: totalCssEmployer
      },
      summary: {
        brutSalary: baseSalary + transportAllowance,
        totalChargesEmployee: totalIpresEmployee,
        totalChargesEmployer: totalIpresEmployer + totalCssEmployer,
        netSalaryBeforeTax,
        employerTotalCost: baseSalary + transportAllowance + totalIpresEmployer + totalCssEmployer
      },
      config
    };
  }

  async getHrConfig() {
    return this.getTenantHrConfig();
  }

  async updateHrConfig(data: any) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new NotFoundException("Aucun contexte de locataire trouvé.");
    }
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { hrConfig: data }
    });
  }
}
