# Prompt à insérer dans le Master Prompt Antigravity
## Fonctionnalité : Adaptation responsive (smartphones & tablettes)

---

### Contexte pour l'agent IA

La plateforme est une PWA offline-first destinée à des utilisateurs qui se connectent
majoritairement depuis un smartphone Android d'entrée/milieu de gamme, parfois une tablette
(écoles, cliniques), rarement un poste fixe en dehors de Dakar. L'application doit donc être
conçue **mobile-first**, avec la Console de Pilotage super-admin pouvant rester desktop-first
mais restant utilisable en tablette.

---

### Règles générales à appliquer sur tout le projet

**1. Approche mobile-first stricte**
- Écrire les styles de base pour mobile, puis surcharger avec des media queries croissantes
  (`min-width`), jamais l'inverse
- Avec Tailwind : utiliser les préfixes `sm:`, `md:`, `lg:`, `xl:` en partant du non-préfixé
  (mobile) comme valeur par défaut

**2. Breakpoints standards du projet**

```
Mobile      : 0 – 639px    (défaut, sans préfixe)
Tablette    : 640px – 1023px  (sm: et md:)
Desktop     : 1024px et +     (lg: et xl:)
```

| Usage type de vue | Breakpoint cible |
|---|---|
| Espace abonné (tenant) | Mobile-first, doit être 100% fonctionnel dès 360px de large |
| Console de Pilotage super-admin | Optimisée desktop (1024px+), dégradée proprement en tablette (768px+), non prioritaire en mobile |
| Formulaires (inscription, saisie de données terrain) | Mobile-first impératif — usage principal en terrain par agents/utilisateurs |

**3. Zones tactiles (touch targets)**
- Tous les éléments interactifs (boutons, liens, cases à cocher) doivent avoir une zone
  cliquable minimale de **44x44px** (recommandation WCAG/Apple/Material)
- Espacement minimum de 8px entre deux éléments tactiles adjacents pour éviter les clics
  accidentels

**4. Layout adaptatif par composant**

- **Tableaux de données** (listes d'abonnés, factures, inventaire) :
  - Desktop/tablette large : tableau classique avec colonnes
  - Mobile : basculer en liste de cartes empilées (chaque ligne devient une carte avec
    libellé + valeur), jamais de scroll horizontal forcé
- **Formulaires multi-colonnes** :
  - Desktop : 2-3 colonnes selon densité de champs
  - Mobile : 1 seule colonne, champs empilés verticalement
- **Navigation** :
  - Desktop : sidebar fixe ou navbar horizontale complète
  - Mobile : menu hamburger avec drawer, ou bottom navigation bar pour les 4-5 actions
    principales (pattern recommandé pour usage terrain à une main)
- **Dashboards / graphiques** :
  - Desktop : grille multi-colonnes de widgets
  - Mobile : widgets empilés en une colonne, graphiques redimensionnés avec légendes
    repositionnées sous le graphique plutôt qu'à côté
- **Modales** :
  - Desktop : modale centrée avec largeur fixe
  - Mobile : plein écran (bottom sheet ou full-screen), jamais de modale étroite avec scroll
    interne sur petit écran

**5. Typographie et lisibilité**
- Taille de base minimum : 16px sur mobile (évite le zoom automatique iOS sur les inputs)
- Line-height généreux (1.5 minimum) pour lisibilité en extérieur/forte luminosité
- Contraste renforcé (WCAG AA minimum) — utile en usage extérieur sous soleil direct

**6. Images et médias**
- Toutes les images en `srcset`/responsive avec formats compressés (WebP), critique pour
  les connexions 3G/EDGE hors Dakar
- Lazy loading systématique des images hors viewport initial

**7. Orientation**
- Supporter portrait et paysage sur tablette (utile pour les écoles/cliniques utilisant des
  tablettes fixées sur support)
- Pas de blocage d'orientation sauf cas justifié (ex. saisie de tableau complexe en paysage
  uniquement, à documenter si utilisé)

---

### Exemple de composant : liste d'abonnés (pattern à suivre partout)

```jsx
// Desktop/tablette : table classique — Mobile : cartes empilées
function SubscriberList({ subscribers }) {
  return (
    <>
      {/* Vue desktop/tablette */}
      <table className="hidden md:table w-full">
        <thead>
          <tr>
            <th className="text-left p-3">Nom</th>
            <th className="text-left p-3">Tenant</th>
            <th className="text-left p-3">Statut</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscribers.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-3">{s.name}</td>
              <td className="p-3">{s.tenant}</td>
              <td className="p-3">{s.status}</td>
              <td className="p-3">
                <button className="min-h-11 min-w-11 px-3">Voir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Vue mobile : cartes */}
      <div className="md:hidden space-y-3">
        {subscribers.map((s) => (
          <div key={s.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-gray-500">{s.status}</span>
            </div>
            <div className="text-sm text-gray-600 mb-3">{s.tenant}</div>
            <button className="w-full min-h-11 border rounded-md">Voir</button>
          </div>
        ))}
      </div>
    </>
  );
}
```

---

### Checklist de validation à intégrer aux tests QA (Antigravity agentic testing)

- [ ] Tester à 360px, 375px, 768px, 1024px, 1440px minimum
- [ ] Aucun scroll horizontal involontaire à aucune largeur testée
- [ ] Tous les éléments tactiles ≥ 44x44px sur mobile
- [ ] Formulaires utilisables au clavier virtuel (input non masqué par le clavier à l'ouverture)
- [ ] Tableaux basculent bien en cartes sous 768px
- [ ] Modales passent en plein écran sous 640px
- [ ] Test en orientation paysage sur tablette pour les écrans de saisie
- [ ] Test avec throttling réseau 3G lent (simulateur Chrome DevTools) pour valider le lazy
      loading des images

---

### Contrainte transversale

Cette règle mobile-first s'applique à **tous les modules déjà définis dans le master prompt**
(récupération de compte, inscription, gestion des abonnés côté super-admin, etc.) — chaque
écran généré par l'agent doit être vérifié contre cette checklist avant d'être considéré comme
terminé.
