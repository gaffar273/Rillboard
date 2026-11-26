param(
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\CraftSketchDesktop'),
    [string]$ShortcutDirectory,
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
try {
    $InstallDirectory = [IO.Path]::GetFullPath($InstallDirectory)
    $sourceExe = Join-Path $PSScriptRoot 'Rillboard.exe'
    if (!(Test-Path -LiteralPath $sourceExe -PathType Leaf)) {
        throw 'The drawing app is missing. Keep Install Drawing.cmd, install.ps1 and Rillboard.exe together.'
    }
    $destinationExe = Join-Path $InstallDirectory 'Rillboard.exe'
    # An update replaces program files only. Boards and history live in a separate profile.
    New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
    foreach ($name in @('Rillboard.exe', 'Install Drawing.cmd', 'install.ps1', 'README.md', 'TEACHER.md', 'Connect Teacher.cmd', 'LICENSE', 'THIRD-PARTY-NOTICES.txt')) {
        $source = Join-Path $PSScriptRoot $name
        if (!(Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $destination = Join-Path $InstallDirectory $name
        if ([IO.Path]::GetFullPath($source) -eq [IO.Path]::GetFullPath($destination)) { continue }
        try { Copy-Item -LiteralPath $source -Destination $destination -Force }
        catch { throw ('Could not update ' + $name + '. Close Rillboard and run the installer again. ' + $_.Exception.Message) }
    }
    $bridgeSource = Join-Path $PSScriptRoot 'teacher-bridge'
    $bridgeDestination = Join-Path $InstallDirectory 'teacher-bridge'
    if ((Test-Path -LiteralPath $bridgeSource) -and $bridgeSource -ne $bridgeDestination) {
        New-Item -ItemType Directory -Path $bridgeDestination -Force | Out-Null
        Get-ChildItem -LiteralPath $bridgeSource -File | Copy-Item -Destination $bridgeDestination -Force
    }
    if ((Get-FileHash -LiteralPath $sourceExe).Hash -ne (Get-FileHash -LiteralPath $destinationExe).Hash) {
        throw 'The installed app did not match the build. Please run the installer again.'
    }
    # Existing integrations can still open their original executable path.
    $previousExe = Join-Path $InstallDirectory 'Excalidraw Desktop.exe'
    if (Test-Path -LiteralPath $previousExe) { Copy-Item -LiteralPath $sourceExe -Destination $previousExe -Force }
    $shortcutFolders = if ($ShortcutDirectory) {
        @([IO.Path]::GetFullPath($ShortcutDirectory))
    } else {
        @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('Programs'))
    }
    $shell = New-Object -ComObject WScript.Shell
    foreach ($folder in ($shortcutFolders | Select-Object -Unique)) {
        if ([string]::IsNullOrWhiteSpace($folder)) { throw 'Windows could not locate your shortcuts folder.' }
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        $shortcut = $shell.CreateShortcut((Join-Path $folder 'Rillboard.lnk'))
        $shortcut.TargetPath = $destinationExe
        $shortcut.WorkingDirectory = $InstallDirectory
        $shortcut.IconLocation = $destinationExe + ',0'
        $shortcut.Description = 'Independent whiteboard with optional ChatGPT teaching'
        $shortcut.Save()
        $previousShortcut = Join-Path $folder 'Elixdraw Whiteboard.lnk'
        if ((Test-Path -LiteralPath $previousShortcut) -and ($shell.CreateShortcut($previousShortcut).TargetPath -eq $previousExe)) { Remove-Item -LiteralPath $previousShortcut }
    }
    Write-Output ('Installed Rillboard: ' + $destinationExe)
    Write-Output 'Open Rillboard from your shortcut to draw. Your existing boards and history are preserved.'
    if (!$NoLaunch) { Start-Process -FilePath $destinationExe }
} catch {
    Write-Error ('Installation failed: ' + $_.Exception.Message) -ErrorAction Continue
    exit 1
}
