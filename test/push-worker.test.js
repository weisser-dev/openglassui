import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('push worker shows only generic content and opens only its own app',async()=>{
 const handlers={},notifications=[];let opened='';const self={location:{origin:'https://example.test'},addEventListener:(name,handler)=>{handlers[name]=handler;},registration:{showNotification:async(title,options)=>{notifications.push({title,options});}},clients:{matchAll:async()=>[],openWindow:async url=>{opened=url;}}};
 const context=vm.createContext({self,URL});vm.runInContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 let promise;handlers.push({data:{json:()=>({kind:'decision',secret:'must not appear'})},waitUntil:value=>{promise=value;}});await promise;assert.equal(notifications[0].options.body,'A task needs your decision.');assert.ok(!JSON.stringify(notifications).includes('must not appear'));
 handlers.notificationclick({notification:{close(){}},waitUntil:value=>{promise=value;}});await promise;assert.equal(opened,'/glass.html');
});
