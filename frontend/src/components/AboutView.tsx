import React, { useEffect, useState } from 'react';

const validHashes = [
  "D3R4-P29X-B87A-YSPK", "Q78P-K43Z-M1L9-YSPK", "C98B-W21V-N56T-YSPK",
  "M91L-F67H-R34Q-YSPK", "P12X-D45J-T98E-YSPK", "N43F-V89C-K12M-YSPK",
  "D18W-H23R-Y67U-YSPK", "C76Z-B91N-G45S-YSPK", "K54T-M78L-D21P-YSPK",
  "V65C-R32W-F89H-YSPK", "M21J-P67X-N54B-YSPK", "D87R-L19K-C23V-YSPK",
  "F43X-T54P-M76D-YSPK", "K65N-V21H-B98Z-YSPK", "P91Q-W78C-R43L-YSPK",
  "B89M-D56T-N21F-YSPK", "C12V-P34X-K78J-YSPK", "M87H-N91B-V65C-YSPK",
  "K54P-L78M-D32R-YSPK", "B76Z-C43F-P19W-YSPK", "T21L-D98V-K54N-YSPK",
  "V65H-B32P-M87X-YSPK", "D54R-N89T-C21G-YSPK", "P98X-M43L-B65K-YSPK",
  "N54W-C21D-V98M-YSPK"
];

const validHashes2Years = [
  "7T3Q-2L9V-4M8A-2SPK", "9R4W-1K8C-7N5B-2SPK", "3M1Y-8J4F-6P2D-2SPK",
  "6N5Z-2H7G-3Q9E-2SPK", "4P8X-9G6H-1R3F-2SPK", "1Q7V-4F2J-8S6G-2SPK",
  "2R3U-7D9K-5T1H-2SPK", "9M6T-1S5L-2V4J-2SPK", "4N2S-6R3M-9W7K-2SPK",
  "1P9R-4Q8N-6X2L-2SPK", "8T4Q-7V1P-3Y5M-2SPK", "5M7P-2W6Q-1Z8N-2SPK",
  "2L1N-5X4R-9B3P-2SPK", "8K5M-1Y9S-4C6Q-2SPK", "3J4L-8Z2T-7D9R-2SPK",
  "6H9K-3B7V-2F1S-2SPK", "7F2J-9C1W-5G4T-2SPK", "1G7H-6D5X-3H8V-2SPK",
  "9D4G-1F8Y-6J2W-2SPK", "2C9F-4G3Z-1K7X-2SPK", "5V1D-2H6B-8L9Y-2SPK",
  "3B8S-7J1C-5M4Z-2SPK", "1M6R-3K5D-9N2B-2SPK", "7N2Q-9L8F-4P5C-2SPK",
  "4P3T-5M1G-2Q8D-2SPK"
];

interface AboutViewProps {
  isSuperAdmin?: boolean;
}

