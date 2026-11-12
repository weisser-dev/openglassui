# OpenGlassUI

OpenGlassUI ist eine lokale Steuerzentrale für Coding-Agenten mit einer experimentellen Web-App für Meta Ray-Ban Display. Agenten und Projektverzeichnis werden auf dem eigenen Rechner konfiguriert; auf der Brille lassen sich Aufgaben anzeigen, starten und stoppen. Codex und Claude Code verfügen über eigene Adapter für Sitzungen und Rückfragen. Sie können Sitzungen des konfigurierten Projekts anzeigen und abgeschlossene Sitzungen fortsetzen. Weitere CLIs können über die Konfiguration angebunden werden.

## Einrichtung

Voraussetzungen: Node.js 20 oder neuer und mindestens ein installiertes, angemeldetes CLI. Auf macOS/Linux im Projektordner `./setup.sh`, unter Windows `setup.bat` ausführen. Das installiert die Abhängigkeiten und erstellt `config.json`, sofern sie noch nicht existiert.

In `config.json` das `workspace`-Verzeichnis und die gewünschten `agents` einstellen. Relative Projektpfade beziehen sich auf das Verzeichnis der Konfigurationsdatei. Die mitgelieferten Beispiele setzen die jeweiligen CLIs im `PATH` voraus. Für zusätzliche Tools `id`, `name`, `command`, `args` und `input: "stdin"` festlegen; die Aufgabe wird auf Standard-Eingabe übergeben. `resumeArgs` ist optional; `{sessionId}` wird durch eine vom jeweiligen Adapter erkannte Sitzungs-ID ersetzt. Die Beispieldatei enthält Vorlagen für Codex, Claude Code und Kiro CLI. Codex nutzt den lokalen `codex app-server`; Claude nutzt das offizielle Claude Agent SDK. Dessen Authentifizierung und Nutzungsbedingungen müssen auf dem Rechner erfüllt sein. Konfiguration und Authentifizierung der Agenten selbst erfolgen weiterhin bei den jeweiligen Tools.

```sh
npm start
```

