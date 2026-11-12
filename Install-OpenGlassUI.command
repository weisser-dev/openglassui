#!/bin/sh
# Double-click from Finder after downloading the repository. Dependencies and
# optional tunnel installation are handled by the same setup script as the CLI.
cd "$(dirname "$0")" || exit 1
if ./setup.sh; then
  printf '\n%s\n' 'Einrichtung abgeschlossen. Du kannst jetzt Start-OpenGlassUI.command öffnen.'
else
  printf '\n%s\n' 'Einrichtung fehlgeschlagen. Prüfe die Meldung oben.'
fi
printf '%s' 'Zum Schließen Enter drücken … '
read -r ignored
