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
  'Continue':'Weiter','Open dashboard':'Zum Dashboard','Back':'Zurück','STEP':'SCHRITT','OF':'VON'
 };
 const get=()=>localStorage.getItem('openglass-language') || 'en';
 window.openGlassI18n={get,set(language){localStorage.setItem('openglass-language',language==='de'?'de':'en');},t(value){return get()==='de'?(de[value]||value):value;}};
})();
