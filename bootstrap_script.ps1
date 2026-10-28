#Requires -RunAsAdministrator
# Fetched and executed in-memory by bootstrap.bat via iex(DownloadString(...)).
# Job: ask where to install, download the pre-built release package (the same
# one update_script.ps1 uses via /download), extract it there, then hand off
# to install_script.ps1 for the actual dependency/service setup.
#
# NOTE: canonical copy lives in the main pos-ticket-printer repo, next to
# install_script.ps1/update_script.ps1. If you change it, also copy it (and
# bootstrap.bat) to pos-ticket-printer-website's repo, which serves both as
# static files at pos.rubendomingues.pt.
$ErrorActionPreference = 'Stop'

$ReleaseUrl = if ($env:RELEASE_URL)
{
    $env:RELEASE_URL
}
else
{
    'https://pos.rubendomingues.pt/download'
}
$defaultTarget = 'C:\POS-Ticket'

Write-Host ""
Write-Host "=== Instalador POS Ticket ===" -ForegroundColor Cyan
Write-Host ""

# Kiosk machines often have only a touchscreen, so the install location is
# chosen with buttons and the Windows folder picker instead of typing a path.
# Kept ASCII-only: this file is run through iex(DownloadString(...)), which
# doesn't reliably decode accented characters.
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

function Show-Choice
{
    param([string]$Message, [string[]]$Options)

    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Instalador POS Ticket'
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

$Target = $null
while (-not $Target)
{
    $choice = Show-Choice -Message 'Onde pretende instalar o POS Ticket?' `
        -Options @("Instalar em $defaultTarget (recomendado)", 'Escolher outra pasta...', 'Cancelar')
    switch ($choice)
    {
        0 {
            $Target = $defaultTarget
        }
        1 {
            $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
            $dialog.Description = 'Escolha uma pasta vazia para instalar o POS Ticket'
            $dialog.ShowNewFolderButton = $true
            $owner = New-Object System.Windows.Forms.Form
            $owner.TopMost = $true
            if ($dialog.ShowDialog($owner) -eq 'OK')
            {
                $Target = $dialog.SelectedPath
            }
        }
        default {
            Write-Host "Instalacao cancelada."
            return
        }
    }

    if ($Target -and (Test-Path $Target) -and (Get-ChildItem -Path $Target -Force -ErrorAction SilentlyContinue))
    {
        [void](Show-Choice -Message "A pasta '$Target' ja existe e nao esta vazia. Escolha outra pasta ou esvazie-a primeiro." -Options @('Voltar'))
        $Target = $null
    }
}

if (-not (Test-Path $Target))
{
    New-Item -ItemType Directory -Path $Target | Out-Null
}

try
{
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}
catch
{
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("posinstall_" + [IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tmp | Out-Null
$zip = Join-Path $tmp 'pos-ticket.zip'

try
{
    Write-Host "A descarregar o pacote de instalacao ($ReleaseUrl)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $zip

    Write-Host "A extrair para $Target ..." -ForegroundColor Cyan
    # ZipFile is much faster than Expand-Archive on Windows PowerShell 5.1,
    # and the package ships api\node_modules (thousands of files). $Target
    # is known to be empty at this point, which ExtractToDirectory requires.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $Target)

    if (-not (Test-Path (Join-Path $Target 'install_script.ps1')))
    {
        throw "Pacote de instalacao com estrutura inesperada (falta install_script.ps1 em $Target)."
    }
}
finally
{
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "A iniciar a instalacao em $Target ..." -ForegroundColor Cyan
Push-Location $Target
try
{
    & (Join-Path $Target 'install_script.ps1')
}
finally
{
    Pop-Location
}
