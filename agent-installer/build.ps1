# Script de compilation de l'agent KPsyITAgent en MSI
# Ce script télécharge WiX Toolset de manière portable et compile l'agent.

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptPath

$wixDir = Join-Path $scriptPath "wix"
$wixZip = Join-Path $scriptPath "wix-binaries.zip"
$candle = Join-Path $wixDir "candle.exe"
$light = Join-Path $wixDir "light.exe"

# 1. Télécharger WiX si manquant
if (-not (Test-Path $candle) -or -not (Test-Path $light)) {
    Write-Output "=== 1. TÉLÉCHARGEMENT DE WIX TOOLSET PORTATIF ==="
    if (-not (Test-Path $wixDir)) {
        New-Item -ItemType Directory -Force -Path $wixDir | Out-Null
    }
    
    $url = "https://github.com/wixtoolset/wix3/releases/download/wix3112rtm/wix311-binaries.zip"
    Write-Output "Téléchargement de : $url"
    Invoke-WebRequest -Uri $url -OutFile $wixZip
    
    Write-Output "Extraction en cours vers : $wixDir"
    Expand-Archive -Path $wixZip -DestinationPath $wixDir -Force
    
    Remove-Item -Path $wixZip -Force
    Write-Output "WiX Toolset installé localement avec succès."
}

# 2. Compilation de l'installateur
Write-Output "=== 2. COMPILATION DE L'AGENT ==="
Write-Output "Exécution de candle.exe..."
& $candle "agent.wxs" -out "agent.wixobj"

Write-Output "Exécution de light.exe..."
& $light "agent.wixobj" -out "agent.msi" -ext WixUIExtension

# 3. Copie vers le dossier d'actifs du backend
Write-Output "=== 3. DEPLOIEMENT DE L'INSTALLATEUR ==="
$backendAssetsDir = Join-Path $scriptPath "..\backend\src\assets"
if (-not (Test-Path $backendAssetsDir)) {
    New-Item -ItemType Directory -Force -Path $backendAssetsDir | Out-Null
}

$destMsi = Join-Path $backendAssetsDir "agent.msi"
Copy-Item -Path "agent.msi" -Destination $destMsi -Force
Write-Output "Succès : agent.msi copié vers $destMsi"

# Nettoyage des fichiers temporaires
Remove-Item -Path "agent.wixobj" -ErrorAction SilentlyContinue
Remove-Item -Path "agent.msi" -ErrorAction SilentlyContinue

Write-Output "=== BUILD REUSSI AVEC SUCCES ==="
