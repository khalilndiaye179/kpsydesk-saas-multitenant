# 📘 Runbook de Reprise d'Incident (PRA) — KPSyDesk ITAM

Ce document sert de guide opérationnel de référence en cas d'incident majeur ou d'interruption de service sur l'application `kpsydesk-saas-multitenant` (ITAM SaaS).

---

## 1. Objectifs de Rétablissement (RPO / RTO)

*   **RPO (Recovery Point Objective) : 24 heures**
    *   La perte maximale de données acceptable en cas de sinistre est de 24 heures, correspondant à la fréquence des sauvegardes automatiques exécutées chaque nuit à **2h00 AM** par le conteneur `itam_backup`.
*   **RTO (Recovery Time Objective) : 2 heures**
    *   Le temps maximal imparti pour restaurer les services et remettre la plateforme en ligne (même sur un nouveau serveur VPS vierge) est fixé à 2 heures.

---

## 2. Localisation des Accès Critiques (Production)

Pour des raisons de sécurité, aucun mot de passe ou clé d'accès n'est inscrit dans ce document.
*   **Identifiants Console Hostinger & Accès SSH/FTP** :
    *   Stockés de manière chiffrée dans le coffre-fort de mots de passe de l'administrateur (ex: Bitwarden ou KeePass de l'administrateur système).
*   **Variables d'Environnement de Production (`.env`)** :
    *   Le fichier `.env` actif se trouve sur le VPS dans `/root/app/.env`.
    *   Une copie de sauvegarde chiffrée des variables de production doit être conservée hors du serveur dans le gestionnaire de secrets de l'administrateur.

---

## 3. Détection & Diagnostic de Premier Niveau

L'alerte d'incident est généralement déclenchée par :
1.  **L'alerte automatique par e-mail** configurée dans le service de santé (envoi d'un mail d'alerte à `ALERT_EMAIL` après 3 échecs consécutifs du health check `/api/health`).
2.  **Une alerte de monitoring externe** ou des retours d'utilisateurs signalant une page blanche ou une erreur `502 Bad Gateway`.

### Commandes de diagnostic initiales (SSH sur le VPS) :
```bash
# 1. Se placer dans le dossier de l'application
cd /root/app

# 2. Vérifier le statut des conteneurs
docker compose ps

# 3. Consulter les logs récents du backend
docker compose logs backend --tail=100

# 4. Consulter les logs récents de la base de données
docker compose logs postgres --tail=100
```

---

## 4. Scénarios d'Incident & Procédures de Résolution

