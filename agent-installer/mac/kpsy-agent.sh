#!/bin/bash
# kpsy-agent.sh - Agent d'inventaire KPSyDesk pour macOS

# Chemin de configuration
CONFIG_PATH="/Library/Application Support/KPsyITAgent/config.json"
LOG_PATH="/Library/Application Support/KPsyITAgent/agent.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2" >> "$LOG_PATH"
}

# 1. Lire la configuration
if [ -f "$CONFIG_PATH" ]; then
    SERVER_URL=$(osascript -l JavaScript -e '
        var fm = $.NSFileManager.defaultManager;
        var data = fm.contentsAtPath("'"$CONFIG_PATH"'");
        var str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
        JSON.parse(str).ServerUrl;
    ')
    TENANT_ID=$(osascript -l JavaScript -e '
        var fm = $.NSFileManager.defaultManager;
        var data = fm.contentsAtPath("'"$CONFIG_PATH"'");
        var str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
        JSON.parse(str).TenantId;
    ')
else
    SERVER_URL="https://api.kpsyinformatique.com"
    TENANT_ID="legacy"
    log_message "WARN" "Fichier de configuration absent, valeurs par défaut utilisées."
fi

# Nettoyer l'URL du port frontend s'il a été saisi par erreur
if [[ "$SERVER_URL" == *":3011"* ]]; then
    SERVER_URL="${SERVER_URL//:3011/:3010}"
fi

log_message "INFO" "Début de la collecte macOS..."

# 2. Collecte des caractéristiques
HOSTNAME=$(hostname)
SERIAL_NUMBER=$(system_profiler SPHardwareDataType | awk '/Serial Number/ {print $4}')
MANUFACTURER="Apple"
MODEL=$(sysctl -n hw.model)
OS_NAME=$(sw_vers -productName)
OS_VERSION=$(sw_vers -productVersion)
OS_FULL="$OS_NAME ($OS_VERSION)"
CPU=$(sysctl -n machdep.cpu.brand_string)

# RAM
RAM_BYTES=$(sysctl -n hw.memsize)
RAM="$((RAM_BYTES / 1024 / 1024 / 1024)) GB"

# Stockage principal (Volume racine /)
STORAGE=$(df -h / | awk 'NR==2 {print $6 " (" $4 " libres / " $2 " total)"}')

# Réseau (Interface principale par défaut)
PRIMARY_INT=$(route get default 2>/dev/null | awk '/interface:/ {print $2}')
if [ -n "$PRIMARY_INT" ]; then
    IP_ADDRESS=$(ipconfig getifaddr "$PRIMARY_INT")
    MAC_ADDRESS=$(networksetup -getmacaddress "$PRIMARY_INT" | awk '{print $3}')
else
    IP_ADDRESS="127.0.0.1"
    MAC_ADDRESS="00:00:00:00:00:00"
fi

# 3. Préparation du payload JSON
JSON_PAYLOAD=$(cat <<EOF
{
  "serialNumber": "$SERIAL_NUMBER",
  "name": "$HOSTNAME",
  "os": "$OS_FULL",
  "cpu": "$CPU",
  "ram": "$RAM",
  "storage": "$STORAGE",
  "ipAddress": "$IP_ADDRESS",
  "macAddress": "$MAC_ADDRESS",
  "model": "$MODEL",
  "manufacturer": "$MANUFACTURER"
}
EOF
)

log_message "INFO" "Envoi des données vers $SERVER_URL/api/assets/enroll (Tenant: $TENANT_ID)"

# 4. Envoi HTTP POST
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -d "$JSON_PAYLOAD" \
    --max-time 15 \
    "$SERVER_URL/api/assets/enroll")

if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
    log_message "INFO" "Enrôlement réussi (HTTP $HTTP_STATUS)."
else
    log_message "ERROR" "Erreur d'envoi. Code HTTP : $HTTP_STATUS"
    exit 1
fi
