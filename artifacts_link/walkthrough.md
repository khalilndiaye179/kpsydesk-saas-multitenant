# Walkthrough — Reconstruction d'Architecture & Dockerisation (Inventaire Parc Informatique)

L'architecture de l'application **@.Inventaire Parc Informatique** a été entièrement reconstruite avec succès. L'application est passée d'un modèle Electron monolithique à une architecture client-serveur moderne (NestJS + React + PostgreSQL) entièrement conteneurisée sous Docker.

Toutes les images Docker ont été compilées avec succès et sont prêtes à fonctionner de manière autonome.

---

## Architecture Finale du Projet

Voici l'arborescence résultant de la migration :

```
@.Inventaire Parc Informatique/
├── backend/
│   ├── src/                     # Code API NestJS (modules assets, tickets, users, auth)
│   ├── prisma/
│   │   ├── schema.prisma        # Schéma de base de données relationnelle
│   │   └── seed.ts              # Script de peuplement de la base de données
│   ├── Dockerfile               # Dockerfile multi-stage pour NestJS
│   └── package.json
├── frontend/
│   ├── src/                     # Code React / Vite (composants CMDB et Helpdesk)
│   ├── Dockerfile               # Dockerfile multi-stage pour le client (Vite / Nginx)
│   └── nginx.conf               # Configuration Nginx de production
├── legacy_electron_backup/      # Dossier d'archivage des anciens fichiers Electron
├── docker-compose.yml           # Orchestrateur des conteneurs
├── .env / .env.example          # Configuration des ports et identifiants
├── .gitignore                   # Exclusions Git
└── [Guides, Tableaux Excel, Backups ISO de base conservés à la racine]
```

---

## Détails des Modifications

### 1. Archivage et Nettoyage
- Les fichiers et dossiers historiques de l'ancien client lourd Electron (`expired.html`, `index.html`, `main.js`, `preload.js`, dossiers `css`, `js`, `dist`, `node_modules`, etc.) ont été déplacés proprement dans le dossier [legacy_electron_backup/](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/legacy_electron_backup) afin de libérer la racine.
- Les documents importants (Guides d'utilisation PDF, tableaux d'inventaire Excel, backups `.iso`) ont été précieusement préservés à la racine.

### 2. Configuration Docker Globale
- **[docker-compose.yml](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/docker-compose.yml)** : Configure les trois conteneurs (`postgres`, `backend`, `frontend`) avec des volumes nommés pour persister les données de la base de données et isoler les `node_modules`.
- **[.env](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/.env)** : Configure des ports de communication spécifiques pour éviter toute collision avec d'autres serveurs de développement (ex: GestiQuinc) :
  - Port PostgreSQL : **5433**
  - Port Backend NestJS : **3002**
  - Port Frontend React : **3005**

### 3. Backend NestJS
- **[Dockerfile](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/backend/Dockerfile)** : Construit une image optimisée. L'étape de développement intègre la commande automatique `npx prisma db push` qui applique le schéma relationnel à la base PostgreSQL à chaque démarrage du conteneur.
- **[main.ts](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/backend/src/main.ts)** : Mis à jour pour écouter dynamiquement sur `process.env.PORT` et activer la gestion de CORS pour autoriser les requêtes du frontend.
- **[seed.ts](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/backend/prisma/seed.ts)** : Script automatisé qui injecte des départements, sites géographiques, profils utilisateurs de test (Admin, Technicien, Standard), ordinateurs et serveurs (Dell, MacBook, HP ProLiant), et des tickets de support.

### 4. Frontend React
- **[Dockerfile](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/Dockerfile)** : Supporte le rechargement à chaud (Hot Reload) en mode développement, et compile une image légère Nginx en production.
- **Connexion API réelle** :
  - Création du client Axios [api.ts](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/api.ts).
  - Liaison dynamique des listes [AssetList.tsx](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/components/AssetList.tsx), [UserList.tsx](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/components/UserList.tsx) et [TicketList.tsx](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/components/TicketList.tsx) pour consommer l'API en direct.
  - Mise à jour du tableau de bord principal dans [App.tsx](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/App.tsx) pour calculer et afficher de vrais compteurs d'actifs et de tickets basés sur la base de données.
  - **Résilience** : Tous les composants intègrent un mécanisme de secours automatique (fallback) vers les données de simulation au cas où le serveur API est éteint.

## Détails des Modifications Récentes

