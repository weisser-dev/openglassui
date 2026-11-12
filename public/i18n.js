// English is the source language. Translations cover the setup flow; the rest of
// the interface is still being migrated and must not translate user content.
(() => {
 const de={
  'AGENTS':'AGENTEN','PROJECTS':'PROJEKTE','CONNECTION':'VERBINDUNG','GLASSES':'BRILLE','FINISH':'ABSCHLUSS',
  'Your agents.\nYour setup.':'Deine Agenten.\nDein Setup.','Everything in\none place.':'Alles an einem\nOrt.','Your connection.\nYour choice.':'Deine Verbindung.\nDeine Wahl.','Scan once.\nConnect.':'Einmal scannen.\nVerbunden.','Ready for\nyour workflow.':'Bereit für\ndeinen Workflow.',
  'Choose your coding agent. OpenGlassUI checks whether its executable is available on this computer.':'Wähle deinen Coding-Agenten. OpenGlassUI prüft, ob sein Programm verfügbar ist.',
  'Authentication and permissions are managed by each provider.':'Anmeldung und Berechtigungen verwaltet der jeweilige Anbieter.',
  'Choose an approved project or search your agent’s existing sessions.':'Wähle ein freigegebenes Projekt oder suche vorhandene Sitzungen deines Agenten.',
  'Only approved projects are available on paired devices.':'Nur freigegebene Projekte sind auf gekoppelten Geräten auswählbar.',
  'Start an installed provider or enter an existing HTTPS address.':'Starte einen installierten Anbieter oder trage eine bestehende HTTPS-Adresse ein.',
  'For Tailscale Serve, the devices need access to your tailnet.':'Für Tailscale Serve benötigen die Geräte Zugriff auf dein Tailnet.',
  'Generate the QR code and add the web app through Meta AI on your iPhone.':'Erzeuge den QR-Code und füge die Web-App über Meta AI auf deinem iPhone hinzu.',
  'The code is single-use and expires in five minutes. Treat it like a password.':'Der Code ist einmal verwendbar und fünf Minuten gültig. Behandle ihn wie ein Passwort.',
  'Open the app on your glasses and verify connectivity and controls.':'Öffne die App auf der Brille und prüfe Verbindung und Bedienung.',
  'Device connectivity and gestures must be tested on your glasses.':'Gerätezugriff und Gesten müssen auf deiner Brille getestet werden.',
  'PROJECT':'PROJEKT','AGENT':'AGENT','Project name':'Projektname','Absolute project path':'Absoluter Projektpfad','Add project':'Projekt hinzufügen','Find existing projects':'Bestehende Projekte suchen','Searching …':'Suche läuft …','No accessible projects found.':'Keine erreichbaren Projekte gefunden.',
  'Start connection':'Verbindung starten','Or enter an existing HTTPS address:':'Oder vorhandene HTTPS-Adresse eintragen:','The provider must be installed and signed in.':'Der Anbieter muss installiert und angemeldet sein.',
  'No pairing code generated yet.':'Noch kein Kopplungscode erstellt.','Generate QR code':'QR-Code erzeugen','Open installation link':'Installationslink öffnen','Check pairing':'Kopplung prüfen',
  'A displayed QR code does not confirm pairing. Open the app on your device, then check pairing.':'Ein angezeigter QR-Code bestätigt die Kopplung noch nicht. Öffne die App auf deinem Gerät und prüfe dann die Kopplung.',
  'Pairing confirmed by the companion. Test the glasses display and wristband next.':'Kopplung vom Begleiter bestätigt. Teste jetzt Brillendisplay und Armband.',
  'No new paired device found. Check the connection and scan the QR code again if it expired.':'Kein neu gekoppeltes Gerät gefunden. Prüfe die Verbindung und scanne bei Ablauf den QR-Code erneut.',
  'Generate a pairing QR code first.':'Erzeuge zuerst einen Kopplungs-QR-Code.','Open the app on the device and check pairing before completing setup.':'Öffne die App auf dem Gerät und prüfe die Kopplung, bevor du die Einrichtung abschließt.',
  'Start this connection automatically when OpenGlassUI starts':'Diese Verbindung beim Start von OpenGlassUI automatisch starten',
  'Public providers expose the gateway whenever OpenGlassUI starts. Quick Tunnel addresses change on restart; reinstall or re-pair with the new address when needed.':'Öffentliche Anbieter stellen das Gateway bei jedem Start bereit. Quick-Tunnel-Adressen ändern sich beim Neustart; aktualisiere oder kopple die App bei Bedarf erneut.',
  'Install cloudflared with Homebrew':'cloudflared mit Homebrew installieren',
  'Cloudflare Quick Tunnel':'Cloudflare Quick Tunnel','Public HTTPS for testing. No Cloudflare account required; the address changes on restart.':'Öffentliches HTTPS zum Testen. Kein Cloudflare-Konto nötig; die Adresse ändert sich beim Neustart.',
  'Install cloudflared, then start the connection below. On macOS: brew install cloudflared.':'Installiere cloudflared und starte anschließend die Verbindung. Unter macOS: brew install cloudflared.',
  'Cloudflare installation instructions ↗':'Cloudflare-Installationsanleitung ↗',
  'Public HTTPS. An ngrok account and configured auth token are required.':'Öffentliches HTTPS. Ein ngrok-Konto und ein eingerichtetes Auth-Token sind erforderlich.',
  'Install ngrok, sign in, and configure your auth token as described by ngrok. On macOS: brew install ngrok.':'Installiere ngrok, melde dich an und richte das Auth-Token nach der ngrok-Anleitung ein. Unter macOS: brew install ngrok.',
  'ngrok setup instructions ↗':'ngrok-Einrichtungsanleitung ↗',
  'Private tailnet connection. Tailscale must be installed and connected; HTTPS and Serve must be enabled.':'Private Tailnet-Verbindung. Tailscale muss installiert und verbunden sein; HTTPS und Serve müssen aktiviert sein.',
  'Install Tailscale on the companion and phone, sign in, and enable Serve if prompted. Phone access does not guarantee the glasses can reach the tailnet.':'Installiere Tailscale auf Begleiter und Smartphone, melde dich an und aktiviere Serve bei Aufforderung. Smartphone-Zugriff garantiert keinen Zugriff von der Brille.',
  'Tailscale installation instructions ↗':'Tailscale-Installationsanleitung ↗',
  'Checking cloudflared…':'cloudflared wird geprüft…','Installing cloudflared with Homebrew…':'cloudflared wird mit Homebrew installiert…','cloudflared is not installed.':'cloudflared ist nicht installiert.','✓ cloudflared is installed.':'✓ cloudflared ist installiert.','Installation is still running. Check back shortly.':'Die Installation läuft noch. Bitte später erneut prüfen.',
  'Add an ACP-compatible agent':'ACP-kompatiblen Agenten hinzufügen','Use the installed agent executable and a JSON array of arguments. Do not put API keys in arguments.':'Gib das installierte Agentenprogramm und ein JSON-Array mit Argumenten an. Keine API-Schlüssel in Argumenten speichern.','Agent name':'Agentenname','Executable, e.g. agent':'Programm, z. B. agent','Executable':'Programm','Arguments as JSON array':'Argumente als JSON-Array','Add ACP agent':'ACP-Agent hinzufügen',
  'Continue':'Weiter','Open dashboard':'Zum Dashboard','Back':'Zurück','STEP':'SCHRITT','OF':'VON'
 };
 const get=()=>localStorage.getItem('openglass-language') || 'en';
 window.openGlassI18n={get,set(language){localStorage.setItem('openglass-language',language==='de'?'de':'en');},t(value){return get()==='de'?(de[value]||value):value;}};
})();
