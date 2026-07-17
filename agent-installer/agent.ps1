# KPsyITAgent - Script d'inventaire automatique
# Ce script collecte les informations de la machine et les envoie au serveur ITAM.

$ErrorActionPreference = "Stop"

# Déterminer le dossier d'exécution et charger la configuration
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$configPath = Join-Path $scriptPath "config.json"

function Log-Message {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Output $logLine
    try {
        $logPath = Join-Path $scriptPath "agent.log"
        $logLine | Out-File -FilePath $logPath -Append -Encoding utf8
    } catch {}
}

# Recherche de l'URL du serveur et du TenantId dans le registre (Wow6432Node compris)
$serverUrl = "http://localhost:3010"
$tenantId = "legacy"
$regPaths = @("HKLM:\Software\KPsyITAgent", "HKLM:\Software\Wow6432Node\KPsyITAgent")
$foundReg = $false

foreach ($path in $regPaths) {
    if (Test-Path $path) {
        try {
            $reg = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
            if ($reg.ServerUrl) {
                $serverUrl = $reg.ServerUrl
                $foundReg = $true
                Log-Message "Serveur configure via Registre ($path) : $serverUrl"
            }
            if ($reg.TenantId) {
                $tenantId = $reg.TenantId
                Log-Message "Tenant configure via Registre ($path) : $tenantId"
            }
            if ($foundReg) {
                break
            }
        } catch {
            Log-Message "Impossible de lire la cle de registre $path" "WARN"
        }
    }
}

if (-not $foundReg -and (Test-Path $configPath)) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        if ($config.ServerUrl) {
            $serverUrl = $config.ServerUrl
            Log-Message "Serveur configure via config.json : $serverUrl"
        }
        if ($config.TenantId) {
            $tenantId = $config.TenantId
            Log-Message "Tenant configure via config.json : $tenantId"
        }
    } catch {
        Log-Message "Impossible de lire config.json, utilisation des valeurs par defaut" "WARN"
    }
}

# Nettoyer et normaliser l'URL pour ne garder que le protocole, l'hôte et le port
try {
    $uri = New-Object System.Uri($serverUrl)
    $portPart = ""
    # Ne rajouter le port que s'il est spécifié et n'est pas le port par défaut HTTP/HTTPS
    if ($uri.Port -and $uri.Port -ne 80 -and $uri.Port -ne 443 -and $serverUrl -like "*:$($uri.Port)*") {
        $portPart = ":$($uri.Port)"
    }
    $serverUrl = "$($uri.Scheme)://$($uri.Host)$portPart"
} catch {
    $serverUrl = $serverUrl.TrimEnd('/')
}

# Détecter et corriger le port du frontend (3011) vers le port du backend (3010)
if ($serverUrl -like "*:3011*") {
    Log-Message "Le port 3011 est dedie au Frontend. L'agent va utiliser le port 3010 du Backend pour l'enrolement." "WARN"
    $serverUrl = $serverUrl -replace ":3011", ":3010"
}

Log-Message "Début de la collecte des caractéristiques..."

# 1. Nom d'hôte
$hostname = $env:COMPUTERNAME

# 2. Numéro de Série
$serialNumber = "Inconnu"
try {
    $bios = Get-CimInstance Win32_Bios
    if ($bios.SerialNumber -and $bios.SerialNumber -ne "To be filled by O.E.M." -and $bios.SerialNumber.Trim() -ne "") {
        $serialNumber = $bios.SerialNumber.Trim()
    } else {
        $sysProduct = Get-CimInstance Win32_ComputerSystemProduct
        if ($sysProduct.IdentifyingNumber -and $sysProduct.IdentifyingNumber -ne "To be filled by O.E.M." -and $sysProduct.IdentifyingNumber.Trim() -ne "") {
            $serialNumber = $sysProduct.IdentifyingNumber.Trim()
        }
    }
} catch {
    Write-Warning "Impossible de récupérer le numéro de série du BIOS, fallback..."
}

