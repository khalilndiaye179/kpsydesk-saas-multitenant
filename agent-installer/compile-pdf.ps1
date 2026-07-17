$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$htmlPath = "Guide_Utilisateur_KPSyDesk_Complet_v3.html"
$pdfPath = "Guide_Utilisateur_KPSyDesk_Complet_v3.pdf"

if (-not (Test-Path $chromePath)) {
    Write-Error "Google Chrome est introuvable au chemin spécifié : $chromePath"
    exit 1
}

if (-not (Test-Path $htmlPath)) {
    Write-Error "Le fichier HTML source est introuvable : $htmlPath"
    exit 1
}

Write-Output "Début de la compilation PDF avec Google Chrome headless..."
Write-Output "Fichier source : $htmlPath"
Write-Output "Fichier cible  : $pdfPath"

$arguments = @(
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--print-to-pdf=$pdfPath",
    $htmlPath
)

$process = Start-Process -FilePath $chromePath -ArgumentList $arguments -PassThru -Wait -NoNewWindow

if ($process.ExitCode -eq 0) {
    Write-Output "Le fichier PDF a été généré avec succès !"
    if (Test-Path $pdfPath) {
        $fileSize = (Get-Item $pdfPath).Length
        Write-Output "Taille du PDF : $($fileSize) octets"
    }
} else {
    Write-Error "La compilation PDF a échoué avec le code de sortie : $($process.ExitCode)"
}
