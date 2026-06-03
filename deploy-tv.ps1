# NexPlay TV Deploy Script
# Run after TV firmware update (Settings > Support > Software Update)
#
# Usage: .\deploy-tv.ps1
# Packages, installs, and launches NexPlay on the Samsung TV.

param(
    [string]$TV_IP   = "192.168.100.83",
    [string]$TV_PORT = "26101",
    [string]$Profile = "MyTVApp"
)

$tizen  = "C:\tizen-studio\tools\ide\bin\tizen.bat"
$sdb    = "C:\tizen-studio\tools\sdb.exe"
$proj   = $PSScriptRoot
$dist   = "$env:TEMP\NexPlayBuild"
$serial = "${TV_IP}:${TV_PORT}"
$appId  = "ahtRoLP5zQ.NexPlay"

# 1. Check TV connection
Write-Host "[1] Connecting to TV $serial..."
& $sdb connect $serial | Out-Null
$devices = & $sdb devices
if (-not ($devices -match [regex]::Escape($serial))) {
    Write-Host "ERROR: TV not reachable at $serial"
    Write-Host "  - Check TV is on and Developer Mode is enabled"
    Write-Host "  - Settings > Support > Developer Mode (use IP of this PC)"
    exit 1
}
Write-Host "  Connected: $($devices | Select-String $TV_IP)"

# 2. Build clean dist directory (runtime files only, no dev tools)
Write-Host "`n[2] Building clean package directory..."
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory $dist | Out-Null

$files = @("index.html","main-dist.js","main.js","polyfills.js","hls.min.js",
           "icon.png","config.xml","author-signature.xml","signature1.xml",
           ".project",".tproject","tizen_web_project.yaml")
foreach ($f in $files) {
    if (Test-Path "$proj\$f") { Copy-Item "$proj\$f" "$dist\$f" }
}
Copy-Item "$proj\css"     "$dist\css"     -Recurse -ErrorAction SilentlyContinue
Copy-Item "$proj\js-dist" "$dist\js-dist" -Recurse -ErrorAction SilentlyContinue

$fileCount = (Get-ChildItem $dist -Recurse -File).Count
Write-Host "  $fileCount files staged"

# 3. Package
Write-Host "`n[3] Packaging with profile '$Profile'..."
& $tizen package -t wgt -s $Profile -- $dist 2>&1 | Where-Object { $_ -notmatch "^$" } | ForEach-Object { Write-Host "  $_" }
$wgt = "$dist\NexPlay.wgt"
if (-not (Test-Path $wgt)) { Write-Host "ERROR: Packaging failed"; exit 1 }
$wgtKB = [int]((Get-Item $wgt).Length / 1KB)
Write-Host "  WGT: ${wgtKB} KB"

# 4. Install
Write-Host "`n[4] Installing on TV..."
$installOut = & $tizen install -n $wgt -s $serial 2>&1
$installOut | Where-Object { $_ -match "install|error|failed|success" -and $_ -notmatch "^$" } |
    ForEach-Object { Write-Host "  $_" }

if ($installOut -match "install failed") {
    $errCode = ($installOut | Select-String "install failed\[(\d+)\]").Matches.Groups[1].Value
    Write-Host ""
    Write-Host "INSTALL FAILED (error $errCode)"
    if ($errCode -eq "118") {
        Write-Host "  -> Certificate not trusted by TV firmware."
        Write-Host "  -> Fix: Settings > Support > Software Update > Update Now"
        Write-Host "  -> Then re-run this script."
    }
    exit 1
}

# 5. Launch
Write-Host "`n[5] Launching NexPlay..."
& $tizen run -p $appId -s $serial 2>&1 | Where-Object { $_ -match "launch|error" } | ForEach-Object { Write-Host "  $_" }

Write-Host "`nDone. NexPlay should now be running on the TV."
