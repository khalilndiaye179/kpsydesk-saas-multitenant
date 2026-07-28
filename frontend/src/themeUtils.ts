const THEME_STORAGE_KEY = 'tenant_theme_colors';

/**
 * Extrait la couleur dominante d'un logo via un canvas masqué.
 * L'image doit être sur la même origine (pas de CORS).
 */
export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    // Pas de crossOrigin sur même domaine — le mettre cause parfois une erreur CORS en production
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }

        // Réduire à 40x40 pixels pour agréger les couleurs
        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        let imgData: ImageData;
        try {
          imgData = ctx.getImageData(0, 0, 40, 40);
        } catch (secErr) {
          // Tainted canvas (cross-origin). Essayer avec crossOrigin
          console.warn('Canvas tainted, retrying with crossOrigin:', secErr);
          resolve('');
          return;
        }

        const data = imgData.data;
        const colorCounts: { [key: string]: { r: number; g: number; b: number; count: number } } = {};
        let maxCount = 0;
        let dominantColor = '';

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 200) continue;                         // Pixel transparent
          if (r < 30 && g < 30 && b < 30) continue;    // Noir / trop sombre
          if (r > 220 && g > 220 && b > 220) continue;  // Blanc / trop clair

          // Regrouper par pas de 20 pour consolider les teintes proches
          const step = 20;
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
        console.warn("Échec extraction couleur dominante :", e);
        resolve('');
      }
    };
    img.onerror = () => {
      resolve('');
    };
  });
}

/**
 * Tente d'extraire la couleur via un second passage avec crossOrigin=anonymous
 * (pour forcer le rechargement avec les en-têtes CORS si le premier passage a échoué)
 */
function extractDominantColorCORS(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Cache-busting pour forcer un rechargement propre sans cache opaque
    img.src = `${imageUrl}?_cors=1`;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);
        const imgData = ctx.getImageData(0, 0, 40, 40);
        const data = imgData.data;

        const colorCounts: { [k: string]: { r: number; g: number; b: number; count: number } } = {};
        let maxCount = 0;
        let dominantColor = '';

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200 || (r < 30 && g < 30 && b < 30) || (r > 220 && g > 220 && b > 220)) continue;
          const step = 20;
          const key = `${Math.round(r / step) * step},${Math.round(g / step) * step},${Math.round(b / step) * step}`;
          if (!colorCounts[key]) colorCounts[key] = { r, g, b, count: 0 };
          colorCounts[key].count++;
          if (colorCounts[key].count > maxCount) {
            maxCount = colorCounts[key].count;
            dominantColor = `rgb(${r}, ${g}, ${b})`;
          }
        }
        resolve(dominantColor);
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
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
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
  h /= 360; s /= 100; l /= 100;
  let r = l, g = l, b = l;
  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function getHoverColor(rgbStr: string): string {
  const rgb = parseRgb(rgbStr);
  if (!rgb) return 'rgb(107, 198, 69)';
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newL = hsl.l > 40 ? Math.max(0, hsl.l - 12) : Math.min(100, hsl.l + 12);
  const h = hslToRgb(hsl.h, hsl.s, newL);
  return `rgb(${h.r}, ${h.g}, ${h.b})`;
}

/** Applique une couleur dominante en variables CSS sur le :root */
function applyColorToRoot(dominantColor: string) {
  const root = document.documentElement;
  const hoverColor = getHoverColor(dominantColor);
  const rgb = parseRgb(dominantColor);
  const r = rgb?.r ?? 126, g = rgb?.g ?? 217, b = rgb?.b ?? 87;

  root.style.setProperty('--accent-primary', dominantColor);
  root.style.setProperty('--accent-hover', hoverColor);
  root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
  root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.1)`);
  root.style.setProperty('--success', dominantColor);
  root.style.setProperty('--primary', dominantColor);
}

/** Réinitialise les variables CSS au thème vert K'PSy d'origine */
function resetToKPSyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', '#7ED957');
  root.style.setProperty('--accent-hover', '#6bc645');
  root.style.setProperty('--accent-glow', 'rgba(126, 217, 87, 0.35)');
  root.style.setProperty('--accent-soft', 'rgba(126, 217, 87, 0.1)');
  root.style.setProperty('--success', '#7ED957');
  root.style.setProperty('--primary', '#7ED957');
  localStorage.removeItem(THEME_STORAGE_KEY);
}

/**
 * Point d'entrée principal.
 * - Si useLogoColors est vrai et qu'un logo existe :
 *   1. On applique immédiatement la couleur mise en cache (localStorage) pour éviter le flash
 *   2. On extrait la vraie couleur en arrière-plan et on met à jour le cache
 * - Sinon, on restaure le vert K'PSy.
 */
export async function applyTenantTheme(logoUrl: string | null | undefined, useLogoColors: boolean) {
  if (!useLogoColors || !logoUrl) {
    resetToKPSyTheme();
    return;
  }

  // 1. Application immédiate depuis le cache (évite le "flash" vert au chargement)
  const cached = localStorage.getItem(THEME_STORAGE_KEY);
  if (cached) {
    try {
      const { color } = JSON.parse(cached);
      if (color) applyColorToRoot(color);
    } catch { /* ignore */ }
  }

  // 2. Construire l'URL absolue de l'image (même origine = pas de CORS sur canvas)
  let targetUrl = logoUrl;
  if (logoUrl.startsWith('/')) {
    // Toujours utiliser window.location.origin → même domaine → canvas autorisé
    targetUrl = `${window.location.origin}${logoUrl}`;
  }

  // 3. Extraction réelle de la couleur dominante (tentative sans crossOrigin d'abord)
  let dominantColor = await extractDominantColor(targetUrl);

  // 4. Si la première tentative échoue (canvas taché), réessayer avec crossOrigin=anonymous
  if (!dominantColor) {
    dominantColor = await extractDominantColorCORS(targetUrl);
  }

  // 5. Appliquer la couleur extraite (ou garder le cache si tout échoue)
  if (dominantColor) {
    applyColorToRoot(dominantColor);
    // Mettre en cache pour les prochains chargements
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ color: dominantColor, logoUrl }));
  } else if (!cached) {
    // Aucune couleur disponible du tout, conserver le vert K'PSy
    console.warn('applyTenantTheme: impossible d\'extraire la couleur du logo, thème K\'PSy conservé.');
  }
}
