# 🚀 Script de préparation Chrome Web Store
# Auteur: Ahmed Boukhriss Filali
# Extension: Auto Click Timer

Write-Host "🎯 Préparation de l'extension pour Chrome Web Store..." -ForegroundColor Green
Write-Host ""

# Configuration
$extensionPath = "d:\extention-75\extention"
$outputPath = "d:\extention-75\chrome-store-package"
$zipName = "auto-click-timer-extension.zip"

# Créer le dossier de sortie
if (-not (Test-Path $outputPath)) {
    New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
    Write-Host "✅ Dossier de package créé: $outputPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Vérification des fichiers requis..." -ForegroundColor Yellow

# Fichiers requis
$requiredFiles = @(
    "manifest.json",
    "popup.html", 
    "popup.js",
    "content.js",
    "background.js"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $extensionPath $file
    if (Test-Path $filePath) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file MANQUANT" -ForegroundColor Red
        $missingFiles += $file
    }
}

# Vérifier les icônes
Write-Host ""
Write-Host "🎨 Vérification des icônes..." -ForegroundColor Yellow

$iconSizes = @("16", "48", "128")
$iconFormats = @("svg", "png")
$hasAllIcons = $true

foreach ($size in $iconSizes) {
    $svgIcon = Join-Path $extensionPath "icon$size.svg"
    $pngIcon = Join-Path $extensionPath "icon$size.png"
    
    if (Test-Path $svgIcon) {
        Write-Host "✅ icon$size.svg trouvé" -ForegroundColor Green
    }
    
    if (Test-Path $pngIcon) {
        Write-Host "✅ icon$size.png trouvé" -ForegroundColor Green
    } else {
        Write-Host "⚠️  icon$size.png manquant (requis pour Chrome Web Store)" -ForegroundColor Yellow
        $hasAllIcons = $false
    }
}

if (-not $hasAllIcons) {
    Write-Host ""
    Write-Host "🔧 Pour convertir vos SVG en PNG:" -ForegroundColor Cyan
    Write-Host "   1. Ouvrez: file://$extensionPath/convert_icons.html" -ForegroundColor White
    Write-Host "   2. Chargez vos fichiers SVG" -ForegroundColor White
    Write-Host "   3. Téléchargez les PNG générés" -ForegroundColor White
    Write-Host "   4. Placez-les dans le dossier de l'extension" -ForegroundColor White
    Write-Host ""
}

# Vérifier le manifest.json
Write-Host ""
Write-Host "📄 Analyse du manifest.json..." -ForegroundColor Yellow

$manifestPath = Join-Path $extensionPath "manifest.json"
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath | ConvertFrom-Json
    
    Write-Host "📋 Informations de l'extension:" -ForegroundColor Cyan
    Write-Host "   Nom: $($manifest.name)" -ForegroundColor White
    Write-Host "   Version: $($manifest.version)" -ForegroundColor White
    Write-Host "   Description: $($manifest.description)" -ForegroundColor White
    Write-Host "   Manifest Version: $($manifest.manifest_version)" -ForegroundColor White
    
    # Vérifications du manifest
    $manifestIssues = @()
    
    if (-not $manifest.name) { $manifestIssues += "Nom manquant" }
    if (-not $manifest.version) { $manifestIssues += "Version manquante" }
    if (-not $manifest.description) { $manifestIssues += "Description manquante" }
    if ($manifest.description.Length -lt 10) { $manifestIssues += "Description trop courte (min 10 caractères)" }
    if ($manifest.description.Length -gt 132) { $manifestIssues += "Description trop longue (max 132 caractères)" }
    
    if ($manifestIssues.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Problèmes détectés dans manifest.json:" -ForegroundColor Yellow
        foreach ($issue in $manifestIssues) {
            Write-Host "   - $issue" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ Manifest.json valide" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "📦 Création du package ZIP..." -ForegroundColor Yellow

# Créer le ZIP
$zipPath = Join-Path $outputPath $zipName

# Supprimer le ZIP existant s'il existe
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# Fichiers à inclure dans le ZIP (exclure .git et autres fichiers non nécessaires)
$filesToInclude = @()
Get-ChildItem $extensionPath -File | ForEach-Object {
    if ($_.Name -notmatch '\.(md|html|git)$' -and $_.Name -ne 'convert_icons.html') {
        $filesToInclude += $_.FullName
    }
}

# Créer le ZIP avec PowerShell 5.1 compatible
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
foreach ($file in $filesToInclude) {
    $relativePath = (Get-Item $file).Name
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, $relativePath) | Out-Null
}
$zip.Dispose()

if (Test-Path $zipPath) {
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1KB, 2)
    Write-Host "✅ Package créé: $zipPath ($zipSize KB)" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la création du package" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 CHECKLIST CHROME WEB STORE:" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Gray

Write-Host ""
Write-Host "📄 Requis avant publication:" -ForegroundColor Yellow
Write-Host "□ Compte développeur Chrome Web Store (5$ one-time)" -ForegroundColor White
Write-Host "□ Icônes PNG (16x16, 48x48, 128x128)" -ForegroundColor White
Write-Host "□ 1-5 captures d'écran (1280x800 ou 640x400)" -ForegroundColor White
Write-Host "□ Icône du Store (128x128 PNG)" -ForegroundColor White
Write-Host "□ Description détaillée (minimum 10 caractères)" -ForegroundColor White
Write-Host "□ Politique de confidentialité (si permissions sensibles)" -ForegroundColor White

Write-Host ""
Write-Host "🎯 Prochaines étapes:" -ForegroundColor Green
Write-Host "1. Allez sur: https://chrome.google.com/webstore/devconsole" -ForegroundColor White
Write-Host "2. Cliquez 'Add new item'" -ForegroundColor White
Write-Host "3. Uploadez le ZIP: $zipPath" -ForegroundColor White
Write-Host "4. Complétez les métadonnées" -ForegroundColor White
Write-Host "5. Ajoutez captures d'écran" -ForegroundColor White
Write-Host "6. Soumettez pour révision" -ForegroundColor White

Write-Host ""
Write-Host "💡 Conseils pour l'approbation:" -ForegroundColor Cyan
Write-Host "- Description claire de la fonctionnalité" -ForegroundColor White
Write-Host "- Captures d'écran de qualité montrant l'utilisation" -ForegroundColor White
Write-Host "- Respecter les politiques du Chrome Web Store" -ForegroundColor White
Write-Host "- Tester l'extension sur différents sites" -ForegroundColor White

Write-Host ""
Write-Host "🚀 Préparation terminée!" -ForegroundColor Green