Die lokale Steuerzentrale ist unter [http://127.0.0.1:4173](http://127.0.0.1:4173) erreichbar. `PORT` und `OPENGLASS_CONFIG` können bei Bedarf gesetzt werden. Aufgaben und Ausgaben werden im lokalen, git-ignorierten Verzeichnis `.openglass/` gespeichert; ein Neustart markiert noch laufende Aufgaben als unterbrochen.

## Brille verbinden – experimentell

1. In Meta AI auf dem iPhone den Entwicklermodus für Web-Apps aktivieren.
2. Einen HTTPS-Tunnel zum lokalen Server starten, z. B. nach Installation von `cloudflared` mit `cloudflared tunnel --url http://127.0.0.1:4173`. Die [Quick-Tunnel-Dokumentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) beschreibt Voraussetzungen und Einschränkungen. Quick Tunnels sind nur für Entwicklung gedacht; ihre URL ändert sich beim Neustart.
3. Die ausgegebene HTTPS-Adresse in der lokalen Steuerzentrale eingeben und einen QR-Code erzeugen.
4. QR-Code mit dem **iPhone** scannen, die Web-App in der Meta AI App hinzufügen und anschließend auf der Brille öffnen. Der Code ist fünf Minuten gültig und einmal verwendbar; er muss beim ersten Öffnen der App auf der Brille noch gültig sein. Für eine erneute Kopplung einen neuen Code erzeugen und die App erneut hinzufügen.
5. Per Armband bzw. Richtungstasten und Auswählen navigieren. Texteingabe und Diktat hängen von der Eingabefunktion der Brille ab. Meta AI kann bei verfügbarer WebMCP-Funktion Werkzeuge für Anzeigen, Starten, Fortsetzen und Stoppen aufrufen; die Gerätefreigabe und tatsächliche Ausführung sind noch nicht auf Hardware verifiziert.

**Wichtig:** Der QR-Code enthält ein einmaliges Zugangsticket. Wer ihn vor der Brille einlöst, erhält Zugriff auf deine Agenten und deren Ausgaben. Nicht teilen; nach Verdacht in der lokalen Oberfläche „Alle Verbindungen trennen“ wählen. Die Verbindungstoken gelten bis zum Widerruf oder Neustart des Servers und werden auf dem verbundenen Gerät gespeichert. Der Dienst selbst lauscht nur auf localhost. Die Zugriffskontrolle setzt für Fernzugriff einen korrekt konfigurierten HTTPS-Reverse-Proxy voraus, der `X-Forwarded-For` oder `CF-Connecting-IP` setzt; den Dienst nicht direkt öffentlich verfügbar machen. Das ist ein experimenteller Einzelbenutzer-Prototyp, kein gehärteter Mehrbenutzer-Dienst.

## Grenzen

- Brillen-Darstellung, Deep-Link, WebMCP, Eingabe und Gesten wurden noch nicht auf einem echten Gerät geprüft. WebMCP kann je nach Konto, Region und Gerätefreigabe fehlen.
- Ein öffentlicher HTTPS-Tunnel muss separat eingerichtet und aktiv gehalten werden. Der QR-Code richtet den Tunnel nicht selbst ein. Kein signierter System-Installer ist enthalten.
- Codex und Claude können Rückfragen und einzelne Werkzeug-Freigaben an die Oberfläche weiterreichen. Andere Agenten laufen weiterhin als nichtinteraktive CLI-Prozesse ohne interaktive Freigaben. Berechtigungen werden nicht automatisch umgangen.
- Der Sitzungsbrowser zeigt bis zu 50 Sitzungen des konfigurierten Projekts pro Agent. Das Weiterführen einer bereits anderswo laufenden Sitzung ist nicht zuverlässig unterstützt; öffne zum Fortsetzen nur abgeschlossene Sitzungen. Kiro und eigene Adapter unterstützen derzeit keinen Sitzungs-Resume.
- Historische Sitzungen werden als Text angezeigt, bei unbekannten Formaten als JSON. Bei anderen Agenten sind Ausgaben rohe CLI-Ausgaben. Das Stoppen sendet SIGTERM an den gestarteten Prozess; Kindprozesse werden je nach Tool möglicherweise nicht beendet.
- Ein verbundenes Gerät hat Zugriff auf alle Aufgaben und kann konfigurierte Agenten im festgelegten Projekt starten. Zugangstoken sind nicht gerätegebunden und nicht verschlüsselt gespeichert; nur auf vertrauenswürdigen Geräten verwenden.

## Tests

`npm test` prüft den lokalen Start mit einem Test-Agenten, die Kopplung, den einmaligen Code, den Widerruf und simulierte Entscheidungsabläufe für Codex und Claude. Die Tests ersetzen keinen End-to-End-Test mit echten Agenten und Brille.

## Referenzen

[Meta Wearables Web App AI Toolkit](https://github.com/meta/meta-wearables-webapp) · [Meta WebMCP-Beispiele](https://github.com/meta/meta_glasses_webmcp) · [Meta Glass Display WebKit Harness](https://github.com/Tienduyvo/meta-glass-display-webkit-harness) · [Codex](https://developers.openai.com/blog/codex-as-a-platform) · [Claude Code](https://docs.anthropic.com/en/docs/claude-code/cli-usage) · [Kiro CLI](https://kiro.dev/docs/cli/headless/)

## Entscheidungen auf der Brille

Bei neuen Codex- und Claude-Aufgaben wird der Agent angewiesen, für inhaltliche Entscheidungen kurze Auswahlvorschläge aus dem bisherigen Kontext zu machen. Für Codex aktiviert OpenGlassUI dazu `default_mode_request_user_input`, eine experimentelle Codex-Funktion; sie kann sich bei einer anderen Codex-Version ändern. Ob eine Frage als Auswahl erscheint, hängt vom Agenten und Modell ab. Native Auswahloptionen und eigene Texteingabe werden unterstützt; Mehrfachauswahl und mehrere gleichzeitig offene Rückfragen werden noch nicht vollständig unterstützt. Zusätzliche parallele Freigaben werden vorsichtshalber abgelehnt. Bei bestehenden Sitzungen wird das ursprüngliche Codex-Entwicklerinstruktionsfeld nicht überschrieben.

Bei Tool-Freigaben werden Toolname und verfügbare Details gezeigt. „Einmal erlauben“ gilt nur für die konkrete Anfrage; es wird keine dauerhafte Regel angelegt. Unbekannte Codex-Anfragetypen werden nicht automatisch bestätigt. Die tatsächliche Darstellung, Texteingabe und Navigation auf der Brille müssen noch auf dem Gerät getestet werden.

## Selbsttest

Ein lokaler End-to-End-Test bestätigte Codex-Aufgabe, Fortsetzung und die Auswahl einer echten Codex-Rückfrage. Claude konnte auf dem Testrechner wegen einer abgelaufenen OAuth-Anmeldung nicht ausgeführt werden; nach erneuter Anmeldung muss dieser Ablauf noch getestet werden. Brillenverbindung, Armband und WebMCP sind nicht auf echter Hardware geprüft.
