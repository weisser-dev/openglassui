#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  printf '%s\n' 'Bitte zuerst Node.js 20 oder neuer installieren: https://nodejs.org/'
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Node.js 20 oder neuer ist erforderlich."); process.exit(1) }'
npm ci
if [ ! -f config.json ]; then cp config.example.json config.json; fi
if ! command -v cloudflared >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1 && [ -t 0 ]; then
    printf '%s' 'Cloudflare Quick Tunnel mit Homebrew installieren? [y/N] '
    read -r answer
    case "$answer" in y|Y|yes|YES) brew install cloudflared ;; esac
  else
    printf '%s\n' 'Optional: cloudflared installieren: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/'
  fi
fi
printf '\n%s\n' 'Einrichtung abgeschlossen. Passe config.json an und starte mit npm start.'
printf '%s\n' 'Tunnel können anschließend in der lokalen Steuerzentrale gestartet werden.'
