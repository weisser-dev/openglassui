@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Bitte zuerst setup.bat ausfuehren.
  pause
  exit /b 1
)
echo OpenGlassUI wird gestartet. Dieses Fenster muss geoeffnet bleiben.
echo Steuerzentrale: http://127.0.0.1:4173
call npm start
pause
