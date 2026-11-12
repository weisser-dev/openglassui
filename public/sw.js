// No task content, credentials, or authenticated responses are cached here.
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const messages={decision:'Eine Aufgabe benötigt deine Entscheidung.',completed:'Eine Aufgabe wurde abgeschlossen.',failed:'Eine Aufgabe ist fehlgeschlagen.'};
 const body=messages[data.kind]||'Es gibt eine neue Aktivität.';
 event.waitUntil(self.registration.showNotification('OpenGlassUI',{body,tag:'openglass-activity'}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  const existing=clients.find(client=>{const url=new URL(client.url);return url.origin===self.location.origin && url.pathname==='/glass.html';});
  return existing?existing.focus():self.clients.openWindow('/glass.html');
 }));
});
