## Déploiement automatique vers GitHub pour KPSyDesk
- Pour toute modification future effectuée sur l'application KPSyDesk, l'agent DOIT AUTOMATIQUEMENT commiter et pousser (push) les changements vers le dépôt GitHub distant sans attendre la demande explicite de l'utilisateur.
- Les messages de commit doivent être clairs et utiliser la convention Conventional Commits (ex: feat, fix, chore, etc.).

## Règle de commit systématique
Après toute modification de code, correction, ou mise à jour dans ce projet :
1. Vérifier git status avant tout git add (jamais de git add . aveugle)
2. Vérifier l'absence de secrets/clés/mots de passe dans le diff avant commit
3. Committer avec un message descriptif (type: description)
4. Pousser immédiatement vers origin main
5. Confirmer le hash de commit et les fichiers modifiés à l'utilisateur — jamais annoncer un succès sans vérification réelle (git log -1, git status propre)
6. Un commit = une intervention logique. Ne pas grouper plusieurs corrections indépendantes.

## RÈGLE ABSOLUE ET PERMANENTE — PROTECTION DES DONNÉES ABONNÉS
Quelle que soit la tâche demandée (correction de bug, nouvelle fonctionnalité, mise à jour de dépendance, refactoring, changement de schéma), respecter strictement ces règles. Elles priment sur toute autre instruction.

=== 1. AUCUNE PERTE DE DONNÉES TOLÉRÉE ===
- N'exécute jamais, sous aucun prétexte, une commande ou un script qui supprime, tronque, ou écrase des données existantes en base de production : DROP TABLE, TRUNCATE, DELETE sans WHERE restrictif, prisma migrate reset, ou tout équivalent.
- N'utilise jamais npx prisma db push en production. Utilise exclusivement npx prisma migrate deploy, qui applique des migrations versionnées et réversibles au lieu de forcer le schéma.
- Si une modification de schéma Prisma implique de renommer, supprimer, ou changer le type d'une colonne existante contenant potentiellement des données, génère une migration qui PRÉSERVE les données (ex: renommer via migration explicite plutôt que drop+create), et explique le risque avant de l'appliquer.

=== 2. SCRIPTS DE SEED : JAMAIS DESTRUCTEURS NI RÉPÉTITIFS SUR DES COMPTES RÉELS ===
- Le script prisma/seed.ts ne doit JAMAIS réécrire un mot de passe, un rôle, ou toute donnée d'un compte utilisateur déjà existant en production. La création de comptes système doit se faire uniquement SI le compte n'existe pas encore (create-if-not-exists).
- Le seed initial doit être une action manuelle, exécutée une seule fois consciemment, jamais à chaque redémarrage du conteneur en production.

=== 3. AUCUNE DONNÉE TENANT NE DOIT ÊTRE ACCESSIBLE OU MODIFIABLE HORS DE SON PÉRIMÈTRE ===
- Ne modifie jamais la logique d'isolation multi-tenant sans signaler explicitement le changement et son impact avant de l'appliquer.
- Si une migration ou un correctif touche une table couverte par une policy RLS, vérifie et confirme après coup que la policy est toujours active et affiche le résultat.

=== 4. AVANT TOUTE MODIFICATION TOUCHANT LA BASE DE DONNÉES EN PRODUCTION ===
- Décris précisément ce que la modification va faire aux données existantes AVANT de l'exécuter, et attends la confirmation explicite si l'opération n'est pas strictement additive.
- En cas de doute sur le caractère destructif, considère l'opération comme destructive et demande confirmation plutôt que de l'exécuter silencieusement.

=== 5. TRAÇABILITÉ ===
- Chaque commit touchant le schéma de base de données ou un script de seed/migration doit mentionner explicitement dans son message si l'opération est additive, destructive, ou neutre pour les données existantes.
