$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$checkRoot = Join-Path $appRoot 'qa\pressure-zoom-check'
New-Item -ItemType Directory -Path $checkRoot -Force | Out-Null
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
Copy-Item -LiteralPath (Join-Path $appRoot 'dist\Rillboard.exe') -Destination (Join-Path $checkRoot 'Rillboard.exe') -Force
$checkExe = Join-Path $checkRoot 'DesktopCheck.exe'
& $compilerPath /nologo /target:exe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll ('/reference:' + (Join-Path $checkRoot 'Rillboard.exe')) ('/out:' + $checkExe) (Join-Path $PSScriptRoot 'PressureZoomVerify.cs')
if ($LASTEXITCODE -ne 0) { throw 'Desktop verification compilation failed.' }
$runFolder = Join-Path $checkRoot (Get-Date -Format 'yyyyMMdd-HHmmss')
& $checkExe $runFolder
if ($LASTEXITCODE -ne 0) { throw ('Desktop verification failed. Report: ' + $runFolder) }
