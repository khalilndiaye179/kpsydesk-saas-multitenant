#!/bin/sh
# ============================================================
# backup-postgres.sh — Script de sauvegarde PostgreSQL KPSyDesk
# ============================================================

set -e

BACKUP_DIR="/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/itam_backup_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Journalisation de départ
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Démarrage de la sauvegarde de la base de données : ${DB_NAME}..." | tee -a "${LOG_FILE}"

# Vérifier si les variables sont définies
if [ -z "${DB_USER}" ] || [ -z "${DB_PASSWORD}" ] || [ -z "${DB_NAME}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Erreur : Variables de connexion manquantes (DB_USER, DB_PASSWORD ou DB_NAME)." | tee -a "${LOG_FILE}"
  exit 1
fi

# Exécuter le pg_dump compressé à la volée avec gzip
export PGPASSWORD="${DB_PASSWORD}"
if pg_dump -h "${DB_HOST:-postgres}" -U "${DB_USER}" -d "${DB_NAME}" -F p | gzip > "${FILENAME}"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Sauvegarde réussie : ${FILENAME}" | tee -a "${LOG_FILE}"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Échec de la sauvegarde." | tee -a "${LOG_FILE}"
  exit 1
fi

# Nettoyage des sauvegardes de plus de 30 jours
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧹 Nettoyage des anciennes sauvegardes (plus de ${RETENTION_DAYS} jours)..." | tee -a "${LOG_FILE}"
deleted_count=0
for f in $(find "${BACKUP_DIR}" -name "itam_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS}); do
  rm -f "$f"
  echo "  - Supprimé : $f" | tee -a "${LOG_FILE}"
  deleted_count=$((deleted_count + 1))
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✨ Opération de sauvegarde et nettoyage terminée. Supprimés: ${deleted_count}." | tee -a "${LOG_FILE}"
echo "--------------------------------------------------------" >> "${LOG_FILE}"
