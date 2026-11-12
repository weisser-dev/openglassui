#!/bin/sh
cd "$(dirname "$0")" || exit 1
if [ ! -d node_modules ]; then
  printf '%s\n' 'Bitte zuerst Install-OpenGlassUI.command ausführen.'
  read -r ignored
  exit 1
fi
printf '%s\n' 'OpenGlassUI wird gestartet. Dieses Fenster muss geöffnet bleiben.'
printf '%s\n' 'Steuerzentrale: http://127.0.0.1:4173'
npm start
printf '%s' 'Zum Schließen Enter drücken … '
read -r ignored
