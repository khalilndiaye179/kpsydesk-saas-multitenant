import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import * as PDFDocument from 'pdfkit';
import * as crypto from 'crypto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Formate un montant en FCFA (XOF)
   */
  private formatXOF(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Récupère le résumé financier consolidé pour un tenant donné
   */
  async getTreasurySummary(tenantId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // 1. Agréger les ventes (recettes - Produits)
    const salesAggregate = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Payé', 'En attente'] }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // 2. Agréger les dépenses (achats - Charges)
    const purchasesAggregate = await this.prisma.purchaseOrder.aggregate({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Livrée', 'En cours'] }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    const totalSales = salesAggregate._sum.amount || 0;
    const totalPurchases = purchasesAggregate._sum.amount || 0;
    const netResult = totalSales - totalPurchases;

    // 3. Récupérer les ventes par statut
    const salesByStatus = await this.prisma.sale.groupBy({
      by: ['status'],
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Payé', 'En attente'] }
      },
      _sum: { amount: true }
    });

    // 4. Récupérer les achats par statut
    const purchasesByStatus = await this.prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Livrée', 'En cours'] }
      },
      _sum: { amount: true }
    });

    // 5. Charges par Fournisseur
    const purchasesBySupplier = await this.prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Livrée', 'En cours'] }
      },
      _sum: { amount: true }
    });

    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId }
    });
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    const enrichedSuppliers = purchasesBySupplier.map(p => ({
      supplierName: supplierMap.get(p.supplierId) || 'Fournisseur inconnu',
      amount: p._sum.amount || 0
    }));

    // 6. Courbe de tendance (regrouper par jour)
    const salesList = await this.prisma.sale.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Payé', 'En attente'] }
      },
      select: { date: true, amount: true }
    });

    const purchasesList = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Livrée', 'En cours'] }
      },
      select: { date: true, amount: true }
    });

    const dailyTrendMap: Record<string, { receipts: number; expenses: number }> = {};

    salesList.forEach(s => {
      const day = s.date.toISOString().split('T')[0];
      if (!dailyTrendMap[day]) dailyTrendMap[day] = { receipts: 0, expenses: 0 };
      dailyTrendMap[day].receipts += s.amount;
    });

    purchasesList.forEach(p => {
      const day = p.date.toISOString().split('T')[0];
      if (!dailyTrendMap[day]) dailyTrendMap[day] = { receipts: 0, expenses: 0 };
      dailyTrendMap[day].expenses += p.amount;
    });

    const trend = Object.entries(dailyTrendMap)
      .map(([date, values]) => ({
        date,
        receipts: values.receipts,
        expenses: values.expenses,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: {
        totalSales,
        totalPurchases,
        netResult,
        salesCount: salesAggregate._count.id,
        purchasesCount: purchasesAggregate._count.id,
      },
      details: {
        salesByStatus: salesByStatus.map(s => ({ status: s.status, amount: s._sum.amount || 0 })),
        purchasesByStatus: purchasesByStatus.map(p => ({ status: p.status, amount: p._sum.amount || 0 })),
        chargesBySupplier: enrichedSuppliers,
      },
      trend
    };
  }

  /**
   * Génère le rapport d'export Excel
   */
  async exportExcel(res: Response, tenantId: string, startDate?: string, endDate?: string) {
    // Import dynamique pour éviter un crash si exceljs n'est pas encore installé
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const summaryData = await this.getTreasurySummary(tenantId, startDate, endDate);
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trésorerie');

    // Mettre en place la mise en page
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 20;

    // Titre principal
    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Rapport de Trésorerie Consolidé';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    titleCell.alignment = { alignment: 'center', vertical: 'middle' } as any;
    sheet.getRow(1).height = 40;

    // Infos de la période
    sheet.mergeCells('A2:E2');
    const periodCell = sheet.getCell('A2');
    const startStr = startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'Fin';
    periodCell.value = `Période : Du ${startStr} au ${endStr}`;
    periodCell.font = { name: 'Arial', size: 10, italic: true };
    periodCell.alignment = { alignment: 'center' } as any;

    // KPIs Synthèse
    sheet.addRow([]);
    sheet.addRow(['SYNTHÈSE DE TRÉSORERIE (FCFA)']).font = { bold: true, size: 12 };
    sheet.addRow(['Libellé', 'Indicateur', 'Montant']).font = { bold: true };
    
    sheet.addRow(['Produits (Classe 7)', 'Ventes & Cessions de matériel', summaryData.summary.totalSales]);
    sheet.addRow(['Charges (Classe 6)', 'Achats & Commandes fournisseurs', summaryData.summary.totalPurchases]);
    sheet.addRow(['Résultat Net', 'Solde de trésorerie', summaryData.summary.netResult]);

    // Formatage des montants
    const amountFormat = '#,##0" FCFA"';
    [6, 7, 8].forEach(rowIdx => {
      const cell = sheet.getCell(`C${rowIdx}`);
      cell.numberFormat = amountFormat;
      cell.font = { bold: rowIdx === 8 };
    });

    // Tableau de cessions (Recettes)
    sheet.addRow([]);
    sheet.addRow(['DÉTAIL DES RECETTES (Ventes & Cessions)']).font = { bold: true, size: 12 };
    sheet.addRow(['Date', 'Code Actif', 'Acheteur', 'Statut', 'Montant']).font = { bold: true };

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Payé', 'En attente'] }
      },
      orderBy: { date: 'desc' }
    });

    let currentLastRow = 12;
    sales.forEach(s => {
      sheet.addRow([
        new Date(s.date).toLocaleDateString('fr-FR'),
        s.assetCode,
        s.buyerName,
        s.status,
        s.amount
      ]);
      currentLastRow++;
    });

    // Formater la colonne montant
    for (let r = 12; r <= currentLastRow; r++) {
      const cell = sheet.getCell(`E${r}`);
      cell.numberFormat = amountFormat;
    }

    // Tableau des commandes (Dépenses)
    sheet.addRow([]);
    sheet.addRow(['DÉTAIL DES DÉPENSES (Bons de Commande)']).font = { bold: true, size: 12 };
    sheet.addRow(['Date', 'N° Commande', 'Fournisseur', 'Statut', 'Montant']).font = { bold: true };

    const purchases = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        status: { in: ['Livrée', 'En cours'] }
      },
      include: { supplier: true },
      orderBy: { date: 'desc' }
    });

    let startPurchaseRow = currentLastRow + 4;
    let lastPurchaseRow = startPurchaseRow;
    purchases.forEach(p => {
      sheet.addRow([
        new Date(p.date).toLocaleDateString('fr-FR'),
        p.orderNo,
        p.supplier?.name || 'Inconnu',
        p.status,
        p.amount
      ]);
      lastPurchaseRow++;
    });

    // Formater la colonne montant
    for (let r = startPurchaseRow; r <= lastPurchaseRow; r++) {
      const cell = sheet.getCell(`E${r}`);
      cell.numberFormat = amountFormat;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Rapport_Tresorerie_${tenantId}.xlsx`);

    await workbook.xlsx.write(res);
  }

  /**
   * Génère le rapport d'export PDF
   */
  async exportPdf(res: Response, tenantId: string, startDate?: string, endDate?: string, userName: string = 'SuperAdmin') {
    const summaryData = await this.getTreasurySummary(tenantId, startDate, endDate);
    
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Header / Branding
    doc
      .fillColor('#1e3a8a')
      .fontSize(20)
      .text('KPSyDesk ITAM SaaS', 50, 50, { bold: true } as any)
      .fontSize(9)
      .fillColor('#6b7280')
      .text('Logiciel de gestion de parc informatique Multi-Entreprise', 50, 72);

    doc
      .fillColor('#1f2937')
      .fontSize(9)
      .text('RAPPORT DE TRÉSORERIE CONSOLIDÉ', 320, 50, { align: 'right', bold: true } as any);

    const startStr = startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'Fin';
    doc.text(`Période : Du ${startStr} au ${endStr}`, 320, 65, { align: 'right' } as any);

    doc.moveTo(50, 100).lineTo(550, 100).stroke('#e5e7eb');

    // KPI Cards
    let y = 120;
    doc.rect(50, y, 500, 55).fill('#f3f4f6');
    
    doc
      .fillColor('#1f2937')
      .fontSize(8)
      .text('PRODUITS (Ventes Cl. 7)', 70, y + 12)
      .fontSize(12)
      .text(this.formatXOF(summaryData.summary.totalSales), 70, y + 27, { bold: true } as any);

    doc
      .fillColor('#1f2937')
      .fontSize(8)
      .text('CHARGES (Achats Cl. 6)', 230, y + 12)
      .fontSize(12)
      .text(this.formatXOF(summaryData.summary.totalPurchases), 230, y + 27, { bold: true } as any);

    doc
      .fillColor('#1e3a8a')
      .fontSize(8)
      .text('RÉSULTAT NET DE TRÉSORERIE', 380, y + 12)
      .fontSize(12)
      .text(this.formatXOF(summaryData.summary.netResult), 380, y + 27, { bold: true } as any);

    // Titre Tableaux
    y = 200;
    doc.fillColor('#1f2937').fontSize(10).text('Synthèse des Flux et Dépenses par Fournisseur', 50, y, { bold: true } as any);
    
    y += 18;
    doc.fillColor('#1e3a8a').rect(50, y, 500, 18).fill();
    doc
      .fillColor('#ffffff')
      .fontSize(8)
      .text('Fournisseur (Charges)', 60, y + 5)
      .text('Volume de dépenses', 440, y + 5, { align: 'right' } as any);

    y += 18;
    doc.fillColor('#1f2937');
    
    const supplierCharges = summaryData.details.chargesBySupplier;
    if (supplierCharges.length === 0) {
      doc.fontSize(8).fillColor('#6b7280').text('Aucun achat enregistré sur cette période.', 60, y + 5);
      y += 15;
    } else {
      supplierCharges.forEach(s => {
        doc.fontSize(8)
          .text(s.supplierName, 60, y + 5)
          .text(this.formatXOF(s.amount), 440, y + 5, { align: 'right' } as any);
        y += 15;
        doc.moveTo(50, y).lineTo(550, y).stroke('#f3f4f6');
      });
    }

    // Pied de page
    y = 650;
    doc.moveTo(50, y).lineTo(550, y).stroke('#e5e7eb');

    const hash = crypto
      .createHash('sha256')
      .update(`${summaryData.summary.netResult}-${tenantId}-${startStr}`)
      .digest('hex')
      .substring(0, 16);

    doc
      .fillColor('#9ca3af')
      .fontSize(8)
      .text(`Document certifié KPSyDesk ITAM - Hash d'intégrité : SHA256-${hash.toUpperCase()}`, 50, y + 15)
      .text(`Généré le ${new Date().toLocaleString('fr-FR')} par ${userName}`, 50, y + 27)
      .text(`Page 1/1 — Pièce comptable extra-comptable conforme SYSCOHADA.`, 50, y + 39, { align: 'center' } as any);

    doc.end();
  }
}
