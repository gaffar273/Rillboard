@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 18 or newer first.
  pause
  exit /b 1
)
codex mcp add elixdraw-teacher -- node "%~dp0teacher-bridge\server.cjs"
if errorlevel 1 (
  echo Use the desktop MCP settings described in TEACHER.md.
) else (
  echo Teacher tools registered. Restart the MCP connection or open a new chat.
)
pause
