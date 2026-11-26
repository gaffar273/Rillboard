@echo off
setlocal
set "DRAWING_APP=%~dp0Rillboard.exe"
if not exist "%DRAWING_APP%" set "DRAWING_APP=%~dp0dist\Rillboard.exe"
if exist "%DRAWING_APP%" (
  start "" "%DRAWING_APP%"
  exit /b
)
echo The Windows app has not been built yet. Run npm.cmd run build in app.
pause
