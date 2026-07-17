# Plan d'implémentation : Amélioration du design de la Pharmacie Mimi DIOP

Refondre l'interface du site web de la Pharmacie Mimi DIOP (Marie Saliou DIOP) pour adopter la mise en page premium d'un site de e-commerce / parapharmacie (type Vital Para) avec des couleurs plus sombres (vert forêt profond, accents bronze/doré, fond épuré).

## User Review Required

> [!NOTE]
> Nous allons conserver l'intégration Firebase existante intacte afin de ne pas casser la synchronisation avec l'espace professionnel (gestion.html), tout en étendant la structure HTML et le style CSS pour incorporer :
> - Une barre de recherche fonctionnelle dans le header pour filtrer les produits en temps réel.
> - Un panneau latéral de filtres (Marques, Catégories, Statut de stock, Slider de prix).
> - Des compteurs visuels premium (Favoris, Panier) et un bouton dropdown des rayons.
> - Un badge de réduction fictif et une fiche produit soignée.

## Proposed Changes

### [Pharmacie Mimi DIOP Website Redesign]

---

#### [MODIFY] [index.html](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l%27IA/@.Pharmacie%20Mimi%20DIOP/index.html)
- Mettre à jour la structure du header :
  - **Top Bar** : Liens d'accès rapide, horaires, téléphone et accès "Espace Pro" sous forme d'icône/lien Mon Compte.
  - **Barre principale** : Logo "Pharmacie Mimi DIOP" à gauche, grande barre de recherche arrondie au centre, et widgets Favoris (coeur) & Panier (caddie avec badge) à droite.
  - **Menu de navigation** : Bouton dropdown "RAYONS" à gauche avec fond vert foncé, liste de liens (Accueil, Marques, Promotions, Contact) au centre, et numéro de téléphone d'assistance à droite.
- Structurer le corps de la page en deux colonnes :
  - **Sidebar Gauche** : Filtres interactifs (Recherche de marque, Rayons/Catégories, Disponibilité de stock, Slider de prix de 1 000 à 50 000 FCFA).
  - **Zone Droite Principale** :
    - Un Hero Banner raffiné et compact avec fond vert forêt sombre texturé.
    - Une grille de produits dynamique à 3 ou 4 colonnes.
- Mettre à jour la section **Newsletter** en bas avec un style bannière verte élégant.
- Harmoniser le footer pour inclure les détails de contact, les réseaux sociaux et la mention de K'PSy Informatique.

#### [MODIFY] [styles.css](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l%27IA/@.Pharmacie%20Mimi%20DIOP/css/styles.css)
- Mettre en place la nouvelle charte graphique avec des variables CSS :
  - `--primary` : `#12462b` (Vert forêt médical profond)
  - `--primary-light` : `#1b5d3c`
  - `--primary-dark` : `#0c311e`
  - `--accent` : `#c5a880` (Bronze/or mat élégant pour boutons secondaires, prix ou badges)
  - `--bg-light` : `#f5f7f6`
  - `--text-dark` : `#212529`
- Styliser la barre de recherche avec bouton loupe intégré.
- Concevoir la mise en page double colonne (`display: flex` ou `grid`).
- Rendre les fiches produits identiques à la capture : contours soignés, badges colorés, boutons d'action d'achat rapides, effet de survol sophistiqué avec micro-animations.
- Styliser le panneau de filtres avec des accordéons ou des sections claires et des checkboxes personnalisées.

#### [MODIFY] [main.js](file:///d:/Formation%20creation%20site%20web%20pro%20avec%20l%27IA/@.Pharmacie%20Mimi%20DIOP/js/main.js)
- Étendre le script pour :
  - Implémenter le filtrage combiné (Recherche textuelle + Filtre par catégorie de la sidebar + Filtre par marque + Filtre par prix + Filtre par stock).
  - Mettre à jour le générateur de fiches produits pour correspondre au nouveau format HTML premium (contenant des boutons "Ajouter au Panier" et des badges).
  - Ajouter l'interactivité sur le panier et les favoris (incrémentation fictive au clic pour renforcer le réalisme).
  - Gérer l'ouverture/fermeture du menu dropdown des rayons.

## Verification Plan

### Manual Verification
1. Ouvrir l'application dans le navigateur et vérifier la disposition sur écran large et mobile.
2. Tester la barre de recherche en saisissant des noms de produits.
3. Tester les filtres latéraux (Catégories, Marques, Slider de prix) pour s'assurer que l'affichage des produits se met à jour instantanément.
4. Cliquer sur "Ajouter au Panier" pour observer la mise à jour dynamique du compteur de panier dans le header.
5. S'assurer que le bouton d'accès à l'Espace Pro fonctionne toujours.
