import React, { useEffect, useState } from 'react';



interface AboutViewProps {
  isSuperAdmin?: boolean;
}

export const AboutView: React.FC<AboutViewProps> = ({ isSuperAdmin = false }) => {
  const [licStatus, setLicStatus] = useState('Version d\'essai');
  const [daysLeft, setDaysLeft] = useState('Calcul en cours...');

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
    if (diffDays <= 7) {
      setLicStatus("Version d'essai");
      setDaysLeft(`${Math.max(0, Math.ceil(7 - diffDays))} jour(s)`);
    } else {
      setLicStatus("Licence Expirée");
      setDaysLeft("0 jour");
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

      <div className="module-container" style={{ maxWidth: '750px', width: '100%', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'white' }}>Développement & Assistance</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Conçu et réalisé par :</p>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '10px' }}>Ibrahima NDIAYE</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
          <a href="mailto:khalil.ndiaye@kpsyinformatique.com" style={{ color: 'inherit', textDecoration: 'none' }}>
            <i className="ph ph-envelope"></i> khalil.ndiaye@kpsyinformatique.com
          </a>
          <a href="tel:+221778034756" style={{ color: 'inherit', textDecoration: 'none' }}>
            <i className="ph ph-phone"></i> +221 77 803 47 56
          </a>
        </div>
      </div>
    </div>
  );
};


