$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compilerPath)) { throw '.NET Framework 4.8 is required to build the Windows app.' }
$loaderPath = Join-Path $PSScriptRoot 'vendor\WebView2Loader.dll'
if (!(Test-Path -LiteralPath $loaderPath)) { throw 'Missing Windows WebView2 loader in windows/vendor/.' }
$signature = Get-AuthenticodeSignature -LiteralPath $loaderPath
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notlike '*Microsoft Corporation*') { throw 'WebView2 loader must have a valid Microsoft signature.' }
Add-Type -AssemblyName System.Drawing
$iconPath = Join-Path $PSScriptRoot 'icon.ico'
$bitmap = New-Object System.Drawing.Bitmap 64,64
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(18,28,48))
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White),4
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$pen.StartCap = [Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
$pen.Width = 6
$graphics.DrawBezier($pen,14,41,26,41,24,18,41,18)
$graphics.DrawLine($pen,41,18,49,18)
$graphics.DrawBezier($pen,16,50,31,50,30,28,46,28)
$pen.Color = [Drawing.Color]::FromArgb(160,191,255)
$graphics.DrawLine($pen,37,46,49,46)
$nativeIcon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconFile = [IO.File]::Create($iconPath)
$nativeIcon.Save($iconFile)
$iconFile.Dispose(); $nativeIcon.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
$resources = @('styles.css','india-boundary.js','perfect-freehand.js','shapes.js','geometry.js','device-storage.js','workspace-store.js','board-pdf.js','app.js','plugins.js','teacher.css','teacher-core.js','teacher-store.js','teacher.js','icon.svg') | ForEach-Object { '/resource:' + (Join-Path $appRoot $_) + ',Assets.' + $_ }
$resources += @('fonts/geist.woff2','fonts/instrument-serif-italic.woff2') | ForEach-Object { '/resource:' + (Join-Path $appRoot $_) + ',Assets.' + $_ }
$resources += @('server.cjs','client.cjs') | ForEach-Object { '/resource:' + (Join-Path $appRoot ('teacher-bridge\' + $_)) + ',Plugin.' + $_ }
$resources += '/resource:' + (Join-Path $appRoot 'drawing.html') + ',Assets.index.html'
$outputPath = Join-Path $appRoot 'dist\Rillboard.exe'
$arguments = @('/nologo','/target:winexe','/platform:x64','/optimize+','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Web.Extensions.dll',('/win32icon:' + $iconPath),('/win32manifest:' + (Join-Path $PSScriptRoot 'app.manifest')),('/out:' + $outputPath),('/resource:' + $loaderPath + ',Assets.WebView2Loader.dll')) + $resources + @((Join-Path $PSScriptRoot 'Desktop.cs'))
& $compilerPath @arguments
if ($LASTEXITCODE -ne 0) { throw 'Windows application compilation failed.' }
Copy-Item -LiteralPath $outputPath -Destination (Join-Path $appRoot 'Rillboard.exe') -Force
if (Test-Path -LiteralPath (Join-Path $appRoot 'Excalidraw Desktop.exe')) { Copy-Item -LiteralPath $outputPath -Destination (Join-Path $appRoot 'Excalidraw Desktop.exe') -Force }
# Refresh existing launchers in the original Elixdraw source layout.
if ($appRoot -eq 'C:\app\elixdraw\app') {
    foreach ($name in @('Rillboard.exe', 'Elixdraw Whiteboard.exe')) {
        Copy-Item -LiteralPath $outputPath -Destination (Join-Path (Split-Path -Parent $appRoot) $name) -Force
    }
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.txt') -Destination (Join-Path $appRoot 'dist\THIRD-PARTY-NOTICES.txt') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.txt') -Destination (Join-Path $appRoot 'THIRD-PARTY-NOTICES.txt') -Force
Write-Output 'Built standalone x64 Windows executable with embedded offline drawing assets.'
