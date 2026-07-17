# Prompt à insérer dans le Master Prompt Antigravity
## Application : Inventaire Parc Informatique (Multi-Entreprise)
## Fonctionnalité : Adaptation responsive (smartphones & tablettes)

---

### Contexte pour l'agent IA

L'application d'Inventaire Parc Informatique Multi-Entreprise est utilisée par des techniciens
IT et gestionnaires de parc qui font l'essentiel de leur travail **sur le terrain** : scan
d'étiquettes d'actifs, saisie d'interventions/réparations en atelier, inventaire physique en
salle serveur ou en bureau client. L'usage tablette est particulièrement fréquent (inventaire
en déplacement, checklist de maintenance), en plus du smartphone. La Console de Pilotage
super-admin (gestion des entreprises clientes de la plateforme) reste desktop-first.

---

### Règles générales à appliquer sur tout le projet

**1. Approche mobile-first stricte**
- Styles de base pour mobile, surcharge progressive via `min-width`
- Tailwind : partir du non-préfixé (mobile) puis `sm:`, `md:`, `lg:`, `xl:`

**2. Breakpoints standards du projet**

```
Mobile      : 0 – 639px       (technicien terrain, scan d'actifs)
Tablette    : 640px – 1023px  (inventaire physique, checklist maintenance)
Desktop     : 1024px et +     (gestion de parc, reporting, Console de Pilotage)
```

| Écran / module | Breakpoint prioritaire |
|---|---|
| Scan d'actif (QR code / code-barres) | Mobile impératif, doit fonctionner à 360px |
| Fiche actif (détail matériel, licence, historique) | Mobile-first, lisible en une colonne |
| Inventaire physique (mode checklist) | Tablette prioritaire, usage à deux mains en salle serveur |
| Tickets d'intervention / réparation | Mobile-first (technicien en atelier ou chez le client) |
| Tableau de bord parc (KPIs, alertes dépréciation) | Desktop-first, dégradé proprement en tablette |
| Console de Pilotage (gestion multi-entreprise) | Desktop-first (1024px+), tablette acceptable (768px+), mobile non prioritaire |

**3. Zones tactiles**
- 44x44px minimum pour tout élément interactif — critique pour le scan d'actif en conditions
  terrain (gants, écran mouillé, luminosité forte en atelier)
- Boutons d'action principaux (Scanner, Valider intervention, Ajouter actif) en zone facilement
  accessible au pouce sur mobile (bas d'écran plutôt qu'en haut)

**4. Layout adaptatif par composant métier**

- **Liste des actifs (parc informatique)** :
  - Desktop/tablette large : tableau (référence, type, statut, entreprise, date d'acquisition,
    valeur nette comptable)
  - Mobile : cartes empilées — chaque carte affiche référence + type + statut en premier coup
    d'œil, badge coloré pour le statut (En service / En panne / Réformé / En stock)
- **Fiche actif détaillée** :
  - Desktop : deux colonnes (infos générales à gauche, historique interventions/dépréciation
    à droite)
  - Mobile : une colonne, avec système d'onglets ou accordéon pour Infos / Historique /
    Documents (facture, garantie) plutôt que tout afficher en scroll long
