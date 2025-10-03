Param(
    [string]$RepoUrl,
    [string]$Branch,
    [string]$Target,
    [bool]  $Backup,
    [bool]  $DryRun
)

$ErrorActionPreference = 'Stop'

# ---------- Defaults ----------
if (-not $PSBoundParameters.ContainsKey('RepoUrl')) { $RepoUrl = if ($env:REPO_URL)  { $env:REPO_URL }  else { 'https://github.com/rcdd/pos-ticket-printer' } }
if (-not $PSBoundParameters.ContainsKey('Branch'))  { $Branch  = if ($env:BRANCH)    { $env:BRANCH }    else { 'main' } }
if (-not $PSBoundParameters.ContainsKey('Target'))  { $Target  = if ($env:TARGET_DIR){ $env:TARGET_DIR } else { (Get-Location).Path } }
if (-not $PSBoundParameters.ContainsKey('DryRun'))  { $DryRun  = if ($env:DRY_RUN)   { [bool]::Parse($env:DRY_RUN) } else { $false } }

if (-not $PSBoundParameters.ContainsKey('Backup')) {
    $answer = Read-Host "Pretende criar backup antes de atualizar? (S/N)"
    if ($answer -match '^[Ss]') { $Backup = $true } else { $Backup = $false }
}

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Test-Command { param($name) return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function New-TempDir {
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("posupdate_" + [IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    return $tmp
}

function Get-SourceTree {
    param([string]$RepoUrl,[string]$Branch)
    $tmp = New-TempDir
    $src = Join-Path $tmp 'src'
    New-Item -ItemType Directory -Path $src | Out-Null

    if (Test-Command git) {
        Write-Host "Clonar via git ($Branch)..."
        git clone --depth 1 --branch $Branch $RepoUrl $src | Out-Null
    } else {
        Write-Host "Download ZIP (sem git)..."
        $zipUrl = ($RepoUrl.TrimEnd('/').TrimEnd('.git')) + "/archive/refs/heads/$Branch.zip"
        $zip = Join-Path $tmp 'src.zip'
        Invoke-WebRequest -Uri $zipUrl -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        $unpacked = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like '*pos-ticket-printer*' } | Select-Object -First 1
        if (-not $unpacked) { throw "Nao foi possivel expandir o ZIP." }
        Get-ChildItem -Path $unpacked.FullName -Force | ForEach-Object {
            Move-Item -Path $_.FullName -Destination $src
        }
    }
    return @{ Tmp = $tmp; Src = $src }
}

function Make-Backup {
    param([string]$Target)
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bkBase = Join-Path $Target (".backup-pos-ticket-$ts")
    $bkStage = "${bkBase}-staging"
    $bkZip = "${bkBase}.zip"

    Write-Host "Backup leve -> $bkZip"
    New-Item -ItemType Directory -Path $bkStage | Out-Null

    $xd = @()
    foreach ($p in @('.git','.idea','.vscode','logs','data','node_modules')) {
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

function Stop-ProjectProcesses {
    param([string]$ProjectRoot)

    Write-Host "A terminar processos ativos do projeto (Node/npm/PM2/Dev servers)..."

    $names = @('node','npm','npx','react','react-scripts','webpack','vite','ts-node','next')
    $procs = Get-WmiObject Win32_Process | Where-Object {
        ($names -contains ($_.Name -replace '\.exe$','')) -and
                ($_.CommandLine -and ($_.CommandLine -like "*$ProjectRoot*"))
    }

    foreach ($p in $procs) {
        try {
            Write-Host (" - PID {0} : {1}" -f $p.ProcessId, $p.CommandLine)
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host ("   (aviso) Falhou terminar PID {0}: {1}" -f $p.ProcessId, $_.Exception.Message)
        }
    }

    if (Test-Command pm2) {
        Write-Host "A parar PM2 (api-pos, ui-pos se existirem)..."
        try { pm2 stop api-pos   *>$null } catch {}
        try { pm2 delete api-pos *>$null } catch {}
        try { pm2 stop ui-pos    *>$null } catch {}
        try { pm2 delete ui-pos  *>$null } catch {}
    }

    $composeYml = Join-Path $ProjectRoot 'docker-compose.yml'
    if ((Test-Path $composeYml) -and (Test-Command docker)) {
        Write-Host "A parar docker compose do projeto (se estiver a correr)..."
        Push-Location $ProjectRoot
        try { docker compose down *>$null } catch {}
        Pop-Location
    }

    Start-Sleep -Seconds 1
}

function Sync-Into {
    param([string]$SourceRoot,[string]$Target,[bool]$DryRun)

    Write-Host "A sincronizar ficheiros para $Target"

    $xf = @('*.env','*.env.*')
    $xd = @('.git','.idea','.vscode',
    'node_modules','dist','build','.next','.cache','logs','data',
    'api\node_modules','ui\node_modules','api\dist','ui\dist','api\build','ui\build','api\.next','ui\.next','api\.cache','ui\.cache')

    $args = @("$SourceRoot", "$Target", "/E", "/R:1", "/W:1", "/IS", "/IT", "/FFT", "/NFL", "/NDL", "/NP")
    if ($DryRun) { $args += "/L" }
    if ($xf.Count -gt 0) { $args += "/XF"; $args += $xf }
    if ($xd.Count -gt 0) { $args += "/XD"; $args += $xd }

    robocopy @args | Out-Null

    if ($DryRun) { Write-Host "DRY RUN: nada foi alterado." }
}

function Npm-Install-And-Build {
    param([string]$projPath,[switch]$DoRebuild)
    if (-not (Test-Path (Join-Path $projPath 'package.json'))) { return }
    Push-Location $projPath
    try {
        $installed = $false
        for ($i=1; $i -le 3 -and -not $installed; $i++) {
            try {
                if (Test-Path (Join-Path $projPath 'package-lock.json')) {
                    Write-Host "npm ci ($projPath) - tentativa $i"
                    npm ci
                } else {
                    Write-Host "npm install ($projPath) - tentativa $i"
                    npm install
                }
                $installed = $true
            } catch {
                Write-Host ("(aviso) npm falhou: " + $_.Exception.Message)
                if ($i -lt 3) { Start-Sleep -Seconds 2 }
            }
        }
        if (-not $installed) { throw "npm install/ci falhou apos 3 tentativas." }

        if ($DoRebuild) {
            Write-Host "npm rebuild ($projPath)"
            try { npm rebuild } catch { Write-Host ("rebuild ignorado: " + $_.Exception.Message) }
        } else {
            Write-Host "npm run build ($projPath)"
            try { npm run build } catch { Write-Host ("build ignorado: " + $_.Exception.Message) }
        }

    } finally {
        Pop-Location
    }
}

# --------- MAIN ---------
Write-Host "Pre-checks"
if (-not (Test-Command robocopy)) { throw "robocopy nao encontrado (deveria existir no Windows)." }
if (-not (Test-Command npm)) { Write-Host "Aviso: npm nao encontrado. A ignorar installs/builds." }

$pull = Get-SourceTree -RepoUrl $RepoUrl -Branch $Branch
$srcRoot = $pull.Src
$tmpRoot = $pull.Tmp

try {
    if ($Backup) { Make-Backup -Target $Target }
    Sync-Into -SourceRoot $srcRoot -Target $Target -DryRun:$DryRun

    if (-not $DryRun) {
        Stop-ProjectProcesses -ProjectRoot $Target

        $apiPath = Join-Path $Target 'api'
        $uiPath  = Join-Path $Target 'ui'
        if ( (Test-Path $apiPath) -and (Test-Command npm) ) {
            Npm-Install-And-Build -projPath $apiPath -DoRebuild
        }
        if ( (Test-Path $uiPath) -and (Test-Command npm) ) {
            Npm-Install-And-Build -projPath $uiPath
        }
    }

    Write-Host "Update concluido. O arranque fica a cargo do teu startup."
}
finally {
    Remove-Item -Recurse -Force $tmpRoot
}

Pause
