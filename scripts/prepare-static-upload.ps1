param(
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteRoot = Join-Path $projectRoot 'site'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $projectRoot "pages-deploy-$([guid]::NewGuid().ToString())"
}
$archivePath = "$OutputDirectory.zip"
$staticFiles = @(
  'index.html', 'bazi.html', 'calendar.html', 'qimen.html', 'ziwei_v3.html',
  'styles.css', 'fix.css', 'tool.css', 'tool-fix.css', 'script.js', 'tool.js', 'module-form.js'
)

if (Test-Path -LiteralPath $OutputDirectory) {
  throw "Output directory already exists: $OutputDirectory. Choose a new output directory."
}
if (Test-Path -LiteralPath $archivePath) {
  throw "Output archive already exists: $archivePath. Choose a new output directory."
}

New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
foreach ($file in $staticFiles) {
  Copy-Item -LiteralPath (Join-Path $siteRoot $file) -Destination $OutputDirectory
}

# The Cloudflare dashboard's static-file uploader accepts HTML, CSS and JS only.
# Embed the homepage WebP image in the copied CSS so the upload has no separate image
# asset that the dashboard could silently omit.
$backgroundPath = Join-Path $siteRoot 'assets\hero-celestial.webp'
if (-not (Test-Path -LiteralPath $backgroundPath)) {
  throw "Homepage background image not found: $backgroundPath"
}
$backgroundData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($backgroundPath))
$fixCssPath = Join-Path $OutputDirectory 'fix.css'
$fixCss = [System.IO.File]::ReadAllText($fixCssPath)
$embeddedImage = "url(`"data:image/webp;base64,$backgroundData`")"
$updatedFixCss = $fixCss.Replace('url("assets/hero-celestial.webp")', $embeddedImage)
if ($updatedFixCss -eq $fixCss) {
  throw 'Could not find the homepage background reference in fix.css.'
}
[System.IO.File]::WriteAllText($fixCssPath, $updatedFixCss, (New-Object System.Text.UTF8Encoding($false)))

Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $OutputDirectory | Select-Object -ExpandProperty FullName) -DestinationPath $archivePath

Write-Host "Static upload archive created: $archivePath"
