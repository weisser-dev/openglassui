@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Bitte Node.js 20 oder neuer von https://nodejs.org/ installieren. & exit /b 1)
node -e "if(Math.sign(Number(process.versions.node.split('.')[0])-20)===-1)process.exit(1)" || (echo Node.js 20 oder neuer ist erforderlich. & exit /b 1)
call npm ci || exit /b 1
if not exist config.json copy config.example.json config.json >nul
where cloudflared >nul 2>nul && goto done
where winget >nul 2>nul || goto manual
set /p "answer=Cloudflare Quick Tunnel mit winget installieren? [y/N] "
if /i "%answer%"=="y" winget install --id Cloudflare.cloudflared --exact
if /i "%answer%"=="yes" winget install --id Cloudflare.cloudflared --exact
goto done
:manual
echo Optional cloudflared installieren: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
:done
echo Einrichtung abgeschlossen. Passe config.json an und starte mit npm start.
echo Falls cloudflared gerade installiert wurde, starte das Terminal neu.
