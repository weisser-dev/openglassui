#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  printf '%s\n' 'Bitte zuerst Node.js 20 oder neuer installieren: https://nodejs.org/'
  exit 1
fi
npm ci
if [ ! -f config.json ]; then cp config.example.json config.json; fi
printf '\n%s\n' 'Einrichtung abgeschlossen. Bearbeite bei Bedarf config.json und starte mit npm start.'
printf '%s\n' 'Für die Brille wird zusätzlich ein HTTPS-Tunnel benötigt; siehe README.md.'
