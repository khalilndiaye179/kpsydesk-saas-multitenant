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
