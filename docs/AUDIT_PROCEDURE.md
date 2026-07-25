# 🔒 Procédure d'Audit de Sécurité des Dépendances (NPM Audit)

Ce document décrit comment gérer les audits de sécurité des dépendances tiers (backend et frontend) de KPSyDesk.

---

## ⚙️ Détection et Fréquence

L'audit des dépendances s'exécute de deux manières :
1.  **Automatique (GitHub Actions)** : Un workflow planifié (`.github/workflows/audit.yml`) s'exécute chaque **dimanche à minuit**. Il alerte les administrateurs en cas de vulnérabilité de niveau **haute (high)** ou **critique (critical)**.
2.  **Manuelle (Terminal)** : Tout développeur peut exécuter la vérification manuellement à tout moment.

---

## 🛠️ Lancer l'Audit Manuellement

### Pour le Backend NestJS
Allez dans le dossier `backend` et lancez :
```bash
npm run audit:check
```

### Pour le Frontend React
Allez dans le dossier `frontend` et lancez :
```bash
npm run audit:check
```

*Note : Ces commandes vérifient uniquement les failles de sévérité haute et critique (`--audit-level=high`). Elles renvoient un code de sortie non nul (ce qui fait échouer la commande ou la CI) si des failles sont détectées.*

---

## 🚨 Procédure en cas de Détection de Faille

Si l'audit local ou la CI signale des vulnérabilités, suivez rigoureusement les étapes ci-dessous :

### ❌ RÈGLE D'OR : Ne JAMAIS exécuter `npm audit fix --force`
> [!WARNING]
> La commande `npm audit fix --force` va installer des versions majeures plus récentes qui brisent la compatibilité du code (breaking changes) sans aucune supervision. Cela peut casser le backend ou le frontend en production. **Cette commande est interdite.**

### 1. Analyser le rapport d'audit
Consultez le tableau généré par `npm audit`. Il liste :
*   Le nom du paquet vulnérable.
*   La sévérité de la faille.
*   Le chemin de dépendance (direct ou indirect).
*   La version minimale correcte disponible.

### 2. Tenter une résolution automatique sans risques
Exécutez la commande d'audit suivante :
```bash
npm audit fix
```
*   *Que fait-elle ?* Elle applique uniquement les mises à jour mineures et correctives compatibles (semver-compatible) sans aucun risque de casser le code.
*   *Vérification* : Relancez `npm run audit:check` pour voir si la faille a été résolue.

### 3. Résoudre manuellement une faille persistante
Si `npm audit fix` n'a pas pu corriger la faille (car la correction nécessite une mise à jour majeure d'un paquet direct ou indirect) :
1.  **Identifier** le paquet parent direct à mettre à jour.
2.  Consulter le **Changelog** ou les **Release Notes** de ce paquet sur GitHub/npm pour voir les breaking changes introduits.
3.  Mettre à jour le paquet manuellement en local :
    ```bash
    npm install le-paquet@nouvelle-version
    ```
4.  **Tester minutieusement** l'application en local (lancement des serveurs de dev, tests unitaires, etc.) pour vérifier qu'aucune régression n'est survenue avant de soumettre la modification.
