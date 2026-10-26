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
again. Like the CI it trusts that release over HTTPS: the release publishes no checksums to compare.

.PARAMETER BuildOnly
Build the app and its setup and stop (no install).

.PARAMETER RefreshEngine
Download the engine sidecar and its grammars again, although they are staged.

.PARAMETER AllowElevated
Install although the session is elevated (for a build machine).

.EXAMPLE
.\scripts\build-install.ps1
.\scripts\build-install.ps1 -RefreshEngine
.\scripts\build-install.ps1 -BuildOnly
#>
[CmdletBinding()]
param(
    [switch] $BuildOnly,
    [switch] $RefreshEngine,
    [switch] $AllowElevated
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$triple = 'x86_64-pc-windows-msvc'
$engineBase = 'https://github.com/WKDSteve/docmap.nvim/releases/download/standalone-latest'

function Exit-Build([string] $Message) {
    throw "build-install.ps1: $Message"
}

function Invoke-Step([string] $Label, [scriptblock] $Body) {
    Write-Output "==> $Label"
    & $Body
    if ($LASTEXITCODE -ne 0) { Exit-Build "$Label failed (exit code $LASTEXITCODE)" }
}

if (-not $BuildOnly) {
    if ($env:CLAUDECODE) {
        Exit-Build 'install in a normal terminal, not in a Claude session (the app redirects AppData and the registry); -BuildOnly builds'
    }
    # The setup installs into the profile of the account that runs it: elevated, that may be the administrator's.
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $AllowElevated -and $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Exit-Build 'do not run this elevated: it installs for one user (-AllowElevated for a build machine)'
    }
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { Exit-Build 'cargo is not on PATH' }
# Windows PowerShell 5.1 turns redirected native stderr into an error record, which 'Stop' would throw
# instead of the message below ("no such command: tauri" is written to stderr).
$tauri = $false
try {
    & cargo tauri --version *> $null
    $tauri = $LASTEXITCODE -eq 0
}
catch {
    $tauri = $false
}
if (-not $tauri) { Exit-Build 'no Tauri CLI: cargo install tauri-cli --version ^2 --locked' }

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    # The engine where tauri.windows.conf.json expects it (externalBin binaries/docmap, resources/grammars).
    $sidecar = "src-tauri\binaries\docmap-$triple.exe"
    $grammars = 'src-tauri\resources\grammars'
    $staged = (Test-Path -LiteralPath $sidecar -PathType Leaf) -and
        (Test-Path -LiteralPath $grammars -PathType Container) -and
        @(Get-ChildItem -LiteralPath $grammars -Force).Count -gt 0
    if ($RefreshEngine -or -not $staged) {
        Write-Output '==> engine: download standalone-latest of docmap.nvim'
        $dl = Join-Path ([IO.Path]::GetTempPath()) ('docmap-engine-' + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $dl | Out-Null
        try {
            # Everything is fetched and unpacked in the temporary folder first: a download or an archive that
            # fails leaves the staged engine as it was, never half replaced.
            $exe = Join-Path $dl "docmap-$triple.exe"
            $archive = Join-Path $dl "grammars-$triple.tar.gz"
            $unpacked = Join-Path $dl 'grammars'
            Invoke-WebRequest -UseBasicParsing -Uri "$engineBase/docmap-$triple.exe" -OutFile $exe
            Invoke-WebRequest -UseBasicParsing -Uri "$engineBase/grammars-$triple.tar.gz" -OutFile $archive
            New-Item -ItemType Directory -Path $unpacked | Out-Null
            # tar.exe of Windows (bsdtar), not the GNU tar of Git Bash, which takes "C:\..." for a remote host.
            Invoke-Step 'engine: unpack the grammars' { & "$env:SystemRoot\System32\tar.exe" -xzf $archive -C $unpacked }
            if (@(Get-ChildItem -LiteralPath $unpacked -Force).Count -eq 0) { Exit-Build 'the grammar archive is empty' }

            New-Item -ItemType Directory -Force -Path 'src-tauri\binaries', 'src-tauri\resources' | Out-Null
            if (Test-Path -LiteralPath $grammars) { Remove-Item -Recurse -Force -LiteralPath $grammars }
            Move-Item -LiteralPath $unpacked -Destination $grammars
            Move-Item -Force -LiteralPath $exe -Destination $sidecar
        }
        finally {
            Remove-Item -Recurse -Force -LiteralPath $dl -ErrorAction SilentlyContinue
        }
    }

    Invoke-Step 'cargo tauri build --bundles nsis' { cargo tauri build --bundles nsis }

    # cargo leaves a program that is up to date untouched; the build ran on these sources, so its time is now
    # (otherwise a commit that does not change the binary, engine.lock for one, keeps it "stale" for :MyNative).
    $program = 'src-tauri\target\release\docmap-desktop.exe'
    if (-not (Test-Path -LiteralPath $program -PathType Leaf)) { Exit-Build "the build made no $program" }
    (Get-Item -LiteralPath $program).LastWriteTime = Get-Date

    # The setup of this version, not the newest file of the folder (older versions stay there).
    $version = (Get-Content -LiteralPath 'src-tauri\tauri.conf.json' -Raw | ConvertFrom-Json).version
    $setup = Join-Path $root "src-tauri\target\release\bundle\nsis\docmap-desktop_${version}_x64-setup.exe"
    if (-not (Test-Path -LiteralPath $setup -PathType Leaf)) { Exit-Build "the build made no setup $setup" }
    Write-Output "built $setup"
    if ($BuildOnly) { return }

    Write-Output '==> running the setup silently (/S)'
    $proc = Start-Process -FilePath $setup -ArgumentList '/S' -Wait -PassThru
    if ($proc.ExitCode -ne 0) { Exit-Build "the setup failed with exit code $($proc.ExitCode)" }
    Write-Output "installed docmap-desktop $version"
}
finally {
    Pop-Location
}
