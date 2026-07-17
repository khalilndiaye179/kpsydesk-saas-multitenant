$targetDir = "d:\Formation creation site web pro avec l'IA\@.Inventaire Parc Informatique"
$backupDir = Join-Path $targetDir "legacy_electron_backup"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force
}

$excludes = @(
    "legacy_electron_backup",
    "@.Inventaire Parc Informatique (BackUP) 1.0.iso",
    "@.Inventaire Parc Informatique (BackUP) 1.1.iso",
    "@.Inventaire Parc Informatique (BackUP).jpg",
    "Docs_Preuves",
    "Guide_Utilisateur_KPSyDesk.html",
    "Guide_Utilisateur_KPSyDesk.pdf",
    "Guide_Utilisateur_KPSyDesk_Complet.md",
    "Guide_Utilisateur_KPSyDesk_Complet.pdf",
    "Inventaire Etat du Parc Informatique 2023.xlsx",
    "KPsy2026!.txt",
    "Khalil’PSy. Informatiques_PNG_4_Miniature.png",
    "database_schema.sql",
    "icon.ico",
    "licences_2ans_kpsydesk_v3.txt",
    "licences_kpsydesk_v3.txt"
)

Get-ChildItem -Path $targetDir | ForEach-Object {
    if ($excludes -notcontains $_.Name) {
        Write-Host "Moving: $($_.Name)"
        Move-Item -Path $_.FullName -Destination $backupDir -Force
    }
}
