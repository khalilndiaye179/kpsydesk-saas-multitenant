import React from 'react';

interface AppLandingViewProps {
  onAccess: () => void;
}

export const AppLandingView: React.FC<AppLandingViewProps> = ({ onAccess }) => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0f071a', // var(--bg-primary)
      color: '#f6effc', // var(--text-primary)
      padding: '20px',
      textAlign: 'center',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: '600px',
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
            outline: 'none'
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

      {/* Footer info */}
      <div style={{
        marginTop: '30px',
        color: '#9f8ea8',
        fontSize: '0.85rem'
      }}>
        © 2026 K'PSy Informatique — Tous droits réservés.
      </div>
    </div>
  );
};
