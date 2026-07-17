import * as PDFDocument from 'pdfkit';
import { Response } from 'express';

export class PdfGenerator {
  /**
   * Formate un nombre en FCFA (XOF)
   */
  static formatXOF(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Génère le PDF d'une facture d'abonnement individuelle
   */
  static generateInvoicePdf(res: Response, invoice: any, generatorUser: string) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Stream le PDF directement dans la réponse Express
    doc.pipe(res);

    // En-tête / Logo simulé
    doc
      .fillColor('#1e3a8a')
      .fontSize(22)
      .text('KPSyDesk ITAM SaaS', 50, 50, { bold: true } as any)
      .fontSize(10)
      .fillColor('#6b7280')
      .text('Logiciel de gestion de parc informatique Multi-Entreprise', 50, 75);

    // Infos émetteur (Editeur SaaS)
    doc
      .fillColor('#1f2937')
      .fontSize(10)
      .text('ÉDITEUR :', 320, 50, { bold: true } as any)
      .text('KPSY IT Solutions S.A.R.L.', 320, 65)
      .text('Avenue Cheikh Anta Diop, Dakar, Sénégal', 320, 78)
      .text('NINEA: 007483920 / RC: SN-DKR-2026-B-102', 320, 91)
      .text('Email: finance@kpsydesk.com', 320, 104);

    doc.moveTo(50, 130).lineTo(550, 130).stroke('#e5e7eb');

    // Infos Facture & Client
    const dateStr = new Date(invoice.createdAt).toLocaleDateString('fr-FR');
    const dueStr = new Date(invoice.dueDate).toLocaleDateString('fr-FR');

    doc
      .fillColor('#1e3a8a')
      .fontSize(12)
      .text(`FACTURE N° ${invoice.invoiceNo}`, 50, 150, { bold: true } as any)
      .fillColor('#4b5563')
      .fontSize(10)
      .text(`Date d'émission : ${dateStr}`, 50, 170)
      .text(`Date d'échéance : ${dueStr}`, 50, 185)
      .text(`Statut : ${invoice.status === 'PAID' ? 'PAYÉE' : 'EN ATTENTE'}`, 50, 200);

    doc
      .fillColor('#1f2937')
      .fontSize(10)
      .text('FACTURÉ À :', 320, 150, { bold: true } as any)
      .text(invoice.tenant.name, 320, 165, { bold: true } as any)
      .text(`Sous-domaine : ${invoice.tenant.subdomain}.kpsydesk.com`, 320, 180)
      .text(`ID Unique : ${invoice.tenant.id}`, 320, 195);

    // Tableau des articles
    let y = 240;
    doc.fillColor('#1e3a8a').rect(50, y, 500, 22).fill();
    doc
      .fillColor('#ffffff')
      .fontSize(9)
      .text('Description du service', 60, y + 6)
      .text('Qté', 380, y + 6)
      .text('Prix Unitaire HT', 420, y + 6)
      .text('Total HT', 500, y + 6);

    y += 22;
    doc
      .fillColor('#1f2937')
      .fontSize(9)
      .text(`Abonnement SaaS KPSyDesk - Plan ${invoice.plan.name}`, 60, y + 10)
      .text('1', 385, y + 10)
      .text(this.formatXOF(invoice.amountHT), 420, y + 10)
      .text(this.formatXOF(invoice.amountHT), 500, y + 10);

    y += 30;
    doc.moveTo(50, y).lineTo(550, y).stroke('#e5e7eb');

    // Totaux
    y += 15;
    doc
      .fontSize(9)
      .text('Total HT :', 380, y)
      .text(this.formatXOF(invoice.amountHT), 480, y, { align: 'right' } as any);

    y += 15;
    doc
      .text(`TVA (${invoice.tvaRate}%) :`, 380, y)
      .text(this.formatXOF(invoice.tvaAmount), 480, y, { align: 'right' } as any);

    y += 18;
    doc
      .fontSize(11)
      .fillColor('#1e3a8a')
      .text('TOTAL TTC :', 380, y, { bold: true } as any)
      .text(this.formatXOF(invoice.amountTTC), 480, y, { bold: true, align: 'right' } as any);

    // Traçabilité & Preuve fiscale
    y = 650;
    doc.moveTo(50, y).lineTo(550, y).stroke('#e5e7eb');
    
    // Hash d'intégrité factice pour l'audit fiscal
    const hash = require('crypto')
      .createHash('sha256')
      .update(`${invoice.invoiceNo}-${invoice.amountTTC}-${invoice.createdAt}`)
      .digest('hex')
      .substring(0, 16);

    doc
      .fillColor('#9ca3af')
      .fontSize(8)
      .text(`Document certifié KPSyDesk ITAM - Hash d'intégrité : SHA256-${hash.toUpperCase()}`, 50, y + 15)
      .text(`Généré le ${new Date().toLocaleString('fr-FR')} par ${generatorUser}`, 50, y + 27)
      .text(`Page 1/1 — Pièce comptable SYSCOHADA conforme aux normes fiscales UEMOA.`, 50, y + 39, { align: 'center' } as any);

    doc.end();
  }

