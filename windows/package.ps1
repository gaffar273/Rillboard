$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $appRoot 'dist'
$names = @('Rillboard.exe', 'Open Drawing.cmd', 'Install Drawing.cmd', 'install.ps1', 'README.md', 'TEACHER.md', 'Connect Teacher.cmd', 'teacher-bridge', 'LICENSE', 'THIRD-PARTY-NOTICES.txt')
$files = @($names | ForEach-Object { Join-Path $dist $_ })
foreach ($file in $files) {
    if (!(Test-Path -LiteralPath $file)) { throw ('Missing Windows package file: ' + $file) }
}
$archive = Join-Path $dist 'Rillboard Windows.zip'
Compress-Archive -LiteralPath $files -DestinationPath $archive -CompressionLevel Optimal -Force
Copy-Item -LiteralPath $archive -Destination (Join-Path $appRoot 'Rillboard Windows.zip') -Force
Write-Output 'Packaged Windows executable, installer and shortcuts in Rillboard Windows.zip.'
