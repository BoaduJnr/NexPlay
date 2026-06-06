# ── NexPlay Web — Build Script ───────────────────────────────────────────────
# Builds fresh JS/CSS and assembles all web-facing files into deploy-dist/.
# Deploy manually: cd deploy-dist && deployctl deploy --project=<name> server.ts
# ─────────────────────────────────────────────────────────────────────────────

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Dist = Join-Path $Root "deploy-dist"

Write-Host "[1] Building JS..."
Push-Location $Root
npx babel js/ --out-dir js-dist/ --quiet
Write-Host "[2] Building CSS..."
npx postcss css/style.css --output css/style-dist.css
Pop-Location

Write-Host "[3] Assembling deploy-dist/..."
if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }
New-Item -ItemType Directory $Dist | Out-Null

# Root files
foreach ($f in @("index.html", "polyfills.js", "hls.min.js", "main-dist.js", "icon.png", "server.ts")) {
  $src = Join-Path $Root $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $Dist $f) }
}

# CSS
$cssOut = Join-Path $Dist "css"
New-Item -ItemType Directory $cssOut | Out-Null
Copy-Item (Join-Path $Root "css\style-dist.css") (Join-Path $cssOut "style-dist.css")

# JS dist (all compiled files, preserving folder structure)
Copy-Item (Join-Path $Root "js-dist") (Join-Path $Dist "js-dist") -Recurse

Write-Host ""
Write-Host "Done. Files are in: $Dist" -ForegroundColor Green
Write-Host "To deploy:  cd deploy-dist" -ForegroundColor Cyan
Write-Host "            deployctl deploy --project=<your-project> server.ts" -ForegroundColor Cyan
