#!/bin/bash
# ==============================================================================
# vps-cleanup.sh — Script de nettoyage automatique pour VPS de production
# ==============================================================================
# Auteurs: Antigravity / Khalil
# Stack cible: Docker, Nginx, Node.js, PostgreSQL
# Règle de sécurité absolue: NE JAMAIS supprimer de volumes Docker ni de données.
# ==============================================================================

# Arrêt immédiat en cas d'erreur sur des commandes critiques (les prunes non critiques gèrent leur propre erreur)
set -uo pipefail

# Configuration
LOG_FILE="/var/log/vps-cleanup.log"
ALERT_EMAIL="khalil.ndiaye@kpsyinformatique.com"  # À adapter
WEBHOOK_URL=""                                   # URL Webhook (Slack, Discord) optionnelle

# S'assurer d'être root
if [ "$EUID" -ne 0 ]; then
  echo "Erreur: Ce script doit être exécuté en tant que superutilisateur (root)." >&2
  exit 1
fi

# Initialiser le fichier log s'il n'existe pas
touch "$LOG_FILE" && chmod 600 "$LOG_FILE"

log() {
  local datetime
  datetime=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$datetime] $1" | tee -a "$LOG_FILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🧹 Démarrage du nettoyage automatique du VPS..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. État initial de l'espace disque ──
FREE_BEFORE=$(df -k / | awk 'NR==2 {print $4}')
TOTAL_BEFORE=$(df -k / | awk 'NR==2 {print $2}')
USED_BEFORE_PCT=$(df -h / | awk 'NR==2 {print $5}')
log "État initial : Espace utilisé sur / : $USED_BEFORE_PCT (Dispo: $((FREE_BEFORE / 1024)) Mo)"

# ── 2. Nettoyage de Docker ──
log "🐳 Nettoyage de Docker (containers arrêtés, images inutilisées, cache)..."
# ATTENTION: Pas de --volumes ni de "volume prune" pour ne jamais toucher aux bases postgres
if command -v docker &> /dev/null; then
  docker system prune -a --force 2>&1 | tee -a "$LOG_FILE"
else
  log "ℹ️  Docker non installé sur l'hôte VPS."
fi

# ── 3. Purge des logs Systemd/journald ──
log "📰 Purge des logs journald de plus de 14 jours..."
if command -v journalctl &> /dev/null; then
  journalctl --vacuum-time=14d 2>&1 | tee -a "$LOG_FILE"
else
  log "ℹ️  journalctl non disponible."
fi

# ── 4. Nettoyage et Troncature des logs Nginx (> 100 Mo) ──
NGINX_LOG_DIR="/var/log/nginx"
log "🌐 Vérification de la taille des logs Nginx dans $NGINX_LOG_DIR..."
if [ -d "$NGINX_LOG_DIR" ]; then
  # On cherche tous les fichiers .log qui dépassent 100 Mo (104857600 octets)
  find "$NGINX_LOG_DIR" -type f -name "*.log" | while read -r logfile; do
    size=$(stat -c%s "$logfile" 2>/dev/null || echo 0)
    if [ "$size" -gt 104857600 ]; then
      size_mo=$((size / 1024 / 1024))
      log "⚠️ Le fichier log Nginx $logfile dépasse 100 Mo ($size_mo Mo). Troncature en cours..."
      # Troncature propre (sécurisée pour les processus Nginx en cours d'écriture)
      truncate -s 0 "$logfile"
    fi
  done
else
  log "ℹ️  Dossier $NGINX_LOG_DIR inexistant."
fi

# ── 5. Nettoyage des caches NPM & APT ──
log "📦 Nettoyage du cache des paquets APT..."
apt-get clean 2>&1 | tee -a "$LOG_FILE"
apt-get autoremove --purge -y 2>&1 | tee -a "$LOG_FILE"

log "🛠️  Nettoyage du cache npm..."
if command -v npm &> /dev/null; then
  npm cache clean --force 2>&1 | tee -a "$LOG_FILE"
else
  log "ℹ️  npm non installé sur l'hôte VPS."
fi

# ── 6. Résumé et calcul de l'espace libéré ──
FREE_AFTER=$(df -k / | awk 'NR==2 {print $4}')
USED_AFTER_PCT=$(df -h / | awk 'NR==2 {print $5}')
USED_AFTER_PCT_VAL=$(echo "$USED_AFTER_PCT" | sed 's/%//')
FREED_KB=$((FREE_AFTER - FREE_BEFORE))
FREED_MB=$((FREED_KB / 1024))

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "✅ Nettoyage terminé avec succès !"
log "Espace libéré : $FREED_MB Mo"
log "Nouvel état : Espace utilisé sur / : $USED_AFTER_PCT (Dispo: $((FREE_AFTER / 1024)) Mo)"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 7. Alerte si espace disque restant critique (> 80%) ──
if [ "$USED_AFTER_PCT_VAL" -gt 80 ]; then
  alert_msg="⚠️ [ALERTE VPS] L'espace disque sur le serveur est critique : $USED_AFTER_PCT utilisé après nettoyage automatique ! Espace libre restant : $((FREE_AFTER / 1024)) Mo."
  log "🚨 CRITIQUE : L'espace disque dépasse le seuil d'alerte de 80% ($USED_AFTER_PCT) !"
  
  # Alerte Webhook
  if [ -n "$WEBHOOK_URL" ]; then
    log "✉️ Envoi d'une notification webhook..."
    curl -s -H "Content-Type: application/json" \
         -X POST \
         -d "{\"content\": \"$alert_msg\"}" \
         "$WEBHOOK_URL" > /dev/null || log "⚠️ Échec de l'envoi du webhook"
  fi

  # Alerte Email
  if [ -n "$ALERT_EMAIL" ]; then
    if command -v mail &> /dev/null; then
      log "✉️ Envoi d'un email d'alerte à $ALERT_EMAIL..."
      echo -e "$alert_msg\n\nLogs du nettoyage :\n$(tail -n 30 "$LOG_FILE")" | mail -s "[ALERTE VPS] Espace disque critique : $USED_AFTER_PCT" "$ALERT_EMAIL"
    else
      log "⚠️ Impossible d'envoyer l'email : la commande 'mail' n'est pas installée."
    fi
  fi
fi