- **Scanner de code-barres/QR** :
  - Mobile/tablette : plein écran avec overlay de visée, retour haptique/sonore à la lecture
  - Bouton de saisie manuelle toujours visible en fallback (cas d'étiquette illisible)
- **Formulaire d'ajout/modification d'actif** :
  - Desktop : 2 colonnes
  - Mobile : 1 colonne, champs groupés par section avec titres clairs (Identification,
    Affectation, Financier/SYSCOHADA, Garantie)
- **Ticket d'intervention** :
  - Mobile : formulaire vertical avec upload photo (état du matériel) directement via
    l'appareil photo, signature tactile pour clôture d'intervention
- **Tableau de bord (KPIs parc)** :
  - Desktop : grille de widgets (valeur totale du parc, actifs à réformer, alertes garantie
    expirée, répartition par entreprise)
  - Mobile : widgets empilés, un seul indicateur clé mis en avant en haut (ex. "3 alertes
    urgentes"), le reste accessible en scroll
- **Sélecteur d'entreprise (multi-entreprise)** :
  - Desktop : dropdown dans la barre supérieure
  - Mobile : sélecteur en plein écran ou bottom sheet, car souvent première action du technicien
    en début de session

**5. Typographie et lisibilité**
- 16px minimum sur mobile (évite le zoom auto iOS)
- Contraste renforcé : usage fréquent en extérieur (livraison, intervention chez le client) ou
  sous éclairage industriel de salle serveur
- Codes couleur de statut (En service/En panne/Réformé) suffisamment contrastés et doublés
  d'une icône ou d'un libellé texte, jamais couleur seule (accessibilité + daltonisme)

**6. Mode hors-ligne et responsive**
- L'inventaire physique doit rester utilisable hors connexion (cohérent avec l'architecture
  offline-first) : les listes d'actifs scannés localement s'affichent immédiatement en cartes
  mobiles avec badge "Non synchronisé" tant que la connexion n'est pas rétablie
- Prévoir un indicateur visuel clair et responsive (bandeau) de l'état de synchronisation,
  visible sur toutes les tailles d'écran sans gêner la zone de contenu principal

**7. Orientation**
- Tablette : supporter portrait (checklist, formulaires) et paysage (comparatif de plusieurs
  actifs côte à côte, tableaux larges de reporting)

---

### Exemple de composant : liste des actifs (pattern à suivre)

```jsx
function AssetList({ assets }) {
  const statusColor = {
    "En service": "bg-green-100 text-green-800",
    "En panne": "bg-red-100 text-red-800",
    "Réformé": "bg-gray-100 text-gray-600",
    "En stock": "bg-blue-100 text-blue-800",
  };

  return (
    <>
      {/* Desktop/tablette large */}
      <table className="hidden md:table w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-3">Référence</th>
            <th className="text-left p-3">Type</th>
            <th className="text-left p-3">Entreprise</th>
            <th className="text-left p-3">Statut</th>
            <th className="text-left p-3">VNC</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="p-3 font-mono">{a.reference}</td>
              <td className="p-3">{a.type}</td>
              <td className="p-3">{a.entreprise}</td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded text-xs ${statusColor[a.statut]}`}>
                  {a.statut}
                </span>
              </td>
              <td className="p-3">{a.valeurNetteComptable} FCFA</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile : cartes */}
      <div className="md:hidden space-y-3">
        {assets.map((a) => (
          <div key={a.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-1">
              <span className="font-mono font-medium">{a.reference}</span>
              <span className={`px-2 py-1 rounded text-xs ${statusColor[a.statut]}`}>
                {a.statut}
              </span>
            </div>
            <div className="text-sm text-gray-600">{a.type} — {a.entreprise}</div>
            <div className="text-sm text-gray-500 mt-1">
              VNC : {a.valeurNetteComptable} FCFA
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

---

### Checklist de validation (tests QA Antigravity)

- [ ] Tester à 360px, 375px, 768px, 1024px, 1440px
- [ ] Scanner QR/code-barres fonctionnel et lisible en plein écran mobile
- [ ] Aucun scroll horizontal involontaire à aucune largeur
- [ ] Zones tactiles ≥ 44x44px, particulièrement sur le module de scan et les tickets
      d'intervention
- [ ] Liste des actifs bascule en cartes sous 768px
- [ ] Fiche actif utilise onglets/accordéon sous 768px plutôt qu'un long scroll
- [ ] Formulaire d'ajout d'actif utilisable au clavier virtuel sans champ masqué
- [ ] Sélecteur d'entreprise accessible et clair en mobile (bottom sheet/plein écran)
- [ ] Bandeau de synchronisation offline visible et non intrusif sur toutes tailles
- [ ] Test en orientation paysage sur tablette pour les vues de reporting/comparatif
- [ ] Test avec throttling réseau 3G lent pour valider le comportement offline-first

---

### Contrainte transversale

Cette règle mobile-first s'applique à tous les écrans de l'application Inventaire Parc
Informatique Multi-Entreprise déjà couverts par le master prompt (récupération de compte,
inscription avec double vérification, réinitialisation par le Super-Admin) — chaque écran
généré par l'agent doit être vérifié contre cette checklist avant d'être considéré comme
terminé.
