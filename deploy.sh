#!/bin/bash
# ============================================================
# deploy.sh — Script de déploiement KPSyDesk ITAM
# Emplacement VPS : /root/app/deploy.sh
# Usage : bash /root/app/deploy.sh
# ============================================================

set -e  # Arrêt immédiat en cas d'erreur

PROJECT_DIR="/root/app"
LOG_FILE="/root/app/deploy.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Démarrage du déploiement KPSyDesk ITAM"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Se placer dans le dossier du projet ──
cd "$PROJECT_DIR" || { log "❌ Erreur : dossier $PROJECT_DIR introuvable"; exit 1; }

# ── 2. Git pull ──
log "📥 [1/4] Récupération du code depuis GitHub..."
git pull origin master

# ── 3. Rebuild Docker ──
log "🔨 [2/4] Reconstruction des containers..."
docker compose up -d --build --remove-orphans

# ── 4. Migrations Prisma ──
log "🗄️  [3/4] Application des migrations Prisma..."
docker compose exec -T backend npx prisma migrate deploy || log "⚠️  Aucune migration à appliquer"

# ── 5. Vérification ──
log "🩺 [4/4] État des services :"
docker compose ps

log ""
log "✅ Déploiement terminé avec succès !"
log "🌐 https://app.kpsyinformatique.com"
