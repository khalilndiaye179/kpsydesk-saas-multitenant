const puppeteer = require('puppeteer');
const fs = require('fs');

const APP_URL = 'http://localhost:3011';
const TENANT_URL = 'http://ladin.localhost:3011';

async function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

(async () => {
  console.log("Démarrage du script de capture d'écran...");
  
  if (!fs.existsSync('screenshots')){
      fs.mkdirSync('screenshots');
  }

  const browser = await puppeteer.launch({ 
    headless: false, // Afficher le navigateur pour voir ce qu'il fait
    defaultViewport: { width: 1920, height: 1080 } 
  });
  const page = await browser.newPage();

  console.log("1. Écran de Connexion");
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
  await delay(1000);
  await page.screenshot({ path: 'screenshots/1_login.png' });

  console.log("Connexion en tant que Super Admin...");
  // Remplacez par vos vrais identifiants
  await page.type('input[type="email"]', 'khalilndiaye179@gmail.com');
  await page.type('input[type="password"]', 'itam_password_dev_2026');
  await page.click('button[type="submit"]');
  await delay(3000); // Attendre la connexion et le changement de page

  console.log("2. Console Super Admin");
  await delay(2000); // Laisser les données se charger
  await page.screenshot({ path: 'screenshots/2_super_admin.png' });

  console.log("Déconnexion...");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  console.log("Connexion au Tenant (LADIN) via API depuis Node...");
  
  // Node API Login
  const apiResponse = await fetch('http://localhost:3010/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'ladin'
    },
    body: JSON.stringify({ email: 'ladin@kpsy.com', password: '@Passer123' })
  });
  
  const loginData = await apiResponse.json();
  
  await page.goto(`${TENANT_URL}/login`, { waitUntil: 'networkidle2' });

  if (loginData.access_token) {
    console.log("Login API réussi, injection du token...");
    await page.evaluate((data) => {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('token', data.access_token);
      
      const user = data.user;
      user.tenantSubdomain = 'ladin';
      user.tenant = { plan: { name: 'Enterprise' } };
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('tenant_subdomain', 'ladin');
    }, loginData);
  } else {
    console.log("ERREUR DE CONNEXION API:", loginData);
  }

  // Reload to apply auth
  await page.goto(`${TENANT_URL}/`, { waitUntil: 'networkidle2' });
  await delay(5000);
  
  console.log("Navigation à travers les modules...");
  
  const modules = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.menu-item')).map(el => el.textContent.trim());
  });

  if (modules.length === 0) {
    console.log("Aucun module trouvé. Prise d'une capture d'écran pour debug...");
    await page.screenshot({ path: 'screenshots/debug_no_modules.png' });
  }

  // Handle alerts triggered by clicking disabled items
  page.on('dialog', async dialog => {
    console.log(`Boîte de dialogue détectée: ${dialog.message()}`);
    await dialog.accept();
  });

  for (let i = 0; i < modules.length; i++) {
    const modName = modules[i];
    if (!modName) continue;
    console.log(`Capture du module: ${modName}`);
    
    await page.evaluate((name) => {
      const items = Array.from(document.querySelectorAll('.menu-item'));
      const item = items.find(el => el.textContent.trim() === name);
      if (item) item.click();
    }, modName);
    
    await delay(3000);
    
    // Sanitize filename
    const filename = modName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').toLowerCase();
    await page.screenshot({ path: `screenshots/${i + 3}_${filename}.png` });
  }

  console.log("Captures terminées ! Vérifiez le dossier 'screenshots'.");
  await browser.close();
})();
