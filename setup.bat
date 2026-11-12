@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Bitte Node.js 20 oder neuer von https://nodejs.org/ installieren. & exit /b 1)
call npm ci || exit /b 1
if not exist config.json copy config.example.json config.json >nul
echo Einrichtung abgeschlossen. Passe config.json an und starte mit npm start.
