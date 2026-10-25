<#
.SYNOPSIS
Build docmap-desktop from this checkout and install it for the current user, from the terminal.

.DESCRIPTION
The way in for a machine where a downloaded setup may not be started (SmartScreen, a managed
workstation): the engine sidecar is staged the way .github/actions/engine-sidecar does it, the app
is built with `cargo tauri build --bundles nsis`, and the setup built here runs silently (/S, for
the current user: Tauri's installMode currentUser). A file built on this machine carries no
Mark-of-the-Web, so SmartScreen does not stop it; AppLocker or WDAC stay what they are.

The engine is the one of docmap.nvim's rolling release standalone-latest. It is downloaded once
into src-tauri\binaries and src-tauri\resources (both ignored by git); -RefreshEngine fetches it
again.

.PARAMETER BuildOnly
Build the app and its setup and stop (no install).

.PARAMETER RefreshEngine
Download the engine sidecar and its grammars again, although they are staged.

.EXAMPLE
.\scripts\build-install.ps1
.\scripts\build-install.ps1 -RefreshEngine
.\scripts\build-install.ps1 -BuildOnly
#>
[CmdletBinding()]
param(
    [switch] $BuildOnly,
    [switch] $RefreshEngine
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$triple = 'x86_64-pc-windows-msvc'
$engineBase = 'https://github.com/StefanBartl/docmap.nvim/releases/download/standalone-latest'

function Exit-Build([string] $Message) {
    throw "build-install.ps1: $Message"
}

function Invoke-Step([string] $Label, [scriptblock] $Body) {
    Write-Output "==> $Label"
    & $Body
    if ($LASTEXITCODE -ne 0) { Exit-Build "$Label failed (exit code $LASTEXITCODE)" }
}

if (-not $BuildOnly -and $env:CLAUDECODE) {
    Exit-Build 'install in a normal terminal, not in a Claude session (the app redirects AppData and the registry); -BuildOnly builds'
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { Exit-Build 'cargo is not on PATH' }
& cargo tauri --version *> $null
if ($LASTEXITCODE -ne 0) { Exit-Build 'no Tauri CLI: cargo install tauri-cli' }

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    # The engine where tauri.windows.conf.json expects it (externalBin binaries/docmap, resources/grammars).
    $sidecar = "src-tauri\binaries\docmap-$triple.exe"
    $grammars = 'src-tauri\resources\grammars'
    if ($RefreshEngine -or -not (Test-Path -LiteralPath $sidecar) -or -not (Test-Path -LiteralPath $grammars)) {
        Write-Output '==> engine: download standalone-latest of docmap.nvim'
        $dl = Join-Path ([IO.Path]::GetTempPath()) ('docmap-engine-' + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $dl | Out-Null
        try {
            $archive = Join-Path $dl "grammars-$triple.tar.gz"
            Invoke-WebRequest -UseBasicParsing -Uri "$engineBase/docmap-$triple.exe" -OutFile (Join-Path $dl "docmap-$triple.exe")
            Invoke-WebRequest -UseBasicParsing -Uri "$engineBase/grammars-$triple.tar.gz" -OutFile $archive
            New-Item -ItemType Directory -Force -Path 'src-tauri\binaries' | Out-Null
            if (Test-Path -LiteralPath $grammars) { Remove-Item -Recurse -Force -LiteralPath $grammars }
            New-Item -ItemType Directory -Force -Path $grammars | Out-Null
            Move-Item -Force -LiteralPath (Join-Path $dl "docmap-$triple.exe") -Destination $sidecar
            # tar.exe of Windows (bsdtar), not the GNU tar of Git Bash, which takes "C:\..." for a remote host.
            Invoke-Step 'engine: unpack the grammars' { & "$env:SystemRoot\System32\tar.exe" -xzf $archive -C $grammars }
        }
        finally {
            Remove-Item -Recurse -Force -LiteralPath $dl -ErrorAction SilentlyContinue
        }
    }

    Invoke-Step 'cargo tauri build --bundles nsis' { cargo tauri build --bundles nsis }

    $setup = @(Get-ChildItem -Path 'src-tauri\target\release\bundle\nsis' -Filter '*-setup.exe' |
            Sort-Object LastWriteTime -Descending)
    if ($setup.Count -eq 0) { Exit-Build 'the build made no setup in src-tauri\target\release\bundle\nsis' }
    $setup = $setup[0].FullName
    Write-Output "built $setup"
    if ($BuildOnly) { return }

    Write-Output '==> running the setup silently (/S)'
    $proc = Start-Process -FilePath $setup -ArgumentList '/S' -Wait -PassThru
    if ($proc.ExitCode -ne 0) { Exit-Build "the setup failed with exit code $($proc.ExitCode)" }
    Write-Output 'installed docmap-desktop'
}
finally {
    Pop-Location
}
