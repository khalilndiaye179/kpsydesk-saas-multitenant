import React from 'react';

interface AppLandingViewProps {
  onAccess: () => void;
}

export const AppLandingView: React.FC<AppLandingViewProps> = ({ onAccess }) => {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f071a', // var(--bg-primary)
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <style>{`
        .service-hover-item {
          display: block;
          padding: 12px;
          border-radius: 8px;
          transition: all 0.3s ease;
          border-left: 3px solid transparent;
          background: rgba(255, 255, 255, 0.02);
        }
        .service-hover-item:hover {
          background: rgba(126, 217, 87, 0.06) !important;
          border-left-color: #7ED957 !important;
          transform: translateX(4px);
        }
        .service-hover-item h4 {
          transition: color 0.2s ease;
        }
        .service-hover-item:hover h4 {
          color: #7ED957 !important;
        }
        @media (max-width: 1024px) {
          .saas-landing-side-panel {
            display: none !important;
          }
          .saas-landing-container {
            justify-content: center !important;
          }
        }
      `}</style>

      <div className="saas-landing-container" style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '30px',
        maxWidth: '1350px',
        width: '100%',
        margin: '0 auto'
      }}>
        
        {/* Left Side Panel - IT & Infrastructures */}
        <div className="saas-landing-side-panel" style={{
          flex: '1',
          maxWidth: '360px',
          background: 'rgba(26, 14, 40, 0.4)', // var(--bg-secondary) with glassmorphism
          border: '1px solid #2a183d', // var(--border-color)
          borderRadius: '16px',
          padding: '30px 25px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          textAlign: 'left',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          height: 'fit-content'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#7ED957',
            marginBottom: '20px',
            borderBottom: '1px solid #2a183d',
            paddingBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <i className="fas fa-server"></i> IT & Infrastructures
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Contrats de Maintenance</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Assistance mensuelle prioritaire, infogérance complète et dépannage sous 24h.</p>
            </a>

            <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Énergie Solaire & UPS</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Onduleurs et kits solaires pour protéger vos serveurs des coupures Senelec.</p>
            </a>

            <a href="https://www.kpsyinformatique.com/#boutique" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Matériel Informatique</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Vente d'ordinateurs importés d'Europe ("Venants"), testés et certifiés K'PSy.</p>
            </a>

            <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Réseaux & Téléphonie IP</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Standards téléphoniques VoIP, câblage structuré et interconnexion de sites.</p>
            </a>

          </div>
        </div>

        {/* Central Auth Card */}
        <div style={{
          maxWidth: '560px',
          width: '100%',
          background: 'rgba(26, 14, 40, 0.6)', // var(--bg-secondary) with glassmorphism
          border: '1px solid #2a183d', // var(--border-color)
          borderRadius: '16px',
          padding: '50px 30px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 40px rgba(126, 217, 87, 0.05)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }} className="fade-in">
          
          {/* Logo matching the showcase site */}
          <div style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            lineHeight: '1.1',
            marginBottom: '30px',
            letterSpacing: '0.5px'
          }}>
            <span style={{ color: '#7ED957' }}>K'</span>PSY<br />
            <span style={{ fontSize: '1.2rem', fontWeight: 300, color: '#d3c4e3', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Informatique
            </span>
          </div>

          {/* Application Name */}
          <h1 style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            marginBottom: '20px',
            color: '#f6effc'
          }}>
            Bienvenue sur <span style={{ color: '#7ED957', textShadow: '0 0 15px rgba(126, 217, 87, 0.3)' }}>KPSyDesk ITAM</span>
          </h1>

          {/* Description */}
          <p style={{
            color: '#d3c4e3',
            fontSize: '1.1rem',
            lineHeight: '1.6',
            marginBottom: '40px'
          }}>
            Votre plateforme professionnelle de gestion de parc informatique (ITAM), helpdesk d'assistance et de facturation certifiée conforme DGI.
          </p>

          {/* Action Button */}
          <button 
            onClick={onAccess}
            style={{
              backgroundColor: '#7ED957',
              color: '#0f071a',
              border: 'none',
              borderRadius: '8px',
              padding: '16px 32px',
              fontSize: '1.1rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(126, 217, 87, 0.4)',
              transition: 'all 0.3s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              outline: 'none',
              width: '100%',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#6bc645';
              e.currentTarget.style.boxShadow = '0 6px 25px rgba(126, 217, 87, 0.6)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#7ED957';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(126, 217, 87, 0.4)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Accéder à mon espace <i className="fas fa-arrow-right"></i>
          </button>

          <div style={{ marginTop: '25px' }}>
            <a 
              href="https://www.kpsyinformatique.com/" 
              style={{
                color: '#d3c4e3',
                textDecoration: 'none',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#7ED957';
                e.currentTarget.style.transform = 'translateX(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#d3c4e3';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <i className="fas fa-arrow-left" style={{ fontSize: '0.85rem' }}></i> Retourner sur le site vitrine
            </a>
          </div>

        </div>

        {/* Right Side Panel - Services Digitaux */}
        <div className="saas-landing-side-panel" style={{
          flex: '1',
          maxWidth: '360px',
          background: 'rgba(26, 14, 40, 0.4)', // var(--bg-secondary) with glassmorphism
          border: '1px solid #2a183d', // var(--border-color)
          borderRadius: '16px',
          padding: '30px 25px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          textAlign: 'left',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          height: 'fit-content'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#7ED957',
            marginBottom: '20px',
            borderBottom: '1px solid #2a183d',
            paddingBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <i className="fas fa-laptop-code"></i> Services Digitaux
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Développement Web & Mobile</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Conception de sites web professionnels, plateformes e-commerce et applications sur mesure.</p>
            </a>

            <a href="https://www.kpsyinformatique.com/#teleassistance" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Téléassistance Immédiate</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Dépannage à distance instantané et sécurisé par AnyDesk pour vos collaborateurs.</p>
            </a>

            <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Audit & Conseil IT</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Analyse complète de votre sécurité, optimisation réseau et gouvernance des actifs.</p>
            </a>

            <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="service-hover-item">
              <h4 style={{ color: '#f6effc', fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>Formation & Adoption</h4>
              <p style={{ color: '#9f8ea8', fontSize: '0.85rem', lineHeight: '1.4' }}>Formation bureautique et accompagnement au changement vers le numérique.</p>
            </a>

          </div>
        </div>

      </div>

      {/* Footer info */}
      <div style={{
        marginTop: '30px',
        color: '#9f8ea8',
        fontSize: '0.85rem',
        textAlign: 'center'
      }}>
        © 2026 K'PSy Informatique — Tous droits réservés.
      </div>
    </div>
  );
};
