param(
  [string]$OutputDirectory = 'E:\xuan\pages-deploy'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteRoot = Join-Path $projectRoot 'site'
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
Copy-Item -LiteralPath (Join-Path $siteRoot 'assets') -Destination $OutputDirectory -Recurse
Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $OutputDirectory | Select-Object -ExpandProperty FullName) -DestinationPath $archivePath

Write-Host "Static upload archive created: $archivePath"
