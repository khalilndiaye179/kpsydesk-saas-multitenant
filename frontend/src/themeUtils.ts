import axios from 'axios';

/**
 * Extrait la couleur dominante d'un logo de manière asynchrone et ultra-légère.
 * Dessine l'image dans un canvas 30x30 pixels pour regrouper les nuances.
 */
export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    // crossOrigin nécessaire si l'image provient d'un autre port en dev local
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('rgb(126, 217, 87)'); // Vert K'PSy par défaut
          return;
        }

        // Réduire à 30x30 pixels pour agréger
        canvas.width = 30;
        canvas.height = 30;
        ctx.drawImage(img, 0, 0, 30, 30);

        const imgData = ctx.getImageData(0, 0, 30, 30);
        const data = imgData.data;

        const colorCounts: { [color: string]: { r: number; g: number; b: number; count: number } } = {};
        let maxCount = 0;
        let dominantColor = 'rgb(126, 217, 87)';

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Ignorer les pixels transparents ou semi-transparents
          if (a < 200) continue;

          // Ignorer les pixels trop sombres (noir, ombres, texte foncé)
          if (r < 30 && g < 30 && b < 30) continue;

          // Ignorer les pixels trop clairs (blanc, gris très clair d'arrière-plan)
          if (r > 220 && g > 220 && b > 220) continue;

          // Regrouper par tolérance (pas de 16) pour consolider les teintes similaires
          const step = 16;
          const rd = Math.round(r / step) * step;
          const gd = Math.round(g / step) * step;
          const bd = Math.round(b / step) * step;
          const key = `${rd},${gd},${bd}`;

          if (!colorCounts[key]) {
            colorCounts[key] = { r, g, b, count: 0 };
          }
          colorCounts[key].count += 1;

          if (colorCounts[key].count > maxCount) {
            maxCount = colorCounts[key].count;
            dominantColor = `rgb(${r}, ${g}, ${b})`;
          }
        }

        resolve(dominantColor);
      } catch (e) {
        console.warn("Échec de l'extraction de la couleur dominante, utilisation du vert K'PSy :", e);
        resolve('rgb(126, 217, 87)');
      }
    };
    img.onerror = () => {
      resolve('rgb(126, 217, 87)');
    };
  });
}

function parseRgb(rgbStr: string): { r: number; g: number; b: number } | null {
  const match = rgbStr.match(/\d+/g);
  if (match && match.length >= 3) {
    return {
      r: parseInt(match[0], 10),
      g: parseInt(match[1], 10),
      b: parseInt(match[2], 10),
    };
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r = l, g = l, b = l;

  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function getHoverColor(rgbStr: string): string {
  const rgb = parseRgb(rgbStr);
  if (!rgb) return 'rgb(107, 198, 69)';
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Assombrir légèrement la couleur dominante pour l'effet de survol (hover)
  const newL = hsl.l > 40 ? Math.max(0, hsl.l - 12) : Math.min(100, hsl.l + 12);
  const hoverRgb = hslToRgb(hsl.h, hsl.s, newL);
  return `rgb(${hoverRgb.r}, ${hoverRgb.g}, ${hoverRgb.b})`;
}

/**
 * Applique les variables de thème accentuées au :root du document
 */
export async function applyTenantTheme(logoUrl: string | null, useLogoColors: boolean) {
  const root = document.documentElement;

  if (useLogoColors && logoUrl) {
    // Si logoUrl commence par /, on construit l'URL de base pour éviter les en-têtes d'API
    let targetUrl = logoUrl;
    if (logoUrl.startsWith('/')) {
      const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || '';
      const baseUrl = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
      targetUrl = `${baseUrl}${logoUrl}`;
    }

    const dominantColor = await extractDominantColor(targetUrl);
    const hoverColor = getHoverColor(dominantColor);
    const rgb = parseRgb(dominantColor);
    const r = rgb?.r ?? 126;
    const g = rgb?.g ?? 217;
    const b = rgb?.b ?? 87;

    root.style.setProperty('--accent-primary', dominantColor);
    root.style.setProperty('--accent-hover', hoverColor);
    root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
    root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.1)`);
    root.style.setProperty('--success', dominantColor);
  } else {
    // Restaurer le Vert K'PSy d'origine
    root.style.setProperty('--accent-primary', '#7ED957');
    root.style.setProperty('--accent-hover', '#6bc645');
    root.style.setProperty('--accent-glow', 'rgba(126, 217, 87, 0.35)');
    root.style.setProperty('--accent-soft', 'rgba(126, 217, 87, 0.1)');
    root.style.setProperty('--success', '#7ED957');
  }
}