### Scénario A : Panne du conteneur PostgreSQL (`itam_postgres`)
*   **Signes de détection** : Logs du backend saturés d'erreurs `Can't reach database server at postgres:5432` ou base injoignable via Prisma.
*   **Procédure de résolution** :
    ```bash
    # Redémarrer le conteneur de base de données
    docker compose restart postgres
    
    # Vérifier que PostgreSQL est prêt
    docker compose exec postgres pg_isready -U itam_user -d itam_db
    ```

### Scénario B : Corruption ou suppression accidentelle de données
*   **Signes de détection** : Données manquantes, incohérences graves signalées par un locataire (tenant), ou corruption suite à un bug de script.
*   **Procédure de restauration depuis une sauvegarde** :
    1.  **Identifier la sauvegarde à restaurer** :
        ```bash
        docker compose exec backup ls -lh /backups
        ```
    2.  **Faire une sauvegarde de précaution immédiate** (pour éviter d'aggraver la situation) :
        ```bash
        docker compose exec -T postgres pg_dump -U itam_user -d itam_db | gzip > /var/lib/docker/volumes/app_postgres_backups/_data/precaution_backup_$(date +%Y%m%d_%H%M%S).sql.gz
        ```
    3.  **Restaurer le fichier choisi** (remplacer `itam_backup_XXXX.sql.gz` par le nom réel) :
        ```bash
        docker compose exec -T backup sh -c "gunzip -c /backups/itam_backup_XXXX.sql.gz" | docker compose exec -T postgres psql -U itam_user -d itam_db
        ```
    4.  **Redémarrer le backend** pour vider d'éventuels caches en mémoire :
        ```bash
        docker compose restart backend
        ```

### Scénario C : Perte totale du serveur VPS (Sinistre hébergeur)
*   **Signes de détection** : VPS inaccessible en SSH, ping KO, console Hostinger indiquant le serveur détruit ou inaccessible.
*   **Procédure de reconstruction complète** :
    1.  **Réinstallez un OS propre** (Debian 12 ou Ubuntu 22.04 LTS) depuis la console Hostinger.
    2.  **Installez Docker & Docker Compose** sur le nouveau serveur.
    3.  **Clonez le dépôt du projet** :
        ```bash
        git clone https://github.com/votre-compte/kpsydesk-saas-multitenant.git /root/app
        cd /root/app
        ```
    4.  **Restaurez le fichier `.env`** de production depuis votre coffre-fort de secrets sécurisé vers `/root/app/.env`.
    5.  **Démarrez la stack Docker** :
        ```bash
        docker compose up -d --build
        ```
    6.  **Récupérez et restaurez la dernière sauvegarde de base de données** (transférez le fichier `.sql.gz` de sauvegarde externe vers le volume `/var/lib/docker/volumes/app_postgres_backups/_data/` et appliquez la procédure de restauration du **Scénario B**).

### Scénario D : Échec d'un déploiement applicatif
*   **Signes de détection** : Le script `deploy.sh` échoue, ou le backend crash au démarrage suite à un commit défectueux.
*   **Procédure de retour arrière (Rollback)** :
    ```bash
    # Annuler le dernier commit déployé
    git reset --hard HEAD~1
    
    # Relancer le script de déploiement sur la version stable précédente
    bash deploy.sh
    ```

---

## 5. Procédures de Rotation d'Urgence des Secrets

En cas de suspicion de fuite de données ou de compromission de secrets, exécutez ces étapes immédiatement.

### A. Rotation de `JWT_SECRET`
*   **Impact** : Déconnecte immédiatement tous les utilisateurs et locataires actifs de la plateforme. Ils devront ressaisir leurs identifiants.
*   **Procédure** :
    1.  Générez une nouvelle clé de sécurité (ex: clé aléatoire de 64 caractères).
    2.  Éditez le fichier `/root/app/.env` et remplacez `JWT_SECRET` by la nouvelle valeur.
    3.  Appliquez la modification :
        ```bash
        docker compose up -d
        ```

### B. Rotation de `MFA_ENCRYPTION_KEY` (Chiffrement TOTP)
*   **Impact** : Rend invalides toutes les configurations MFA configurées précédemment par les utilisateurs. **Nécessite de forcer la réinscription MFA générale**.
*   **Procédure** :
    1.  Générez une nouvelle clé hexadécimale de 64 caractères.
    2.  Éditez le fichier `/root/app/.env` et mettez à jour la valeur de `MFA_ENCRYPTION_KEY`.
    3.  Exécutez le script de migration pour vider les secrets obsolètes en base et forcer la réinscription (Option A choisie) :
        ```bash
        docker compose exec backend npx ts-node prisma/migrate-mfa.ts
        ```
    4.  Redémarrez le backend :
        ```bash
        docker compose restart backend
        ```

### C. Rotation des accès Database (`POSTGRES_PASSWORD`)
1.  Modifiez le mot de passe dans le fichier `/root/app/.env` (variable `DATABASE_URL` et `POSTGRES_PASSWORD`).
2.  Mettez à jour le mot de passe dans le conteneur de base de données ou recréez la stack :
    ```bash
    docker compose down
    docker compose up -d
    ```

---

## 6. Contacts et Responsabilités

*   **Responsable de l'Incident (Décideur PRA)** : Khalil NDIAYE (Administrateur Système / Support Technique).
    *   *Rôle* : Valide le diagnostic, lance les procédures de restauration, et déclare le retour à la normale.
*   **Ordre de Communication** :
    1.  **Équipe Support Interne** : Informer immédiatement les équipes support de la panne pour qu'elles puissent répondre aux clients.
    2.  **Clients / Abonnés Impactés** : Envoyer un e-mail ou une notification si l'interruption dépasse 15 minutes (RTO cible respecté).
