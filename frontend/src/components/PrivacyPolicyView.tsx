import React from 'react';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
        <img src="/logo.png" alt="KPSyDesk" style={{ height: '36px' }} />
        <button 
          onClick={onBack} 
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="ph ph-arrow-left"></i> Retour à la connexion
        </button>
      </div>

      <div style={{ flex: 1, padding: '3rem 2rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '800px', width: '100%', background: 'var(--bg-secondary)', borderRadius: '16px', padding: '3rem', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <i className="ph-fill ph-shield-check" style={{ fontSize: '1.8rem' }}></i>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Protection de vos données personnelles</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p style={{ fontSize: '1.1rem', margin: 0 }}>
              KPSyDesk s'engage à protéger les données que vous nous confiez, dans le respect de la loi sénégalaise n° 2008-12 du 25 janvier 2008 relative à la protection des données à caractère personnel, sous le contrôle de la Commission de Protection des Données Personnelles (CDP).
            </p>

            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph-duotone ph-buildings" style={{ color: 'var(--primary)' }}></i> Isolation totale entre entreprises abonnées
              </h2>
              <p style={{ margin: 0 }}>
                Chaque organisation cliente dispose d'un espace de données strictement cloisonné. Aucune entreprise abonnée ne peut accéder, même partiellement, aux données d'une autre — cette isolation est appliquée au niveau technique de notre infrastructure, pas seulement au niveau de l'interface.
              </p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph-duotone ph-chart-bar" style={{ color: 'var(--primary)' }}></i> Mesure d'audience
              </h2>
              <p style={{ margin: 0 }}>
                Nous collectons de manière anonyme certaines données techniques (adresse IP, pages consultées, navigateur utilisé) afin de mesurer la fréquentation de la plateforme et d'améliorer nos services. Ces données ne sont jamais utilisées pour vous identifier individuellement et sont conservées pendant une durée maximale de 90 jours, après quoi elles sont automatiquement supprimées.
              </p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph-duotone ph-user-list" style={{ color: 'var(--primary)' }}></i> Vos droits
              </h2>
              <p style={{ margin: 0 }}>
                Conformément à la loi, vous disposez d'un droit d'accès, de rectification et d'opposition concernant vos données personnelles. Pour toute demande, contactez-nous à <a href="mailto:kpsy1informatik@gmail.com" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>kpsy1informatik@gmail.com</a>.
              </p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph-duotone ph-lock-key" style={{ color: 'var(--primary)' }}></i> Sécurité
              </h2>
              <p style={{ margin: 0 }}>
                L'accès à votre compte est protégé par un mot de passe conforme aux standards de sécurité actuels, avec possibilité d'activer une authentification à deux facteurs. Toutes les communications avec nos serveurs sont chiffrées (HTTPS).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