### 5. Finalisation du Client (19 Modules et Vues)
- **Migration Complète** : Tous les 19 modules présents dans la version d'origine Electron x64 ont été migrés vers des composants React autonomes dans [frontend/src/components/](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/components/) avec fallbacks de secours hors-ligne en cas de backend inaccessible.
- **Gestion Sécurisée de la Session ([App.tsx](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/App.tsx))** :
  - **Écran de Connexion Premium** : Interface centrée avec effet de flou et identifiants de test préremplis.
  - **Forçage Premier Mot de Passe** : Si l'utilisateur se connecte avec son mot de passe initial de démo (`admin123`, `tech`, `log`, etc.), une vue intermédiaire l'oblige à enregistrer un mot de passe personnalisé avant d'accéder aux données.
  - **MFA (Authentification Multifacteur)** : Détection dynamique de l'état MFA dans le profil de l'utilisateur. En cas d'activation, un écran de saisie de code à 6 chiffres bloque l'accès (code de validation universel : `123456`).
- **Barre Latérale (Sidebar) Collapsible & Dynamic** :
  - Structure rétractable par clic sur bouton caret (`Ctrl/Toggle`) permettant de passer d'un affichage étendu (avec libellés et sections groupées) à un affichage minimaliste (icônes seules avec bulles d'aide).
  - Préservation du bloc de crédit de **Ibrahima NDIAYE** à la base de la barre latérale en mode étendu et via bulle d'aide en mode réduit.