# 3. Fabricant et Modèle
$manufacturer = "Inconnu"
$model = "Inconnu"
try {
    $compSystem = Get-CimInstance Win32_ComputerSystem
    $manufacturer = $compSystem.Manufacturer
    $model = $compSystem.Model
} catch {
    Write-Warning "Impossible de récupérer le fabricant et modèle."
}

# 4. Système d'Exploitation (OS)
$osName = "Windows"
$osVersion = ""
try {
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $osName = $osInfo.Caption
    $osVersion = $osInfo.Version
} catch {
    Write-Warning "Impossible de récupérer le système d'exploitation."
}
$osFull = "$osName ($osVersion)"

# 5. Processeur (CPU)
$cpu = "Inconnu"
try {
    $cpuInfo = Get-CimInstance Win32_Processor
    if ($cpuInfo -is [array]) {
        $cpu = $cpuInfo[0].Name
    } else {
        $cpu = $cpuInfo.Name
    }
} catch {
    Write-Warning "Impossible de récupérer le processeur."
}

# 6. Mémoire (RAM)
$ram = "Inconnu"
try {
    $ramSum = (Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum
    if ($ramSum -and $ramSum -gt 0) {
        $ram = "$([math]::round($ramSum / 1GB)) GB"
    } else {
        $compSystem = Get-CimInstance Win32_ComputerSystem
        $ram = "$([math]::round($compSystem.TotalPhysicalMemory / 1GB)) GB"
    }
} catch {
    Write-Warning "Impossible de récupérer la RAM."
}

# 7. Disques durs (Stockage)
$storage = "Inconnu"
try {
    $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
        $sizeGB = [math]::round($_.Size / 1GB)
        $freeGB = [math]::round($_.FreeSpace / 1GB)
        "$($_.DeviceID) ($freeGB GB libres / $sizeGB GB total)"
    }
    if ($disks) {
        $storage = $disks -join ", "
    }
} catch {
    Write-Warning "Impossible de récupérer les disques."
}

# 8. Réseau (IP et MAC)
$ipAddress = "127.0.0.1"
$macAddress = "00:00:00:00:00:00"
try {
    $netConfig = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" | Select-Object -First 1
    if ($netConfig) {
        if ($netConfig.IPAddress -is [array]) {
            $ipAddress = $netConfig.IPAddress[0]
        } else {
            $ipAddress = $netConfig.IPAddress
        }
        $macAddress = $netConfig.MACAddress
    }
} catch {
    Write-Warning "Impossible de récupérer la configuration réseau."
}

# Préparer le JSON
$payload = @{
    serialNumber = $serialNumber
    name         = $hostname
    os           = $osFull
    cpu          = $cpu
    ram          = $ram
    storage      = $storage
    ipAddress    = $ipAddress
    macAddress   = $macAddress
    model        = $model
    manufacturer = $manufacturer
}

$jsonPayload = $payload | ConvertTo-Json -Depth 5

Log-Message "Caractéristiques de la machine :"
Log-Message "Hôte : $hostname"
Log-Message "N° Série : $serialNumber"
Log-Message "Fabricant : $manufacturer"
Log-Message "Modèle : $model"
Log-Message "OS : $osFull"
Log-Message "CPU : $cpu"
Log-Message "RAM : $ram"
Log-Message "Stockage : $storage"
Log-Message "IP : $ipAddress"
Log-Message "MAC : $macAddress"

Log-Message "Envoi des données vers le serveur : $serverUrl/api/assets/enroll (Tenant: $tenantId)"

# Préparer le Header multi-tenant
$headers = @{
    "X-Tenant-ID" = $tenantId
}

try {
    $response = Invoke-RestMethod -Headers $headers -Uri "$serverUrl/api/assets/enroll" -Method Post -Body $jsonPayload -ContentType "application/json" -TimeoutSec 15
    Log-Message "Enrôlement réussi : $($response | ConvertTo-Json -Compress)"
} catch {
    Log-Message "Erreur d'envoi au serveur : $_" "ERROR"
    exit 1
}
