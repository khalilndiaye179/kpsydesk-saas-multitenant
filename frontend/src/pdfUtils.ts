import { api } from './api';
import axios from 'axios';

function getLogoUrl(logoPath: string): string {
  if (!logoPath) return '';
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || '';
  const baseUrl = apiBaseUrl.endsWith('/api') 
    ? apiBaseUrl.slice(0, -4) 
    : apiBaseUrl;
  return `${baseUrl}${logoPath}`;
}

export async function addBrandingToPdf(doc: any, startY: number, title: string) {
  let tenantName = "Mon Entreprise";
  let finalY = startY;
  let textX = 14;

  try {
    const res = await api.get('/tenants/me');
    const tenant = res.data.tenant;
    if (tenant) {
      tenantName = tenant.name;
      if (tenant.logoUrl) {
        try {
          const logoUrl = getLogoUrl(tenant.logoUrl);
          const imgRes = await axios.get(logoUrl, { responseType: 'blob' });
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imgRes.data);
          });
          
          const img = new Image();
          img.src = base64;
          await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
          
          const format = tenant.logoUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
          const ratio = Math.min(40 / img.width, 20 / img.height);
          doc.addImage(base64, format, 14, 10, img.width * ratio, img.height * ratio);
          
          finalY = 10 + (img.height * ratio) + 10;
          textX = 60;
        } catch (e) {
          console.warn("Logo fetch failed", e);
        }
      }
      
      doc.setFontSize(10);
      let textY = 15;
      
      doc.text(tenant.name, textX, textY);
      doc.setFontSize(8);
      if (tenant.companyAddress) { textY += 5; doc.text(tenant.companyAddress, textX, textY); }
      if (tenant.companyPhone || tenant.companyEmail) {
        textY += 5;
        const contact = [tenant.companyPhone, tenant.companyEmail].filter(Boolean).join(' - ');
        doc.text(contact, textX, textY);
      }
      if (tenant.companyTaxId) { textY += 5; doc.text(`NIF/RC: ${tenant.companyTaxId}`, textX, textY); }
      
      finalY = Math.max(finalY, textY + 10);
    }
  } catch (e) {
    console.warn("Tenant branding failed", e);
  }

  doc.setFontSize(14);
  doc.text(`${title} (${tenantName})`, 14, finalY);
  
  return finalY + 10;
}