- **Thème Clair / Sombre** : Intégration de variables CSS adaptatives dans [index.css](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l'IA/@.Inventaire%20Parc%20Informatique/frontend/src/index.css) pilotées par un bouton icône d'en-tête (alternance Soleil/Lune) avec persistance locale dans le `localStorage`.
- **Régulation d'Accès par Rôles (RBAC)** :
  - **Admin IT** : Accès total aux 19 vues.
  - **Technicien IT** : Droits opérationnels (Dashboard, Actifs, Mouvements, Tickets, Licences, Maintenances, SLA, Onboarding, FAQ/KB, Guide, Profil).
  - **Logistique / Achat** : Droits stocks/approvisionnements (Dashboard, Actifs, Mouvements, Magasins/Stocks, Achats/Commandes, FAQ/KB, Guide, Profil).
  - **Finance** : Suivi financier (Dashboard, Achats/Commandes, Contrats, Ventes/Cessions, FAQ/KB, Guide, Profil).
  - **Ressources Humaines** : Gestion personnel (Dashboard, Collaborateurs, Onboarding/Offboarding, FAQ/KB, Guide, Profil).
  - **Utilisateur Standard** : Support uniquement (Dashboard, Tickets, FAQ/KB, Guide, Profil).

---

## Corrections des Bugs

### Audit Global et Correction des 19 Modules
L'erreur de sauvegarde détectée sur le module d'Onboarding était due à un dysfonctionnement lié à l'ID factice (`id: '1'`) utilisé en l'absence de base de données. 

Suite à un audit complet (QA), il s'est avéré que ce même défaut de conception structurelle affectait potentiellement les 19 modules lors d'une tentative de mise à jour ou de suppression de données factices.

*   **Correction Déployée** : Nous avons écrit et exécuté un correctif automatisé qui a balayé et corrigé simultanément les 19 vues (composants React) de l'application.
*   Désormais, **tous les modules de l'application** :
    * Ignorent les tentatives de requêtes de mise à jour sur les ID factices.
    * Créent automatiquement la donnée de manière propre en base.
    * Affichent un message d'erreur clair et descriptif issu du serveur au lieu d'une alerte générique en cas d'échec (ex: de `Erreur lors de la suppression` à `Erreur de suppression : Enregistrement non trouvé`).

[Regarder la vidéo de vérification de la sauvegarde d'Onboarding](file:///C:/Users/Ibrahima%20NDIAYE/.gemini/antigravity-ide/brain/ee01c21c-09d4-486a-bfbb-278009ec2156/onboarding_fix_verification_1781897370570.webp)

---

## Captures d'Écran de l'Interface

Voici les captures d'écran et animations démontrant la conformité visuelle et l'organisation des interfaces :

![Nouvel Écran de Connexion Scindé](C:/Users/Ibrahima NDIAYE/.gemini/antigravity-ide/brain/ee01c21c-09d4-486a-bfbb-278009ec2156/login_page_toast_check_1781887718842.png)
*Figure 1 : Écran de connexion corporate scindé (55% marque / 45% accès sécurisé) aux couleurs de K'PSy Informatique avec logo, crédits et message de bienvenue KPSyDesk ITAM.*

![Test de Validation de Connexion](C:/Users/Ibrahima NDIAYE/.gemini/antigravity-ide/brain/ee01c21c-09d4-486a-bfbb-278009ec2156/kpsy_login_function_test_1781887427114.webp)
*Figure 2 : Enregistrement de la validation de connexion avec redirection vers le tableau de bord.*

![Tableau de Bord Personnalisé](C:/Users/Ibrahima NDIAYE/.gemini/antigravity-ide/brain/ee01c21c-09d4-486a-bfbb-278009ec2156/kpsy_new_dashboard_1781886962333.png)
*Figure 3 : Tableau de bord aux couleurs de K'PSy Informatique (violet & vert néon) avec graphiques adaptés.*

![Architecture de l'Application dans A propos](C:/Users/Ibrahima NDIAYE/.gemini/antigravity-ide/brain/ee01c21c-09d4-486a-bfbb-278009ec2156/about_architecture_1781887935158.png)
*Figure 4 : Vue "À Propos" listant de manière structurée toute l'architecture technique (Frontend, Backend, Database, DevOps).*


---

## Validation et Robustesse du Code

Le code de l'application a été entièrement vérifié par compilation :
1. **TypeScript** : Ajout d'une configuration `tsconfig.json` complète pour le compilateur TypeScript dans la section frontend et correction de toutes les anomalies de typage (`justifycontent` mal orthographié, variables d'état manquantes, typages implicites `any`).
2. **Production Build** : Lancement réussi de `npm run build` dans le conteneur frontend produisant les fichiers statiques finaux optimisés.
3. **Résilience API** : Si le serveur de base de données ou le backend NestJS est momentanément déconnecté, le frontend bascule automatiquement sur les structures de données mockées de secours pour éviter tout plantage ou écran blanc.

---

## Guide de Démarrage Rapide

Pour lancer l'application sur votre machine locale via Docker :

1. Ouvrez un terminal dans le dossier `@.Inventaire Parc Informatique`.
2. Exécutez la commande suivante pour construire et démarrer les conteneurs :
   ```bash
   docker compose up --build -d
   ```
3. Exécutez le script d'initialisation de données (seed) pour peupler la base de données :
   ```bash
   docker compose exec backend npx prisma db seed
   ```
4. Accédez aux interfaces :
   - Application Frontend : [http://localhost:3005](http://localhost:3005)
   - API Backend : [http://localhost:3002/api](http://localhost:3002/api)

---

# Refonte Esthétique de la Pharmacie Mimi DIOP

Le design du site web de la **Pharmacie Mimi DIOP** (Marie Saliou DIOP) a été entièrement repensé à l'image des grands sites de parapharmacie (style Vital Para) avec une esthétique verte forêt sombre et dorée haut de gamme.

## Améliorations Apportées

1. **Mise en Page Moderne (Double Colonne)** :
   - **Header Premium** : Logo d'officine redessiné, barre de recherche centrale arrondie avec bouton loupe intégré, et widgets interactifs pour les favoris et le panier d'achat.
   - **Barre des Rayons & Sous-Navigation** : Bouton dropdown dynamique pour explorer les rayons directement, et liens horizontaux épurés.
   - **Sidebar de Filtres (Colonne Gauche)** : Recherche rapide de marque, filtres de rayons/catégories par checkboxes, critères de stock et promotions, et slider de prix interactif.
   - **Grille de Produits (Colonne Droite)** : Fiches produits de type e-commerce avec badges de promotions/nouveautés, bouton favori interactif (coeur), prix (avec ancien prix barré pour les promos), bouton "Ajouter au panier" et bouton direct de commande sur WhatsApp.

2. **Refonte Visuelle (`css/styles.css`)** :
   - Charte de couleurs premium : Vert forêt médical profond (`#154c30`), vert forêt sombre (`#0c301d`) et or/bronze mat (`#c5a880`) pour les boutons, prix et badges.
   - Ombres délicates, transitions fluides et animations de survol (hover) interactives pour un aspect qualitatif et réactif.

3. **Logique Interactive et Filtres (`js/main.js`)** :
   - Liaison dynamique des catégories et produits depuis la base Firestore.
   - Simulation du panier et des favoris : incrémentation en temps réel des compteurs du header et calcul dynamique du montant total du panier.

## Indicateur "En phase test"

Conformément à la demande, nous avons ajouté un indicateur **"En phase test"** dans l'entête :
- **Texte en gras et en majuscules**, idéalement positionné tout en haut à gauche du bandeau de la barre supérieure.
- **Style rouge fluorescent** (néon clignotant) avec des ombres portées lumineuses (`text-shadow`) pour un rendu éclatant.
- **Animation de clignotement** fluide (`animation: blink-neon 0.8s infinite alternate`).

![Indicateur En phase test](C:/Users/Ibrahima NDIAYE/.gemini/antigravity-ide/brain/ee01c21c-09d4-486a-bfbb-278009ec2156/badge_presence_1781915843723.png)
*Figure 5 : Indicateur "En phase test" clignotant en rouge fluorescent.*

![Vidéo de démonstration](C:/Users/Ibrahima NDIAYE/.gemini/antigravity-ide/brain/ee01c21c-09d4-486a-bfbb-278009ec2156/verify_test_indicator_1781915834857.webp)
*Figure 6 : Animation démontrant le clignotement et l'interaction des filtres et du panier.*


