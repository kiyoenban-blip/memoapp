$ErrorActionPreference = 'Stop'
$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'QuickNote.lnk'
if (Test-Path $link) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($link)
    $expected = Join-Path $env:LOCALAPPDATA 'QuickNote\QuickNote.exe'
    if ($shortcut.TargetPath -ne $expected) { throw 'This shortcut belongs to another installation. It was not changed.' }
    Remove-Item $link
}
Write-Host 'Auto-start disabled. Your notes and desktop shortcut are unchanged.'
