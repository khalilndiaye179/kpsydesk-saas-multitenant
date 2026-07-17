import React, { useState } from 'react';

export const GuideView: React.FC = () => {
  const [activeSec, setActiveSec] = useState('intro');

  const menuItems = [
    { id: 'intro', label: '1. Introduction' },
    { id: 'dashboard', label: '2. Tableau de bord' },
    { id: 'assets', label: '3. Parc Informatique (Actifs)' },
    { id: 'software', label: '4. Logiciels & Licences' },
    { id: 'stock', label: '5. Stock & Consommables' },
    { id: 'helpdesk', label: '6. Support & Maintenance' },
    { id: 'knowledge', label: '7. Base de connaissances & SLA' },
    { id: 'finance', label: '8. Achats, Ventes & Contrats' },
    { id: 'hr', label: '9. Utilisateurs & RH' },
    { id: 'admin', label: '10. Administration & Sécurité' },
  ];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Guide d'utilisation détaillé</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manuel utilisateur complet pour maîtriser KPSyDesk</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Menu Guide */}
        <div className="module-container" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveSec(item.id)} 
                style={{ 
                  textAlign: 'left', 
                  padding: '10px 15px', 
                  background: activeSec === item.id ? 'var(--accent-soft)' : 'transparent', 
                  color: activeSec === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontWeight: activeSec === item.id ? 600 : 500,
                  transition: 'all 0.2s'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Guide */}
        <div className="module-container" style={{ padding: '30px', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          {activeSec === 'intro' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-info"></i> 1. Introduction & Concepts de Base
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Bienvenue dans <strong>KPSyDesk</strong>, votre plateforme unifiée d'ITSM (IT Service Management) et d'ITAM (IT Asset Management).
              </p>
              <p style={{ marginBottom: '15px' }}>
                Conçue pour centraliser l'ensemble de votre infrastructure informatique, cette solution permet de suivre le cycle de vie de chaque équipement (de l'achat au rebut), de gérer les licences logicielles, de traiter les incidents utilisateurs via un centre de support (Helpdesk), et de gérer l'aspect financier.
              </p>
              <p>
                <strong>Navigation :</strong> Le menu latéral vous permet d'accéder aux différents modules en fonction de vos droits d'accès.
              </p>
            </div>
          )}

          {activeSec === 'dashboard' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-squares-four"></i> 2. Tableau de bord
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Le tableau de bord est le centre névralgique de KPSyDesk. Il vous offre une vue d'ensemble instantanée sur l'état de votre parc et de votre support.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>KPIs en temps réel :</strong> Nombre d'équipements actifs, tickets ouverts, licences expirées, etc.</li>
                <li><strong>Graphiques analytiques :</strong> Répartition du matériel par type, statut, ou département.</li>
                <li><strong>Alertes :</strong> Notifications critiques concernant les seuils de consommables bas ou les fins de garantie proches.</li>
              </ul>
            </div>
          )}

          {activeSec === 'assets' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-desktop"></i> 3. Parc Informatique (Actifs)
              </h2>
              <p style={{ marginBottom: '15px' }}>
                La gestion des actifs matériels (ordinateurs, serveurs, téléphones, etc.) est au cœur du système.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Liste des équipements :</strong> Consultation de l'inventaire avec filtres avancés (statut, type, marque).</li>
                <li><strong>Cycle de vie :</strong> Un matériel peut être <em>En Stock</em>, <em>Actif</em> (attribué), <em>En Panne</em> ou <em>Réformé</em>.</li>
                <li><strong>Amortissement :</strong> Suivi de la valeur comptable des équipements au fil du temps.</li>
                <li><strong>Mouvements :</strong> Historique complet des attributions et changements d'emplacement d'un équipement.</li>
                <li><strong>Extraction :</strong> Export global du parc en formats PDF ou Excel.</li>
              </ul>
            </div>
          )}

          {activeSec === 'software' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-app-window"></i> 4. Logiciels & Licences
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Gérez vos abonnements logiciels pour éviter les surcoûts et la non-conformité.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Suivi des licences :</strong> Ajout de clés de licence, dates d'expiration, et coût par siège.</li>
                <li><strong>Attribution :</strong> Affectation de licences spécifiques à des équipements ou utilisateurs.</li>
                <li><strong>Alertes :</strong> Rappels automatiques avant l'expiration des abonnements annuels.</li>
              </ul>
            </div>
          )}

          {activeSec === 'stock' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-package"></i> 5. Stock & Consommables
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Le module de stock permet de tracer tout le petit matériel non immobilisé.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Emplacements :</strong> Gestion de plusieurs sites, bureaux ou magasins physiques.</li>
                <li><strong>Consommables :</strong> Suivi des toners, souris, câbles réseau, etc.</li>
                <li><strong>Ajustement :</strong> Entrée et sortie rapide de stock (boutons +/- ou édition).</li>
                <li><strong>Seuils d'alerte :</strong> Déclenchement visuel lorsqu'un produit passe sous sa quantité minimale.</li>
                <li><strong>Exports :</strong> Extraction PDF/Excel de l'état actuel des stocks.</li>
              </ul>
            </div>
          )}

          {activeSec === 'helpdesk' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-lifebuoy"></i> 6. Support & Maintenance (Helpdesk)
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Plateforme d'assistance pour vos collaborateurs et suivi des réparations.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Tickets :</strong> Les utilisateurs peuvent signaler un incident ou faire une demande de service.</li>
                <li><strong>Assignation & Statuts :</strong> Les techniciens prennent en charge les tickets (Nouveau, En Cours, Résolu).</li>
                <li><strong>Maintenances Préventives :</strong> Planification des entretiens réguliers du matériel (ex: nettoyage serveur).</li>
                <li><strong>Historique :</strong> Chaque équipement possède un journal complet de ses pannes.</li>
              </ul>
            </div>
          )}

          {activeSec === 'knowledge' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-book-open"></i> 7. Base de Connaissances & SLA
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Autonomisez vos utilisateurs et définissez vos standards de support.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Wiki (FAQ) :</strong> Création d'articles pour aider les utilisateurs à résoudre les problèmes fréquents eux-mêmes (réinitialisation mdp, configuration VPN...).</li>
                <li><strong>SLA (Service Level Agreement) :</strong> Configuration des délais de réponse et de résolution cibles selon la criticité des tickets.</li>
              </ul>
            </div>
          )}

          {activeSec === 'finance' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-currency-circle-dollar"></i> 8. Achats, Ventes & Contrats
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Suivez les flux financiers liés à votre infrastructure informatique.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Achats & Fournisseurs :</strong> Suivi des bons de commande, factures fournisseurs et réceptions.</li>
                <li><strong>Ventes (Cessions) :</strong> Génération de factures automatiques (PDF) pour le matériel réformé vendu aux collaborateurs ou tiers.</li>
                <li><strong>Contrats :</strong> Gestion documentaire des contrats d'assistance, locations (leasing), d'assurance, etc., avec alertes d'échéance.</li>
              </ul>
            </div>
          )}

          {activeSec === 'hr' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-users"></i> 9. Utilisateurs & RH
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Gérez vos collaborateurs et le processus d'intégration.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Annuaire Utilisateurs :</strong> Base de données de tous les collaborateurs avec leurs équipements associés.</li>
                <li><strong>Onboarding / Offboarding :</strong> Checklists complètes pour s'assurer que les nouveaux arrivants reçoivent tout leur matériel et accès, et qu'ils rendent tout lors de leur départ.</li>
              </ul>
            </div>
          )}

          {activeSec === 'admin' && (
            <div className="fade-in">
              <h2 style={{ color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
                <i className="ph ph-gear"></i> 10. Administration & Sécurité
              </h2>
              <p style={{ marginBottom: '15px' }}>
                Configuration avancée du système réservée aux administrateurs.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Rôles (RBAC) :</strong> Gestion des permissions (Admin, Technicien, Utilisateur, RH, Finance).</li>
                <li><strong>Paramètres Généraux :</strong> Personnalisation de l'application (Devise, nom d'entreprise, catégories, statuts).</li>
                <li><strong>Audit Logs :</strong> Journalisation stricte des actions de chaque utilisateur (qui a fait quoi et quand).</li>
                <li><strong>Sauvegardes :</strong> Configuration des exports complets de la base de données pour la sécurité des données.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