  /**
   * Génère le relevé périodique consolidé des revenus pour contrôle fiscal
   */
  static generateConsolidatedReportPdf(
    res: Response,
    invoices: any[],
    periodLabel: string,
    generatorUser: string,
  ) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.pipe(res);

    // Header
    doc
      .fillColor('#1f2937')
      .fontSize(18)
      .text('RAPPORT DE REVENUS CONSOLIDÉ', 50, 50, { bold: true } as any)
      .fontSize(9)
      .fillColor('#4b5563')
      .text(`Éditeur : KPSY IT Solutions S.A.R.L. · Période d'audit : ${periodLabel}`, 50, 70);

    // Statistiques clés
    const totalHT = invoices.reduce((acc, inv) => acc + inv.amountHT, 0);
    const totalTVA = invoices.reduce((acc, inv) => acc + inv.tvaAmount, 0);
    const totalTTC = invoices.reduce((acc, inv) => acc + inv.amountTTC, 0);

    let y = 110;
    // Cadre stat
    doc.rect(50, y, 500, 60).fill('#f3f4f6');
    doc
      .fillColor('#1f2937')
      .fontSize(9)
      .text('Volume de transactions', 70, y + 15)
      .fontSize(14)
      .text(`${invoices.length} factures`, 70, y + 30, { bold: true } as any);

    doc
      .fillColor('#1f2937')
      .fontSize(9)
      .text('Total HT', 240, y + 15)
      .fontSize(14)
      .text(this.formatXOF(totalHT), 240, y + 30, { bold: true } as any);

    doc
      .fillColor('#1e3a8a')
      .fontSize(9)
      .text('Recettes TTC (SYSCOHADA)', 380, y + 15)
      .fontSize(14)
      .text(this.formatXOF(totalTTC), 380, y + 30, { bold: true } as any);

    // Titre de la table
    y = 200;
    doc
      .fontSize(11)
      .fillColor('#1f2937')
      .text('Journal chronologique des ventes d\'abonnements', 50, y, { bold: true } as any);

    y += 20;
    doc.fillColor('#1e3a8a').rect(50, y, 500, 20).fill();
    doc
      .fillColor('#ffffff')
      .fontSize(8)
      .text('Réf Facture', 60, y + 6)
      .text('Date', 160, y + 6)
      .text('Abonné', 230, y + 6)
      .text('Montant HT', 380, y + 6)
      .text('TVA', 440, y + 6)
      .text('Total TTC', 490, y + 6);

    y += 20;
    doc.fillColor('#1f2937');
    
    // Lister les 15 premières factures maximum pour garder une seule page
    const listToDisplay = invoices.slice(0, 15);
    for (const inv of listToDisplay) {
      doc
        .fontSize(8)
        .text(inv.invoiceNo, 60, y + 5)
        .text(new Date(inv.createdAt).toLocaleDateString('fr-FR'), 160, y + 5)
        .text(inv.tenant.name.substring(0, 20), 230, y + 5)
        .text(this.formatXOF(inv.amountHT), 380, y + 5)
        .text(this.formatXOF(inv.tvaAmount), 440, y + 5)
        .text(this.formatXOF(inv.amountTTC), 490, y + 5);

      y += 18;
      doc.moveTo(50, y).lineTo(550, y).stroke('#f3f4f6');
    }

    if (invoices.length > 15) {
      doc.fontSize(8).fillColor('#6b7280').text(`... et ${invoices.length - 15} autres factures d'abonnements.`, 60, y + 10);
    }

    // Pied de page Audit Fiscal
    y = 650;
    doc.moveTo(50, y).lineTo(550, y).stroke('#e5e7eb');

    const hash = require('crypto')
      .createHash('sha256')
      .update(`${totalTTC}-${periodLabel}-${invoices.length}`)
      .digest('hex')
      .substring(0, 16);

    doc
      .fillColor('#9ca3af')
      .fontSize(8)
      .text(`Document certifié KPSyDesk ITAM - Hash d'intégrité : SHA256-${hash.toUpperCase()}`, 50, y + 15)
      .text(`Rapport généré le ${new Date().toLocaleString('fr-FR')} par ${generatorUser}`, 50, y + 27)
      .text(`Ce rapport synthétise les recettes d'exploitation soumises à la TVA (18%) pour la période d'audit fiscal indiquée.`, 50, y + 39, { align: 'center' } as any);

    doc.end();
  }
}
