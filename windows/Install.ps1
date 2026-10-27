$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'QuickNote'
$source = Join-Path $PSScriptRoot 'app'
if (!(Test-Path (Join-Path $source 'index.html'))) { throw 'Missing app files. Extract the entire ZIP before running Install.cmd.' }
$edgePaths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe")
if (!($edgePaths | Where-Object { Test-Path $_ })) { throw 'Install Microsoft Edge first.' }
$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('Desktop'))) {
    $existingLink = Join-Path $folder 'QuickNote.lnk'
    if (Test-Path $existingLink) {
        $existing = $shell.CreateShortcut($existingLink)
        if ($existing.TargetPath -ne (Join-Path $installDir 'QuickNote.exe')) { throw 'A different QuickNote shortcut already exists. Rename it before installing.' }
    }
}
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$tempExe = Join-Path ([IO.Path]::GetTempPath()) ('QuickNote-' + [Guid]::NewGuid().ToString() + '.exe')
try {
    Add-Type -TypeDefinition (Get-Content -Raw (Join-Path $PSScriptRoot 'QuickNote.cs')) -ReferencedAssemblies System.dll,System.Core.dll,System.Windows.Forms.dll -OutputAssembly $tempExe -OutputType WindowsApplication
    # Stop only this installation's host before replacing its files. Edge notes stay open.
    Get-Process -Name QuickNote -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq (Join-Path $installDir 'QuickNote.exe') } | Stop-Process
    Copy-Item $tempExe (Join-Path $installDir 'QuickNote.exe') -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $installDir 'app') | Out-Null
    Copy-Item (Join-Path $source '*') (Join-Path $installDir 'app') -Recurse -Force
    Copy-Item (Join-Path $PSScriptRoot 'Disable-Autostart.ps1') $installDir -Force
    Copy-Item (Join-Path $PSScriptRoot 'Disable-Autostart.cmd') $installDir -Force
    $shell = New-Object -ComObject WScript.Shell
    foreach ($folder in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('Desktop'))) {
        $link = $shell.CreateShortcut((Join-Path $folder 'QuickNote.lnk'))
        $link.TargetPath = Join-Path $installDir 'QuickNote.exe'
        $link.WorkingDirectory = $installDir
        $link.Description = 'QuickNote sticky note'
        $link.Save()
    }
    Start-Process (Join-Path $installDir 'QuickNote.exe')
    Write-Host 'Installed. QuickNote will open automatically at Windows sign-in.'
    Write-Host 'To disable auto-start, run Disable-Autostart.cmd.'
} finally {
    Remove-Item $tempExe -Force -ErrorAction SilentlyContinue
}
