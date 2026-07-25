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
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <style>{`
        .service-hover-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border-radius: 8px;
          transition: all 0.3s ease;
          border-left: 3px solid transparent;
          background: rgba(255, 255, 255, 0.02);
          text-decoration: none;
          color: inherit;
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
        .service-img {
          width: 50px;
          height: 50px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid #2a183d;
          transition: border-color 0.2s ease;
        }
        .service-hover-item:hover .service-img {
          border-color: #7ED957;
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

      {/* Top Banner */}
      <div style={{
        width: '100%',
        background: 'linear-gradient(90deg, #1a0e28 0%, #2a183d 50%, #1a0e28 100%)',
        borderBottom: '1px solid #7ED957',
        padding: '12px 20px',
        textAlign: 'center',
        fontSize: '0.9rem',
        color: '#f6effc',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 2px 15px rgba(126, 217, 87, 0.15)',
        zIndex: 10
      }}>
        <span>🚀 <strong>Nouveau KPSyDesk ITAM</strong> : Optimisez la gestion de votre infrastructure et de vos tickets de support.</span>
        <a href="https://www.kpsyinformatique.com" target="_blank" rel="noopener noreferrer" style={{
          color: '#7ED957',
          textDecoration: 'none',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          Découvrir nos services vitrine <i className="fas fa-arrow-right" style={{ fontSize: '0.8rem' }}></i>
        </a>
      </div>

      {/* Main Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px 20px'
      }}>
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
              
              <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=100&q=80" alt="Maintenance" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Contrats de Maintenance</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Assistance mensuelle prioritaire et dépannage sous 24h.</p>
                </div>
              </a>

              <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=100&q=80" alt="Solaire" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Énergie Solaire & UPS</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Onduleurs et kits de secours contre les coupures Senelec.</p>
                </div>
              </a>

              <a href="https://www.kpsyinformatique.com/#boutique" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=100&q=80" alt="PC Venant" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Matériel Informatique</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Vente d'ordinateurs d'Europe ("Venants") garantis.</p>
                </div>
              </a>

              <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=100&q=80" alt="Réseau" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Réseaux & Téléphonie IP</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Installation standards VoIP et câblage structuré.</p>
                </div>
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
              
              <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=100&q=80" alt="Dev" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Développement Web</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Création de sites web et applications sur mesure.</p>
                </div>
              </a>

              <a href="https://www.kpsyinformatique.com/#teleassistance" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1534536281715-e28d76689b4d?auto=format&fit=crop&w=100&q=80" alt="Téléassistance" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Téléassistance Rapide</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Dépannage à distance sécurisé sous AnyDesk.</p>
                </div>
              </a>

              <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=100&q=80" alt="Audit" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Audit & Conseil IT</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Optimisation réseau et conseils en transformation digitale.</p>
                </div>
              </a>

              <a href="https://www.kpsyinformatique.com/#services" target="_blank" rel="noopener noreferrer" className="service-hover-item">
                <img src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=100&q=80" alt="Formation" className="service-img" />
                <div>
                  <h4 style={{ color: '#f6effc', fontSize: '0.95rem', marginBottom: '2px', fontWeight: 600 }}>Formation & Accompagnement</h4>
                  <p style={{ color: '#9f8ea8', fontSize: '0.8rem', lineHeight: '1.3' }}>Formations bureautiques et support numérique.</p>
                </div>
              </a>

            </div>
          </div>

        </div>
      </div>

      {/* Footer info */}
      <div style={{
        padding: '20px',
        color: '#9f8ea8',
        fontSize: '0.85rem',
        textAlign: 'center',
        borderTop: '1px solid #1a0e28'
      }}>
        © 2026 K'PSy Informatique — Tous droits réservés.
      </div>
    </div>
  );
};
