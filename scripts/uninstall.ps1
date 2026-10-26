<#
.SYNOPSIS
Remove docmap-desktop for the current user on Windows, without administrator rights.

.DESCRIPTION
Finds the NSIS installation (of scripts/build-install.ps1, the setup or the install line of a
release: all three are the same per-user setup) in the uninstall entries of the current user and
runs its uninstaller silently (/S). Your settings and your projects are not touched. A second run
finds nothing to do and says so; it is not an error.

.EXAMPLE
.\scripts\uninstall.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:CLAUDECODE) {
    throw 'uninstall.ps1: run this in a normal terminal, not in a Claude session (the app redirects AppData and the registry)'
}

# productName of src-tauri/tauri.conf.json is the DisplayName of the entry.
$entries = @(Get-ChildItem -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
        ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath } |
        Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -eq 'docmap-desktop' })
if ($entries.Count -eq 0) {
    Write-Output 'docmap-desktop is not installed for this user, nothing to do'
    return
}

foreach ($entry in $entries) {
    $uninstaller = ([string]$entry.UninstallString).Trim('"')
    if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        throw "uninstall.ps1: the uninstaller of the entry is gone ($uninstaller); remove docmap-desktop in Settings > Apps"
    }
    Write-Output "running the uninstaller silently ($uninstaller /S)"
    $proc = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "uninstall.ps1: the uninstaller failed with exit code $($proc.ExitCode)" }
    # An NSIS uninstaller copies itself to the temporary folder and runs from there, so its first process may end
    # before the work is done and its exit code says little: the entry going away is the answer.
    $deadline = (Get-Date).AddSeconds(60)
    while ((Test-Path -LiteralPath $entry.PSPath) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
    if (Test-Path -LiteralPath $entry.PSPath) {
        throw 'uninstall.ps1: the uninstaller ran, but docmap-desktop is still registered; remove it in Settings > Apps'
    }
}
Write-Output 'removed docmap-desktop'
