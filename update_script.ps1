Param(
    [string]$RepoUrl,
    [string]$Branch,
    [string]$Target,
    [bool]  $Backup,
    [bool]  $DryRun
)

$ErrorActionPreference = 'Stop'

if (-not $PSBoundParameters.ContainsKey('RepoUrl')) { $RepoUrl = if ($env:REPO_URL) { $env:REPO_URL } else { 'https://github.com/rcdd/pos-ticket-printer' } }
if (-not $PSBoundParameters.ContainsKey('Branch'))  { $Branch  = if ($env:BRANCH)   { $env:BRANCH }   else { 'main' } }
if (-not $PSBoundParameters.ContainsKey('Target'))  { $Target  = if ($env:TARGET_DIR){ $env:TARGET_DIR } else { (Get-Location).Path } }
if (-not $PSBoundParameters.ContainsKey('Backup'))  { $Backup  = if ($env:BACKUP)   { [bool]::Parse($env:BACKUP) } else { $true } }
if (-not $PSBoundParameters.ContainsKey('DryRun'))  { $DryRun  = if ($env:DRY_RUN)  { [bool]::Parse($env:DRY_RUN) } else { $false } }

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Test-Command($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function New-TempDir {
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("posupdate_" + [IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $tmp
}

function Get-SourceTree($RepoUrl, $Branch) {
    $tmp = New-TempDir
    $src = Join-Path $tmp 'src'
    New-Item -ItemType Directory -Path $src | Out-Null

    if (Test-Command git) {
        Write-Host "📥 Clonar via git ($Branch)..." -ForegroundColor Cyan
        git clone --depth 1 --branch $Branch $RepoUrl $src | Out-Null
    } else {
        Write-Host "📥 Download ZIP (sem git)..." -ForegroundColor Cyan
        $zipUrl = ($RepoUrl.TrimEnd('/').TrimEnd('.git')) + "/archive/refs/heads/$Branch.zip"
        $zip = Join-Path $tmp 'src.zip'
        Invoke-WebRequest -Uri $zipUrl -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        $unpacked = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like '*pos-ticket-printer*' } | Select-Object -First 1
        if (-not $unpacked) { throw "Não foi possível expandir o ZIP." }
        Get-ChildItem -Path $unpacked.FullName -Force | ForEach-Object {
            Move-Item -Path $_.FullName -Destination $src
        }
    }
    return @{ Tmp=$tmp; Src=$src }
}

function Make-Backup($Target) {
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bkBase = Join-Path $Target (".backup-pos-ticket-$ts")
    $bkStage = "${bkBase}-staging"
    $bkZip = "${bkBase}.zip"

    Write-Host "🧳 Backup leve → $bkZip" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $bkStage | Out-Null

    $xd = @()
    foreach ($p in @('.git','.idea','.vscode','logs','data')) {
        $full = Join-Path $Target $p
        if (Test-Path $full) { $xd += $full }
    }
    foreach ($p in @('api\node_modules','ui\node_modules','api\dist','ui\dist','api\build','ui\build','api\.next','ui\.next','api\.cache','ui\.cache')) {
        $full = Join-Path $Target $p
        if (Test-Path $full) { $xd += $full }
    }

    $roboArgs = @("$Target", "$bkStage", "/E", "/R:1", "/W:1", "/NFL", "/NDL", "/NP", "/NJH", "/NJS")
    if ($xd.Count -gt 0) { $roboArgs += "/XD"; $roboArgs += $xd }
    robocopy @roboArgs | Out-Null

    Compress-Archive -Path (Join-Path $bkStage '*') -DestinationPath $bkZip -CompressionLevel Optimal
    Remove-Item -Recurse -Force $bkStage
}

function Sync-Into($SourceRoot, $Target, $DryRun) {
    Write-Host "📝 A sincronizar ficheiros para $Target" -ForegroundColor Cyan

    $xf = @('*.env','*.env.*')
    $xd = @('.git','.idea','.vscode',
    'node_modules','dist','build','.next','.cache','logs','data',
    'api\node_modules','ui\node_modules','api\dist','ui\dist','api\build','ui\build','api\.next','ui\.next','api\.cache','ui\.cache')

    $args = @("$SourceRoot", "$Target", "/E", "/R:1", "/W:1", "/XO", "/NFL", "/NDL", "/NP")
    if ($DryRun) { $args += "/L" }
    if ($xf.Count -gt 0) { $args += "/XF"; $args += $xf }
    if ($xd.Count -gt 0) { $args += "/XD"; $args += $xd }

    robocopy @args | Out-Null

    if ($DryRun) { Write-Host "✅ DRY RUN: não foi alterado nada." -ForegroundColor Yellow }
}

function Npm-Install-And-Build($projPath, [switch]$DoRebuild) {
    if (-not (Test-Path (Join-Path $projPath 'package.json'))) { return }
    Push-Location $projPath
    try {
        if (Test-Path (Join-Path $projPath 'package-lock.json')) {
            Write-Host "📦 npm ci ($projPath)" -ForegroundColor Green
            npm ci
        } else {
            Write-Host "📦 npm install ($projPath)" -ForegroundColor Green
            npm install
        }
        if ($DoRebuild) {
            Write-Host "🔩 npm rebuild ($projPath)" -ForegroundColor DarkGreen
            try { npm rebuild } catch { Write-Host "ℹ️ rebuild ignorado: $($_.Exception.Message)" -ForegroundColor DarkYellow }
        }
        Write-Host "🧱 npm run build ($projPath)" -ForegroundColor Green
        try { npm run build } catch { Write-Host "ℹ️ build ignorado (script inexistente?): $($_.Exception.Message)" -ForegroundColor DarkYellow }
    } finally {
        Pop-Location
    }
}

# --------- MAIN ----------
Write-Host "🔎 Pré-checks" -ForegroundColor Cyan
if (-not (Test-Command robocopy)) { throw "robocopy não encontrado (deveria existir no Windows)." }
if (-not (Test-Command powershell)) { throw "PowerShell não disponível?!" }
if (-not (Test-Command npm)) { Write-Host "⚠️ npm não encontrado — skipping installs/builds." -ForegroundColor Yellow }

$pull = Get-SourceTree -RepoUrl $RepoUrl -Branch $Branch
$srcRoot = $pull.Src
$tmpRoot = $pull.Tmp

try {
    if ($Backup) { Make-Backup -Target $Target }
    Sync-Into -SourceRoot $srcRoot -Target $Target -DryRun:$DryRun

    if (-not $DryRun) {
        $apiPath = Join-Path $Target 'api'
        $uiPath  = Join-Path $Target 'ui'
        if (Test-Path $apiPath -and (Test-Command npm)) { Npm-Install-And-Build -projPath $apiPath -DoRebuild }
        if (Test-Path $uiPath  -and (Test-Command npm)) { Npm-Install-And-Build -projPath $uiPath }
    }

    Write-Host "🎉 Update concluído. Arranque fica a cargo do teu 'startup'." -ForegroundColor Cyan
}
finally {
    Remove-Item -Recurse -Force $tmpRoot
}