export const AboutView: React.FC<AboutViewProps> = ({ isSuperAdmin = false }) => {
  const [licStatus, setLicStatus] = useState('Version d\'essai');
  const [daysLeft, setDaysLeft] = useState('Calcul en cours...');
  const [activationKey, setActivationKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    checkLicenseInfo();
  }, []);

  const checkLicenseInfo = () => {
    const now = Date.now();
    let installDate = localStorage.getItem('kpsy_install_date');
    let activationInfo = localStorage.getItem('kpsy_activation_info');

    if (!installDate) {
      installDate = now.toString();
      localStorage.setItem('kpsy_install_date', installDate);
    }

    if (activationInfo) {
      try {
        const info = JSON.parse(atob(activationInfo));
        if (info && info.activatedAt) {
          const duration = info.duration || 365;
          const diffDays = (now - info.activatedAt) / (1000 * 60 * 60 * 24);
          if (diffDays <= duration) {
            setLicStatus("Activé (PRO)");
            setDaysLeft(`${Math.ceil(duration - diffDays)} jour(s)`);
            return;
          }
        }
      } catch (e) {}
    }

    const diffDays = (now - parseInt(installDate)) / (1000 * 60 * 60 * 24);
    if (diffDays <= 15) {
      setLicStatus("Version d'essai");
      setDaysLeft(`${Math.max(0, Math.ceil(15 - diffDays))} jour(s)`);
    } else {
      setLicStatus("Licence Expirée");
      setDaysLeft("0 jour");
    }
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    const key = activationKey.trim().toUpperCase();

    if (key === 'TEST-1HOUR-KPSY-2026') {
      const info = { key: btoa(key), activatedAt: Date.now(), duration: 0.04 }; // ~1h
      localStorage.setItem('kpsy_activation_info', btoa(JSON.stringify(info)));
      alert("Clé test temporaire activée avec succès pour 1 heure !");
      setActivationKey('');
      setErrorMsg('');
      checkLicenseInfo();
      return;
    }

    const reversed = key.split('').reverse().join('');
    let activated = false;
    if (validHashes.includes(reversed)) {
      const info = { key: btoa(key), activatedAt: Date.now(), duration: 365 };
      localStorage.setItem('kpsy_activation_info', btoa(JSON.stringify(info)));
      activated = true;
    } else if (validHashes2Years.includes(reversed)) {
      const info = { key: btoa(key), activatedAt: Date.now(), duration: 730 };
      localStorage.setItem('kpsy_activation_info', btoa(JSON.stringify(info)));
      activated = true;
    }

    if (activated) {
      alert("Félicitations, votre licence KPSyDesk a été activée avec succès !");
      setActivationKey('');
      setErrorMsg('');
      checkLicenseInfo();
    } else {
      setErrorMsg("Clé d'activation invalide ou expirée.");
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '5px' }}>
          {isSuperAdmin ? 'KPSyDesk Console' : 'KPSyDesk'}
        </h1>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
          IT Asset Management v3.0 (PRO)
        </h3>
      </div>

      <div className="module-container" style={{ maxWidth: '750px', width: '100%', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          {isSuperAdmin ? 'Informations Techniques & SaaS' : 'Informations Techniques'}
        </h3>
        <ul style={{ listStyle: 'none', lineHeight: 2, color: 'var(--text-secondary)' }}>
          <li>
            <strong>Version de l'application :</strong> {isSuperAdmin ? '3.0.0 (Multi-Tenant)' : '3.0.0'}
          </li>
          <li>
            <strong>Type de licence :</strong> {isSuperAdmin ? 'SaaS Commercial' : 'Propriétaire'}
          </li>
          {!isSuperAdmin && (
            <>
              <li>
                <strong>Statut de la licence :</strong>{' '}
                <span style={{ color: licStatus.includes('Activé') ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold' }}>
                  {licStatus}
                </span>
              </li>
              <li><strong>Temps restant :</strong> <strong>{daysLeft}</strong></li>
            </>
          )}
          <li>
            <strong>Dernière mise à jour :</strong> {isSuperAdmin ? 'Juillet 2026' : 'Juin 2026'}
          </li>
        </ul>
      </div>

      {isSuperAdmin && (
        <div className="module-container" style={{ maxWidth: '750px', width: '100%', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Architecture de l'Application</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.6' }}>
            L'application <strong>KPSyDesk ITAM</strong> est conçue sur une architecture client-serveur moderne, découplée et conteneurisée sous Docker. Voici les composants technologiques principaux de l'architecture :
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-desktop" style={{ fontSize: '1.2rem' }}></i>
                Frontend (Client)
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li><strong>Framework :</strong> React 18 & TypeScript</li>
                <li><strong>Outil de build :</strong> Vite (rechargement à chaud ultra-rapide)</li>
                <li><strong>Serveur de prod :</strong> Nginx conteneurisé</li>
                <li><strong>Graphiques :</strong> Chart.js</li>
                <li><strong>Exportations :</strong> SheetJS (Excel) & jsPDF</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-cpu" style={{ fontSize: '1.2rem' }}></i>
                Backend (Serveur API)
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li><strong>Framework :</strong> NestJS (Node.js framework d'entreprise)</li>
                <li><strong>Langage :</strong> TypeScript</li>
                <li><strong>ORM :</strong> Prisma ORM</li>
                <li><strong>Sécurité :</strong> JWT multi-tenant & RLS</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-database" style={{ fontSize: '1.2rem' }}></i>
                Base de Données
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li><strong>SGBD :</strong> PostgreSQL 16 (Alpine)</li>
                <li><strong>Persistance :</strong> Volumes Docker nommés</li>
                <li><strong>Migration :</strong> Prisma CLI Sync</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-package" style={{ fontSize: '1.2rem' }}></i>
                Conteneurisation & DevOps
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li><strong>Orchestration :</strong> Docker Compose v3.8</li>
                <li><strong>Réseaux :</strong> Isolation par Bridge Virtuel</li>
                <li><strong>Builds :</strong> Dockerfiles optimisés multi-stage</li>
              </ul>
            </div>

          </div>
        </div>
      )}

      {!isSuperAdmin && (
        <div className="module-container" style={{ maxWidth: '750px', width: '100%', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Activer la Licence</h3>
          <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Entrez votre clé d'activation (KPSY-XXXX-XXXX-XXXX)</label>
              <input 
                type="text" 
                placeholder="Ex: C76Z-B91N-G45S-YSPK"
                value={activationKey}
                onChange={e => setActivationKey(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', fontSize: '1rem', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }}
                required
              />
            </div>
            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}
            <button type="submit" className="btn-primary" style={{ alignSelf: 'center', padding: '0.75rem 2rem' }}>
              Activer l'application
            </button>
          </form>
        </div>
      )}

      <div className="module-container" style={{ maxWidth: '750px', width: '100%', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'white' }}>Développement & Assistance</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Conçu et réalisé par :</p>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '10px' }}>Ibrahima NDIAYE</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
          <a href="mailto:neguinho.ndiaye@gmail.com" style={{ color: 'inherit', textDecoration: 'none' }}>
            <i className="ph ph-envelope"></i> neguinho.ndiaye@gmail.com
          </a>
          <a href="tel:+221778034756" style={{ color: 'inherit', textDecoration: 'none' }}>
            <i className="ph ph-phone"></i> +221 77 803 47 56
          </a>
        </div>
      </div>
    </div>
  );
};


