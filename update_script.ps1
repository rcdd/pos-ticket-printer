Param(
    [string]$RepoUrl,
    [string]$Branch,
    [string]$ReleaseUrl,
    [string]$ZipPath,
    [bool]  $UseSource,
    [string]$Target,
    [bool]  $Backup,
    [bool]  $DryRun
)

$ErrorActionPreference = 'Stop'

# Clicking or tapping a console window puts it in QuickEdit selection mode,
# which freezes this script at its next output until Enter/Esc is pressed (on
# a touchscreen POS that looks like a hang). Turned off for this window only.
function Disable-ConsoleQuickEdit
{
    try
    {
        if (-not ('PosTicket.ConsoleMode' -as [type]))
        {
            Add-Type -Namespace PosTicket -Name ConsoleMode -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern System.IntPtr GetStdHandle(int nStdHandle);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool GetConsoleMode(System.IntPtr hConsoleHandle, out uint lpMode);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool SetConsoleMode(System.IntPtr hConsoleHandle, uint dwMode);
"@
        }
        $stdin = [PosTicket.ConsoleMode]::GetStdHandle(-10)
        $mode = [uint32]0
        if ([PosTicket.ConsoleMode]::GetConsoleMode($stdin, [ref]$mode))
        {
            # Clear ENABLE_QUICK_EDIT_MODE (0x40); ENABLE_EXTENDED_FLAGS (0x80) makes it stick.
            [void][PosTicket.ConsoleMode]::SetConsoleMode($stdin, [uint32](($mode -band (-bnot 0x40)) -bor 0x80))
        }
    }
    catch
    {
    }
}
Disable-ConsoleQuickEdit

# Kiosk machines usually have only a touchscreen, no keyboard: when the update
# source isn't given on the command line, every question is asked in a window
# with big buttons instead of Read-Host. Explicit parameters/env vars keep the
# old unattended console behaviour.
$Interactive = -not ($PSBoundParameters.ContainsKey('ZipPath') -or
        $PSBoundParameters.ContainsKey('ReleaseUrl') -or
        $PSBoundParameters.ContainsKey('UseSource') -or
        $env:RELEASE_URL -or $env:USE_SOURCE)

# ---------- Defaults ----------
# Legacy path (only used with -UseSource, or as an automatic fallback if the
# release package below can't be reached): clones/downloads raw source and
# builds ui/api/terminal locally on the client machine.
if (-not $PSBoundParameters.ContainsKey('RepoUrl'))
{
    $RepoUrl = if ($env:REPO_URL)
    {
        $env:REPO_URL
    }
    else
    {
        'https://github.com/rcdd/pos-ticket-printer'
    }
}
if (-not $PSBoundParameters.ContainsKey('Branch'))
{
    $Branch = if ($env:BRANCH)
    {
        $env:BRANCH
    }
    else
    {
        'main'
    }
}
# Default path: a pre-built package (ui/build and terminal/dist already
# compiled by the release-zip GitHub Action) served from Ruben's own domain,
# so client machines don't need a matching local Node/npm toolchain just to
# rebuild static assets that never change per-machine.
if (-not $PSBoundParameters.ContainsKey('ReleaseUrl'))
{
    $ReleaseUrl = if ($env:RELEASE_URL)
    {
        $env:RELEASE_URL
    }
    else
    {
        'https://pos.rubendomingues.pt/download'
    }
}
if (-not $PSBoundParameters.ContainsKey('UseSource'))
{
    $UseSource = if ($env:USE_SOURCE)
    {
        [bool]::Parse($env:USE_SOURCE)
    }
    else
    {
        $false
    }
}
if (-not $PSBoundParameters.ContainsKey('Target') -and $env:TARGET_DIR)
{
    $Target = $env:TARGET_DIR
}
if (-not $PSBoundParameters.ContainsKey('DryRun'))
{
    $DryRun = if ($env:DRY_RUN)
    {
        [bool]::Parse($env:DRY_RUN)
    }
    else
    {
        $false
    }
}

try
{
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}
catch
{
}

