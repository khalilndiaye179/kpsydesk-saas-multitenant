# 🗄️ Sauvegardes et Restaurations PostgreSQL - KPSyDesk ITAM

Ce dossier contient les outils d'automatisation des sauvegardes de la base de données PostgreSQL de l'application.

---

## ⚙️ Mécanisme de Sauvegarde

Les sauvegardes sont exécutées automatiquement chaque nuit à **2h00 AM** par le conteneur Docker `itam_backup` (qui fait tourner le démon `crond` de l'image `postgres:16-alpine`).
Le script de sauvegarde `backup-postgres.sh` effectue un dump SQL complet de la base de données (`itam_db`), le compresse au format `.sql.gz` et applique une politique de rétention en supprimant les fichiers ayant plus de **30 jours**.

Les sauvegardes sont stockées de façon persistante dans le volume nommé Docker `postgres_backups`.

---

## 📥 Restaurer une Sauvegarde

Pour restaurer une sauvegarde sur votre serveur de production :

### 1. Identifier le fichier de sauvegarde à restaurer
Listez les sauvegardes disponibles dans le dossier `/backups` du conteneur :
```bash
docker compose exec backup ls -lh /backups
```

### 2. Procédure de Restauration
Exécutez cette commande pour restaurer le fichier choisi (remplacez `itam_backup_XXXX.sql.gz` par le nom réel de votre fichier) :

```bash
# Copier et restaurer la base de données en une seule commande sécurisée
docker compose exec -T backup sh -c "gunzip -c /backups/itam_backup_XXXX.sql.gz" | docker compose exec -T postgres psql -U itam_user -d itam_db
```

> [!WARNING]
> La restauration écrasera et mettra à jour les données existantes de la base de données de production. Assurez-vous de faire un dump de sécurité manuel avant toute opération de restauration.

---

## 📢 Notes de Sécurité et Recommandations
* Les sauvegardes sont situées sur le volume persistant Docker de la machine locale. En cas de crash physique du serveur ou d'incendie, ces sauvegardes seraient perdues.
* **Recommandation essentielle** : Mettre en place un outil de synchronisation déportée (par exemple un script `rsync` via cron, ou l'utilisation de `rclone` vers un stockage S3 ou un second serveur de sauvegarde) pour copier quotidiennement les fichiers du volume `/var/lib/docker/volumes/app_postgres_backups/_data` hors du VPS.
