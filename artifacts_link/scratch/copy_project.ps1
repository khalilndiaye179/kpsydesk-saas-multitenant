$srcDir = "d:\Formation creation site web pro avec l'IA\@.Inventaire Parc Informatique_1"
$destDir = "d:\Formation creation site web pro avec l'IA\@.Inventaire Parc Informatique"

Write-Host "Copying backend..."
Copy-Item -Path (Join-Path $srcDir "backend") -Destination (Join-Path $destDir "backend") -Recurse -Force

Write-Host "Copying frontend..."
Copy-Item -Path (Join-Path $srcDir "frontend") -Destination (Join-Path $destDir "frontend") -Recurse -Force

Write-Host "Copy completed successfully!"
