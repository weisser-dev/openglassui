# OpenGlassUI

Eine zentrale Steuerung für Coding-Agenten auf dem eigenen Rechner – mit dem Ziel, Aufgaben später über Meta Ray-Ban Display per Sprache und Gesten zu bedienen. Agenten werden lokal konfiguriert; das Konzept ist offen für weitere CLI-Tools.

## Aktueller Stand: lokaler Prototyp

Die Oberfläche kann neue Aufgaben an konfigurierte CLI-Agenten senden, deren rohe Ausgabe anzeigen und Prozesse stoppen. Codex, Claude Code und Kiro sind als Beispiele vorkonfiguriert; Voraussetzung sind die jeweilige lokale Installation, Anmeldung und kompatible CLI-Version. Andere Programme lassen sich über die Konfiguration ergänzen, sofern sie die Anweisung über Standard-Eingabe akzeptieren. Die Tools behalten ihre eigenen Berechtigungs- und Sicherheitsregeln. Interaktive Freigaben werden noch nicht unterstützt.

**Noch nicht implementiert:** Installer, QR-Kopplung, Fernzugriff, Brillen-Web-App, Gesten, Sprache, bestehende Sitzungen und Folgeanweisungen, dauerhafte Speicherung sowie aufbereitete Agentenausgaben. Die aktuelle Oberfläche ist ausschließlich auf dem Rechner unter `127.0.0.1` erreichbar. Ein QR-Code allein würde keine sichere Verbindung zu diesem lokalen Dienst herstellen.

## Start

Voraussetzung: Node.js 20 oder neuer und mindestens ein installiertes, angemeldetes Agenten-CLI.

```sh
cp config.example.json config.json
npm start
```

Öffne [http://127.0.0.1:4173](http://127.0.0.1:4173). In `config.json` legt `workspace` das Arbeitsverzeichnis fest; ein relativer Pfad bezieht sich auf den Speicherort der Konfiguration. Unter `agents` lassen sich Agenten hinzufügen oder deren ausführbare Programme und Argumente ändern. `input` muss derzeit `stdin` sein. Die Datei bleibt lokal und wird nicht ins Repository aufgenommen. Ohne `config.json` werden die Beispieleinstellungen verwendet.

Die Aufgaben und Ausgaben liegen nur im Arbeitsspeicher und gehen beim Neustart verloren. Prozesse werden ohne Shell gestartet. Das Stoppen sendet SIGTERM an den gestarteten Prozess; ob auch seine Kindprozesse beendet werden, hängt vom jeweiligen Tool ab. Der Prototyp ist nicht für die Freigabe im Netzwerk ausgelegt.

## Geplanter Ausbau

1. Lokalen Begleiter mit Einrichtung, Agentenprüfung und Auswahl von Projekten entwickeln.
2. Sichere, authentifizierte Kopplung per QR-Code und einen geeigneten verschlüsselten Verbindungskanal zur Brille entwickeln. Die Brillen-Web-App benötigt eine öffentlich erreichbare HTTPS-Adresse; lokale Dienstzugänge dürfen dabei nicht öffentlich werden.
3. Brillenansicht für das Display und Navigation per Armband umsetzen; Sprachbedienung über WebMCP prüfen. Verfügbarkeit und Freischaltung müssen auf dem Gerät bestätigt werden.
4. Agenten über spezifische Adapter anbinden, um strukturierte Ereignisse, Sitzungsverlauf und Freigaben zu unterstützen. Eine gespeicherte Sitzung fortzusetzen bedeutet nicht automatisch, eine bereits laufende Sitzung übernehmen zu können.
5. Installer und unterstützte Plattformen ergänzen.

## Referenzen

- [Meta Wearables Web App AI Toolkit](https://github.com/meta/meta-wearables-webapp)
- [Meta WebMCP-Beispiele](https://github.com/meta/meta_glasses_webmcp)
- [Meta Glass Display WebKit Harness](https://github.com/Tienduyvo/meta-glass-display-webkit-harness) – Referenz für eine separate WhatsApp-zu-Claude-Brücke.
- [Codex als Plattform](https://developers.openai.com/blog/codex-as-a-platform), [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/cli-usage), [Kiro CLI Headless](https://kiro.dev/docs/cli/headless/)