function Test-Command
{
    param($name) return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function New-TempDir
{
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("posupdate_" + [IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    return $tmp
}

function Get-SourceTree
{
    param([string]$RepoUrl, [string]$Branch)
    $tmp = New-TempDir
    $src = Join-Path $tmp 'src'
    New-Item -ItemType Directory -Path $src | Out-Null

    if (Test-Command git)
    {
        Write-Host "Clonar via git ($Branch)..."
        git clone --depth 1 --branch $Branch $RepoUrl $src | Out-Null
    }
    else
    {
        Write-Host "Download ZIP (sem git)..."
        $zipUrl = ($RepoUrl.TrimEnd('/').TrimEnd('.git')) + "/archive/refs/heads/$Branch.zip"
        $zip = Join-Path $tmp 'src.zip'
        Invoke-WebRequest -Uri $zipUrl -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        $unpacked = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like '*pos-ticket-printer*' } | Select-Object -First 1
        if (-not $unpacked)
        {
            throw "Nao foi possivel expandir o ZIP."
        }
        Get-ChildItem -Path $unpacked.FullName -Force | ForEach-Object {
            Move-Item -Path $_.FullName -Destination $src
        }
    }
    return @{ Tmp = $tmp; Src = $src }
}

# Same package the one-file installer (Instalar-POS-Ticket.bat) downloads —
# a flat zip of the repo root (no wrapping folder) with ui/build and
# terminal/dist already compiled, produced by .github/workflows/release-zip.yml.
function Get-ReleasePackage
{
    param([string]$ReleaseUrl)
    $tmp = New-TempDir
    $zip = Join-Path $tmp 'pos-ticket.zip'

    Write-Host "Download do pacote de release ($ReleaseUrl)..."
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $zip
    return Expand-ReleasePackage -Zip $zip -Tmp $tmp
}

# Offline path: the same release zip, copied by hand (e.g. on a USB stick).
function Get-LocalReleasePackage
{
    param([string]$ZipPath)
    if (-not (Test-Path $ZipPath))
    {
        throw "Ficheiro nao encontrado: $ZipPath"
    }
    Write-Host "Pacote local: $ZipPath"
    return Expand-ReleasePackage -Zip $ZipPath -Tmp (New-TempDir)
}

function Expand-ReleasePackage
{
    param([string]$Zip, [string]$Tmp)
    $src = Join-Path $Tmp 'src'

    Write-Host "A extrair o pacote..."
    # ZipFile is much faster than Expand-Archive on Windows PowerShell 5.1,
    # which matters now that the package ships api\node_modules (~thousands of files).
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($Zip, $src)

    if (-not (Test-Path (Join-Path $src 'package.json')))
    {
        throw "Pacote de release com estrutura inesperada (falta package.json na raiz)."
    }

    return @{ Tmp = $Tmp; Src = $src }
}

function Get-PackageVersion
{
    param([string]$Root)
    try
    {
        return (Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
    }
    catch
    {
        return '?'
    }
}

# ---------- Touch-friendly dialogs ----------
function Show-Choice
{
    param([string]$Title, [string]$Message, [string[]]$Options)

    $form = New-Object System.Windows.Forms.Form
    $form.Text = $Title
    $form.Font = New-Object System.Drawing.Font('Segoe UI', 13)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    $form.Tag = -1

    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Message
    $label.Location = New-Object System.Drawing.Point(20, 20)
    $label.MaximumSize = New-Object System.Drawing.Size(600, 0)
    $label.AutoSize = $true
    $form.Controls.Add($label)
    $y = 40 + $label.GetPreferredSize((New-Object System.Drawing.Size(600, 0))).Height

    for ($i = 0; $i -lt $Options.Count; $i++) {
        $button = New-Object System.Windows.Forms.Button
        $button.Text = $Options[$i]
        $button.Tag = $i
        $button.AutoEllipsis = $true
        $button.Location = New-Object System.Drawing.Point(20, $y)
        $button.Size = New-Object System.Drawing.Size(600, 64)
        $button.Add_Click({
            $owner = $this.FindForm()
            $owner.Tag = $this.Tag
            $owner.Close()
        })
        $form.Controls.Add($button)
        $y += 76
    }

    $form.ClientSize = New-Object System.Drawing.Size(640, ($y + 8))
    [void]$form.ShowDialog()
    $choice = [int]$form.Tag
    $form.Dispose()
    return $choice
}

function Confirm-Choice
{
    param([string]$Message)
    return (Show-Choice -Title 'POS Ticket' -Message $Message -Options @('Sim', 'Não')) -eq 0
}

function Ask-YesNo
{
    param([string]$Message)
    if ($Interactive)
    {
        return Confirm-Choice $Message
    }
    return (Read-Host "$Message (S/N)") -match '^[Ss]'
}

function New-TopMostOwner
{
    $owner = New-Object System.Windows.Forms.Form
    $owner.TopMost = $true
    return $owner
}

function Get-RemovableRoots
{
    return [IO.DriveInfo]::GetDrives() |
            Where-Object { $_.DriveType -eq 'Removable' -and $_.IsReady } |
            ForEach-Object { $_.RootDirectory.FullName }
}

function Select-ZipFile
{
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Escolha o pacote de atualização (pos-ticket.zip)'
    $dialog.Filter = 'Pacote POS Ticket (*.zip)|*.zip'
    $start = @(Get-RemovableRoots) + @($PSScriptRoot) | Select-Object -First 1
    $dialog.InitialDirectory = $start
    if ($dialog.ShowDialog((New-TopMostOwner)) -eq 'OK')
    {
        return $dialog.FileName
    }
    return $null
}

function Select-InstallFolder
{
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = 'Escolha a pasta onde o POS Ticket está instalado'
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog((New-TopMostOwner)) -eq 'OK')
    {
        return $dialog.SelectedPath
    }
    return $null
}

# A pos-ticket*.zip next to this script or at the root of a USB stick.
function Find-LocalPackage
{
    $dirs = @($PSScriptRoot) + @(Get-RemovableRoots)
    return $dirs |
            ForEach-Object { Get-ChildItem -Path $_ -Filter 'pos-ticket*.zip' -File -ErrorAction SilentlyContinue } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 -ExpandProperty FullName
}

function Test-InstallDir
{
    param([string]$Path)
    return ($Path -and (Test-Path (Join-Path $Path 'api\server.js')))
}

# update.bat can be run either from the installed folder or straight from a
# USB stick (copied there together with the zip), so the install dir isn't
# always the script's own folder.
function Find-InstallDir
{
    $onRemovable = $false
    try
    {
        $onRemovable = ([IO.DriveInfo]::new((Split-Path $PSScriptRoot -Qualifier)).DriveType -eq 'Removable')
    }
    catch
    {
    }
    if (-not $onRemovable -and (Test-InstallDir $PSScriptRoot))
    {
        return $PSScriptRoot
    }

    $shortcut = "$env:USERPROFILE\Desktop\POS Ticket.lnk"
    if (Test-Path $shortcut)
    {
        $workDir = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut).WorkingDirectory
        if (Test-InstallDir $workDir)
        {
            return $workDir
        }
    }
    if (Test-InstallDir 'C:\POS-Ticket')
    {
        return 'C:\POS-Ticket'
    }
    return $null
}

# Asks for the install dir and the package source. Returns $null on cancel.
function Select-UpdatePlan
{
    param([string]$Target)

    if (-not $Target)
    {
        $Target = Find-InstallDir
    }
    while (-not (Test-InstallDir $Target))
    {
        $choice = Show-Choice -Title 'Atualizar POS Ticket' `
            -Message 'Não foi possível encontrar a instalação do POS Ticket.' `
            -Options @('Escolher a pasta da instalação...', 'Cancelar')
        if ($choice -ne 0)
        {
            return $null
        }
        $Target = Select-InstallFolder
    }

    $local = Find-LocalPackage
    $actions = @()
    $labels = @()
    if ($local)
    {
        $actions += 'local'; $labels += "Usar o pacote encontrado: $local"
    }
    $actions += 'pick'; $labels += 'Escolher o ficheiro .zip (pen USB)...'
    $actions += 'online'; $labels += 'Descarregar da internet'
    $actions += 'cancel'; $labels += 'Cancelar'

    $message = "Instalação: $Target (versão $( Get-PackageVersion $Target ))`n`nDe onde vem a atualização?"
    while ($true)
    {
        $choice = Show-Choice -Title 'Atualizar POS Ticket' -Message $message -Options $labels
        $action = if ($choice -ge 0)
        {
            $actions[$choice]
        }
        else
        {
            'cancel'
        }
        switch ($action)
        {
            'local' {
                return @{ Target = $Target; ZipPath = $local }
            }
            'pick' {
                $picked = Select-ZipFile
                if ($picked)
                {
                    return @{ Target = $Target; ZipPath = $picked }
                }
            }
            'online' {
                return @{ Target = $Target; ZipPath = $null }
            }
            default {
                return $null
            }
        }
    }
}

function Make-Backup
{
    param([string]$Target)
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bkBase = Join-Path $Target (".backup-pos-ticket-$ts")
    $bkStage = "${bkBase}-staging"
    $bkZip = "${bkBase}.zip"

    Write-Host "Backup leve -> $bkZip"
    New-Item -ItemType Directory -Path $bkStage | Out-Null

    $xd = @()
    foreach ($p in @('.git', '.idea', '.vscode', 'logs', 'data', 'node_modules'))
    {
        $full = Join-Path $Target $p
        if (Test-Path $full)
        {
            $xd += $full
        }
    }
    foreach ($p in @('api\node_modules', 'ui\node_modules', 'terminal\node_modules', 'api\dist', 'ui\dist', 'terminal\dist', 'api\build', 'ui\build', 'api\.next', 'ui\.next', 'api\.cache', 'ui\.cache'))
    {
        $full = Join-Path $Target $p
        if (Test-Path $full)
        {
            $xd += $full
        }
    }

    $roboArgs = @("$Target", "$bkStage", "/E", "/R:1", "/W:1", "/NFL", "/NDL", "/NP", "/NJH", "/NJS")
    if ($xd.Count -gt 0)
    {
        $roboArgs += "/XD"; $roboArgs += $xd
    }
    robocopy @roboArgs | Out-Null

    Compress-Archive -Path (Join-Path $bkStage '*') -DestinationPath $bkZip -CompressionLevel Optimal
    Remove-Item -Recurse -Force $bkStage
}

function Stop-ProjectProcesses
{
    param([string]$ProjectRoot)

    Write-Host "A terminar processos ativos do projeto (Node/npm/PM2/Dev servers)..."

    $names = @('node', 'npm', 'npx', 'react', 'react-scripts', 'webpack', 'vite', 'ts-node', 'next')
    $procs = Get-WmiObject Win32_Process | Where-Object {
        ($names -contains ($_.Name -replace '\.exe$', '')) -and
                ($_.CommandLine -and ($_.CommandLine -like "*$ProjectRoot*"))
    }

    foreach ($p in $procs)
    {
        try
        {
            Write-Host (" - PID {0} : {1}" -f $p.ProcessId, $p.CommandLine)
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
        catch
        {
            Write-Host ("   (aviso) Falhou terminar PID {0}: {1}" -f $p.ProcessId, $_.Exception.Message)
        }
    }

    if (Test-Command pm2)
    {
        Write-Host "A parar PM2 (api-pos, ui-pos se existirem)..."
        try
        {
            pm2 stop api-pos   *> $null
        }
        catch
        {
        }
        try
        {
            pm2 delete api-pos *> $null
        }
        catch
        {
        }
        try
        {
            pm2 stop ui-pos    *> $null
        }
        catch
        {
        }
        try
        {
            pm2 delete ui-pos  *> $null
        }
        catch
        {
        }
    }

    $composeYml = Join-Path $ProjectRoot 'docker-compose.yml'
    if ((Test-Path $composeYml) -and (Test-Command docker))
    {
        Write-Host "A parar docker compose do projeto (se estiver a correr)..."
        Push-Location $ProjectRoot
        try
        {
            docker compose down *> $null
        }
        catch
        {
        }
        Pop-Location
    }

    Start-Sleep -Seconds 1
}

function Sync-Into
{
    param([string]$SourceRoot, [string]$Target, [bool]$DryRun)

    Write-Host "A sincronizar ficheiros para $Target"

    $xf = @('*.env', '*.env.*')
    # ui\build and terminal\dist are NOT excluded here on purpose: the
    # release package ships them pre-built, and this is exactly what lets
    # the client machine skip building those locally (see Get-ReleasePackage).
    $xd = @('.git', '.idea', '.vscode',
    'node_modules', '.next', '.cache', 'logs', 'data',
    'api\node_modules', 'ui\node_modules', 'terminal\node_modules', 'api\dist', 'api\build', 'api\.next', 'ui\.next', 'api\.cache', 'ui\.cache')

    $args = @("$SourceRoot", "$Target", "/E", "/R:1", "/W:1", "/IS", "/IT", "/FFT", "/NFL", "/NDL", "/NP")
    if ($DryRun)
    {
        $args += "/L"
    }
    if ($xf.Count -gt 0)
    {
        $args += "/XF"; $args += $xf
    }
    if ($xd.Count -gt 0)
    {
        $args += "/XD"; $args += $xd
    }

    robocopy @args | Out-Null

    if ($DryRun)
    {
        Write-Host "DRY RUN: nada foi alterado."
    }
}

# The release package ships api\node_modules (installed with `npm ci` on the
# release runner; bcrypt carries its own win32-x64 prebuild), so an update
# needs no internet. Mirrored rather than merged so removed packages go away.
function Sync-ApiModules
{
    param([string]$Source, [string]$Destination)
    robocopy "$Source" "$Destination" /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8)
    {
        throw "Falha a copiar api\node_modules (robocopy codigo $LASTEXITCODE)."
    }
}

# Machines installed before remote admin existed lack the port 3000 rule
# (install_script.ps1 creates it on new installs). update.bat isn't elevated,
# so the rule is created through a one-off UAC prompt; declining it only
# means the admin UI stays reachable from this PC alone.
function Ensure-RemoteAdminFirewallRule
{
    $ruleName = 'POS Ticket - Administracao (3000)'
    if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)
    {
        return
    }
    Write-Host "A abrir a porta 3000 na firewall (gerir o POS a partir de outro computador da rede)..."
    $command = "New-NetFirewallRule -DisplayName '$ruleName' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private, Domain"
    try
    {
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -WindowStyle Hidden `
            -ArgumentList @('-NoProfile', '-Command', $command)
    }
    catch
    {
        Write-Host "(aviso) Regra de firewall nao criada: $( $_.Exception.Message )"
    }
}

# Removes node_modules only. The repo's package-lock.json is kept ON PURPOSE:
# Npm-Install-And-Build then runs `npm ci`, which installs the exact dependency
# set that was tested upstream, instead of re-resolving version ranges on the
# client machine (which used to pull untested versions on every update).
function Reset-NpmArtifacts
{
    param([string]$projPath)

    $nodeModules = Join-Path $projPath 'node_modules'

    if (Test-Path $nodeModules)
    {
        Write-Host "A remover node_modules ($projPath)"
        try
        {
            Remove-Item -Path $nodeModules -Recurse -Force -ErrorAction Stop
        }
        catch
        {
            throw "Falha ao remover node_modules em $projPath : $($_.Exception.Message)"
        }
    }
}

function Npm-Install-And-Build
{
    param([string]$projPath, [switch]$DoRebuild)
    if (-not (Test-Path (Join-Path $projPath 'package.json')))
    {
        return
    }
    Push-Location $projPath
    try
    {
        $installed = $false
        for ($i = 1; $i -le 3 -and -not $installed; $i++) {
            try
            {
                if (Test-Path (Join-Path $projPath 'package-lock.json'))
                {
                    Write-Host "npm ci ($projPath) - tentativa $i"
                    npm ci
                }
                else
                {
                    Write-Host "npm install ($projPath) - tentativa $i"
                    npm install --include optional
                }
                $installed = $true
            }
            catch
            {
                Write-Host ("(aviso) npm falhou: " + $_.Exception.Message)
                if ($i -lt 3)
                {
                    Start-Sleep -Seconds 2
                }
            }
        }
        if (-not $installed)
        {
            throw "npm install/ci falhou apos 3 tentativas."
        }

        if ($DoRebuild)
        {
            Write-Host "npm rebuild ($projPath)"
            try
            {
                npm rebuild
            }
            catch
            {
                Write-Host ("rebuild ignorado: " + $_.Exception.Message)
            }
        }
        else
        {
            Write-Host "npm run build ($projPath)"
            try
            {
                npm run build
            }
            catch
            {
                Write-Host ("build ignorado: " + $_.Exception.Message)
            }
        }

    }
    finally
    {
        Pop-Location
    }
}

# --------- MAIN ---------
if ($Interactive)
{
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    [System.Windows.Forms.Application]::EnableVisualStyles()

    $plan = Select-UpdatePlan -Target $Target
    if (-not $plan)
    {
        Write-Host "Atualizacao cancelada."
        exit 0
    }
    $Target = $plan.Target
    $ZipPath = $plan.ZipPath
}
elseif (-not $Target)
{
    $Target = (Get-Location).Path
}

if (-not $PSBoundParameters.ContainsKey('Backup'))
{
    $Backup = Ask-YesNo 'Criar uma cópia de segurança antes de atualizar?'
}

try
{
    Write-Host "Pre-checks"
    if (-not (Test-Command robocopy))
    {
        throw "robocopy nao encontrado (deveria existir no Windows)."
    }
    if (-not (Test-Command npm))
    {
        Write-Host "Aviso: npm nao encontrado. A ignorar installs/builds."
    }

    if ($ZipPath)
    {
        # Offline update: no fallback to GitHub, there's no internet anyway.
        Write-Host "Modo: pacote de release local (sem internet)"
        $pull = Get-LocalReleasePackage -ZipPath $ZipPath
        $sourceMode = 'release'
    }
    elseif ($UseSource)
    {
        Write-Host "Modo: codigo-fonte ($RepoUrl, $Branch) + build local"
        $pull = Get-SourceTree -RepoUrl $RepoUrl -Branch $Branch
        $sourceMode = 'source'
    }
    else
    {
        try
        {
            Write-Host "Modo: pacote de release pre-compilado ($ReleaseUrl)"
            $pull = Get-ReleasePackage -ReleaseUrl $ReleaseUrl
            $sourceMode = 'release'
        }
        catch
        {
            Write-Host ("(aviso) Falha a obter o pacote de release: " + $_.Exception.Message)
            Write-Host "A tentar via codigo-fonte (GitHub) como alternativa..."
            $pull = Get-SourceTree -RepoUrl $RepoUrl -Branch $Branch
            $sourceMode = 'source'
        }
    }
    $srcRoot = $pull.Src
    $tmpRoot = $pull.Tmp
    $fromVersion = Get-PackageVersion $Target
    $toVersion = Get-PackageVersion $srcRoot

    # Checked before anything is stopped or overwritten: an incomplete bundle
    # (e.g. a dependency left out by `npm ci --omit=dev`) must not leave the
    # machine with an API that can't start.
    $bundledModules = Join-Path $srcRoot 'api\node_modules'
    if (Test-Path $bundledModules)
    {
        $apiDeps = (Get-Content (Join-Path $srcRoot 'api\package.json') -Raw | ConvertFrom-Json).dependencies.PSObject.Properties.Name
        $missing = @($apiDeps | Where-Object { -not (Test-Path (Join-Path $bundledModules "$_\package.json")) })
        if ($missing.Count -gt 0)
        {
            throw "Pacote incompleto: faltam dependencias da API ($( $missing -join ', ' )). Nada foi alterado."
        }
    }

    try
    {
        if ($Backup)
        {
            Make-Backup -Target $Target
        }

        # Stopped before syncing: a running API keeps native modules
        # (bcrypt.node) locked, which would make the node_modules copy fail.
        if (-not $DryRun)
        {
            Stop-ProjectProcesses -ProjectRoot $Target
        }
        Sync-Into -SourceRoot $srcRoot -Target $Target -DryRun:$DryRun

        if (-not $DryRun)
        {
            $apiPath = Join-Path $Target 'api'
            if (Test-Path $bundledModules)
            {
                Write-Host "Dependencias da API incluidas no pacote - a copiar (nao precisa de internet)..."
                Sync-ApiModules -Source $bundledModules -Destination (Join-Path $apiPath 'node_modules')
            }
            elseif (Ask-YesNo 'Atualizar as dependências da API? (precisa de internet)')
            {
                if ((Test-Path $apiPath) -and (Test-Command npm))
                {
                    Reset-NpmArtifacts -projPath $apiPath
                    Npm-Install-And-Build -projPath $apiPath -DoRebuild
                }
            }
            if ($sourceMode -eq 'source')
            {
                if (Ask-YesNo 'Atualizar a UI?')
                {
                    $uiPath = Join-Path $Target 'ui'
                    if ((Test-Path $uiPath) -and (Test-Command npm))
                    {
                        Reset-NpmArtifacts -projPath $uiPath
                        Npm-Install-And-Build -projPath $uiPath
                    }
                }
                if (Ask-YesNo 'Atualizar o Terminal (multiposto)?')
                {
                    $terminalPath = Join-Path $Target 'terminal'
                    if ((Test-Path $terminalPath) -and (Test-Command npm))
                    {
                        Reset-NpmArtifacts -projPath $terminalPath
                        Npm-Install-And-Build -projPath $terminalPath
                    }
                }
            }
            else
            {
                Write-Host "UI e Terminal ja vieram compilados no pacote de release - nada a compilar localmente."
            }

            Ensure-RemoteAdminFirewallRule
        }

        # Explorer caches shortcut icons aggressively; refreshing the general icon
        # cache (ie4uinit) is not enough for an unchanged .lnk. Rewriting the
        # shortcut (same target) plus SHChangeNotify makes Explorer re-read the
        # replaced favicon.ico without a reboot.
        try
        {
            $shortcutPath = "$env:USERPROFILE\Desktop\POS Ticket.lnk"
            if (Test-Path $shortcutPath)
            {
                $ws = New-Object -ComObject WScript.Shell
                $s = $ws.CreateShortcut($shortcutPath)
                $s.IconLocation = "$( Join-Path $Target 'favicon.ico' ),0"
                $s.Save()
            }

            Add-Type -Namespace Native -Name Shell -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, uint uFlags, System.IntPtr dwItem1, System.IntPtr dwItem2);
"@
            # SHCNE_ASSOCCHANGED (0x08000000): tells the shell that icons changed
            [Native.Shell]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)

            $ie4 = Join-Path $env:WINDIR 'System32\ie4uinit.exe'
            if (Test-Path $ie4)
            {
                & $ie4 -show 2>$null
            }
            Write-Host "Cache de icones atualizada."
        }
        catch
        {
            Write-Host "Nao foi possivel atualizar a cache de icones (o icone novo aparece apos reiniciar)."
        }

        Write-Host "Update concluido."
    }
    finally
    {
        Remove-Item -Recurse -Force $tmpRoot
    }
}
catch
{
    if (-not $Interactive)
    {
        throw
    }
    Write-Host ("ERRO: " + $_.Exception.Message)
    [void](Show-Choice -Title 'Atualizar POS Ticket' -Message ("A atualização falhou:`n`n" + $_.Exception.Message) -Options @('Fechar'))
    exit 1
}

if ($Interactive -and -not $DryRun)
{
    $choice = Show-Choice -Title 'Atualizar POS Ticket' `
        -Message "Atualização concluída (versão $fromVersion -> $toVersion)." `
        -Options @('Abrir o POS Ticket', 'Fechar')
    if ($choice -eq 0)
    {
        Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') `
            -ArgumentList "`"$( Join-Path $Target 'startup.launcher.vbs' )`"" -WorkingDirectory $Target
    }
}
else
{
    Pause
}
