import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('wearable demo uses fictional state without companion access',async()=>{
 const window={};const context=vm.createContext({window,Date,JSON,Error});
 vm.runInContext(await readFile(new URL('../demo/wearable-mock.js',import.meta.url),'utf8'),context);
 assert.equal(window.OPENGLASS_DEMO,true);const state=await window.openGlassDemoApi('/api/state');assert.equal(state.agents.length,4);assert.equal(state.tasks.length,2);assert.ok(state.tasks[0].pendingDecision);await window.openGlassDemoApi('/api/tasks/demo-codex-chat/decision',{body:'{}'});assert.equal(state.tasks[0].pendingDecision,undefined);assert.equal((await window.openGlassDemoApi('/api/models?agent=codex')).models.length,2);assert.equal((await window.openGlassDemoApi('/api/models?agent=claude')).models.length,2);
 const result=await window.openGlassDemoApi('/api/tasks',{body:JSON.stringify({agentId:'codex',projectId:'demo-project',prompt:'Example'})});assert.ok(result.id);assert.equal(state.tasks[0].messages[1].text,'This is a simulated response. No agent was contacted.');
 await assert.rejects(window.openGlassDemoApi('/api/push/key'),/Unavailable/);
});
test('demo controls restore iframe focus and activate the selected button once',async()=>{
 const handlers={},buttons=['ArrowDown','Enter'].map(key=>({dataset:{key},addEventListener:(_name,fn)=>{handlers[key]=fn;}}));let onLoad,onFocus,keys=[],clicks=0;
 const doc={activeElement:null,addEventListener:(_name,fn)=>{onFocus=fn;},querySelector:()=>target};const target={isConnected:true,disabled:false,tagName:'BUTTON',focus(){doc.activeElement=this;},dispatchEvent(event){keys.push(event.key);},click(){clicks++;}};
 class KeyboardEvent{constructor(key,options){this.type=key;this.key=options.key;this.defaultPrevented=false;}}
 const frame={contentDocument:doc,contentWindow:{KeyboardEvent},addEventListener:(_name,fn)=>{onLoad=fn;}};
 const document={querySelector:()=>frame,querySelectorAll:()=>buttons};const context=vm.createContext({document});vm.runInContext(await readFile(new URL('../demo/demo.js',import.meta.url),'utf8'),context);
 onLoad();onFocus({target});doc.activeElement=null;handlers.ArrowDown();assert.equal(doc.activeElement,target);assert.deepEqual(keys,['ArrowDown']);doc.activeElement=null;handlers.Enter();assert.equal(clicks,1);assert.deepEqual(keys,['ArrowDown','Enter']);
});
test('dashboard demo keeps all agent, pairing and network actions in memory',async()=>{
 const document={addEventListener(){}},window={};const context=vm.createContext({window,document,Response,URL,Date,JSON,location:{href:'https://example.test/openglassui/dashboard/index.html',origin:'https://example.test'}});
 vm.runInContext(await readFile(new URL('../demo/dashboard-mock.js',import.meta.url),'utf8'),context);
 const before=await (await window.fetch('/api/state')).json();assert.equal(before.agents.length,4);assert.equal(before.tasks.length,2);
 await window.fetch('/api/tasks',{method:'POST',body:JSON.stringify({agentId:'codex',projectId:'default',prompt:'Example only'})});const after=await (await window.fetch('/api/state')).json();assert.equal(after.tasks.length,3);assert.match(after.tasks[0].output,/simulated/i);
 const pairing=await(await window.fetch('/api/pairing',{method:'POST',body:'{}'})).json();assert.match(decodeURIComponent(pairing.qr),/DEMO ONLY/);
 assert.equal((await window.fetch('https://example.org/api/state')).status,403);assert.equal((await window.fetch('/real-local-path')).status,403);
});
