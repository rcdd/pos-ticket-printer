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

$answer = Read-Host "Onde pretende instalar? (Enter para usar $defaultTarget)"
$Target = if ([string]::IsNullOrWhiteSpace($answer))
{
    $defaultTarget
}
else
{
    $answer.Trim()
}

if (Test-Path $Target)
{
    $existing = Get-ChildItem -Path $Target -Force -ErrorAction SilentlyContinue
    if ($existing)
    {
        throw "A pasta '$Target' ja existe e nao esta vazia. Escolha outra localizacao ou esvazie a pasta primeiro."
    }
}
else
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
    Expand-Archive -Path $zip -DestinationPath $Target -Force

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
