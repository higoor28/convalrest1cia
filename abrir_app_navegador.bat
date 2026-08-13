@echo off
cd /d "%~dp0"
start "Servidor App Documentos" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar_localhost.ps1"
timeout /t 3 >nul
start "" "http://127.0.0.1:8770/app_navegador/index.html"
