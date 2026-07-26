import * as PDFDocument from 'pdfkit';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export class TenantPdfGenerator {
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
   * Génère le PDF d'une facture client émise par le tenant
   */
  static generatePdf(res: Response, invoice: any) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Stream le PDF directement dans la réponse Express
    doc.pipe(res);

    // En-tête / Logo & Nom
    let hasLogo = false;
    let absoluteLogoPath = '';

    if (invoice.tenant?.logoUrl && typeof invoice.tenant.logoUrl === 'string') {
      const cleanUrl = invoice.tenant.logoUrl.startsWith('/')
        ? invoice.tenant.logoUrl.substring(1)
        : invoice.tenant.logoUrl;
      absoluteLogoPath = path.join(process.cwd(), cleanUrl);

      const ext = path.extname(absoluteLogoPath).toLowerCase();
      if ((ext === '.png' || ext === '.jpg' || ext === '.jpeg') && fs.existsSync(absoluteLogoPath)) {
        hasLogo = true;
      }
    }

    if (hasLogo) {
      try {
        doc.image(absoluteLogoPath, 50, 45, { fit: [100, 45] });
        doc
          .fillColor('#0f172a') // Slate 900
          .fontSize(16)
          .text(invoice.tenant.name.toUpperCase(), 50, 95, { bold: true } as any)
          .fontSize(10)
          .fillColor('#64748b') // Slate 500
          .text('Facture de vente conforme DGI', 50, 115);
      } catch (e) {
        hasLogo = false;
      }
    }

    if (!hasLogo) {
      doc
        .fillColor('#0f172a') // Slate 900
        .fontSize(22)
        .text(invoice.tenant.name.toUpperCase(), 50, 50, { bold: true } as any)
        .fontSize(10)
        .fillColor('#64748b') // Slate 500
        .text('Facture de vente conforme DGI', 50, 75);
    }

    // Infos émetteur (Le Tenant PME)
    doc
      .fillColor('#1e293b') // Slate 800
      .fontSize(10)
      .text('ÉMETTEUR :', 320, 50, { bold: true } as any)
      .text(invoice.tenant.name, 320, 65, { bold: true } as any)
      .text(invoice.tenant.companyAddress || 'Adresse non renseignée', 320, 78)
      .text(`Email: ${invoice.tenant.companyEmail || 'Non spécifié'}`, 320, 91)
      .text(`Tél: ${invoice.tenant.companyPhone || 'Non spécifié'}`, 320, 104)
      .text(`NINEA/RC émetteur: ${invoice.tenant.companyTaxId || 'Non spécifié'}`, 320, 117);

    doc.moveTo(50, 135).lineTo(550, 135).stroke('#e2e8f0');

    // Infos Facture & Destinataire
    const dateStr = new Date(invoice.createdAt).toLocaleDateString('fr-FR');
    let statusText = 'BROUILLON';
    if (invoice.status === 'PAID') statusText = 'PAYÉE';
    if (invoice.status === 'ISSUED') statusText = 'ÉMISE';
    if (invoice.status === 'CANCELLED') statusText = 'ANNULÉE';

    doc
      .fillColor('#1e3a8a') // Corporate Blue
      .fontSize(12)
      .text(`FACTURE N° ${invoice.invoiceNo}`, 50, 155, { bold: true } as any)
      .fillColor('#475569')
      .fontSize(10)
      .text(`Date d'émission : ${dateStr}`, 50, 175)
      .text(`Statut de paiement : ${statusText}`, 50, 190);

    doc
      .fillColor('#1e293b')
      .fontSize(10)
      .text('FACTURÉ À :', 320, 155, { bold: true } as any)
      .text(invoice.clientName, 320, 170, { bold: true } as any);

    if (invoice.clientEmail) {
      doc.text(`Email: ${invoice.clientEmail}`, 320, 183);
    }
    if (invoice.clientPhone) {
      doc.text(`Tél: ${invoice.clientPhone}`, 320, 196);
    }
    if (invoice.clientNinea || invoice.clientRc) {
      const taxInfos = [
        invoice.clientNinea ? `NINEA: ${invoice.clientNinea}` : '',
        invoice.clientRc ? `RC: ${invoice.clientRc}` : ''
      ].filter(Boolean).join(' / ');
      doc.text(taxInfos, 320, 209);
    }

    // Tableau des articles
    let y = 245;
    doc.fillColor('#0f172a').rect(50, y, 500, 22).fill();
    doc
      .fillColor('#ffffff')
      .fontSize(9)
      .text('Désignation', 60, y + 6)
      .text('Quantité', 330, y + 6)
      .text('Prix Unitaire HT', 400, y + 6)
      .text('Total HT', 490, y + 6);

    y += 22;
    doc.fillColor('#1e293b');

    for (const item of invoice.items) {
      doc
        .text(item.description, 60, y + 8, { width: 250 } as any)
        .text(String(item.quantity), 330, y + 8, { align: 'center', width: 40 } as any)
        .text(this.formatXOF(item.unitPrice), 400, y + 8)
        .text(this.formatXOF(item.totalPrice), 490, y + 8);
      
      // Ajuster y selon la longueur du texte de description
      const lines = Math.ceil(item.description.length / 45);
      y += 18 + (lines > 1 ? (lines - 1) * 10 : 0);
      doc.moveTo(50, y).lineTo(550, y).stroke('#f1f5f9');
    }

    y += 15;

    // Totaux
    doc
      .fontSize(9)
      .text('Total HT :', 350, y)
      .text(this.formatXOF(invoice.amountHT), 480, y, { align: 'right' } as any);

    y += 15;
    doc
      .text(`TVA (${invoice.tvaRate}%) :`, 350, y)
      .text(this.formatXOF(invoice.tvaAmount), 480, y, { align: 'right' } as any);

    y += 15;
    doc
      .fontSize(10)
      .fillColor('#1e3a8a')
      .text('NET À PAYER (TTC) :', 350, y, { bold: true } as any)
      .text(this.formatXOF(invoice.amountTTC), 480, y, { align: 'right', bold: true } as any);

    // Notes / Termes
    if (invoice.notes) {
      y += 40;
      doc
        .fillColor('#64748b')
        .fontSize(8)
        .text('Notes / Conditions de paiement :', 50, y, { bold: true } as any)
        .text(invoice.notes, 50, y + 12, { width: 450 } as any);
    }

    // Bas de page légal DGI
    const footerY = 760;
    doc.moveTo(50, footerY - 10).lineTo(550, footerY - 10).stroke('#e2e8f0');
    doc
      .fillColor('#94a3b8')
      .fontSize(8)
      .text(`Document généré par KPSyDesk pour ${invoice.tenant.name}.`, 50, footerY)
      .text(`Facture conforme à la réglementation DGI de la République du Sénégal.`, 50, footerY + 12)
      .text('Page 1/1', 500, footerY, { align: 'right' } as any);

    // Finaliser le PDF
    doc.end();
  }
}
