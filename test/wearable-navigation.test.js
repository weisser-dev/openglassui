import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(await readFile(new URL('../public/wearable-navigation.js',import.meta.url),'utf8'),context);
test('back works from a composer without intercepting typing or composition',()=>{
 const input={tagName:'TEXTAREA'}, button={tagName:'BUTTON'};
 assert.equal(context.isWearableBack({key:'Escape'},input),true);
 assert.equal(context.isWearableBack({key:'Backspace'},input),false);
 assert.equal(context.isWearableBack({key:'Backspace'},button),true);
 assert.equal(context.isWearableBack({key:'Escape',isComposing:true},input),false);
 assert.equal(context.isWearableBack({key:'Escape',defaultPrevented:true},input),false);
});
test('return restores the selected output rather than the first message',()=>{
 let focused='',position;const output={dataset:{focusKey:'output:2:1'},offsetParent:{},scrollTop:35,matches:selector=>selector==='.chat-output',focus:()=>focused='output'};
 const fallback={focus:()=>focused='fallback'},first={scrollTop:90};
 const doc={activeElement:output,querySelector:s=>s==='#screen .chat-output'?first:fallback,querySelectorAll:()=>[output]};
 const win={scrollY:240,scrollTo:(x,y)=>{position=[x,y];}};
 const saved=context.captureWearableView(doc,win,{page:'chat'},{});output.scrollTop=0;context.restoreWearableView(doc,win,saved);
 assert.equal(focused,'output');assert.equal(output.scrollTop,35);assert.equal(first.scrollTop,90);assert.deepEqual(position,[0,240]);
 output.offsetParent=null;context.restoreWearableView(doc,win,saved);assert.equal(focused,'fallback');
});

test('screen navigation follows browser history and restores one view per back',async()=>{
 const source=await readFile(new URL('../public/glass.js',import.meta.url),'utf8');
 const navigation=source.slice(source.indexOf('function go('),source.indexOf('function setError('));
 const states=[];let pop,restored=[];
 const document={};const window={scrollTo(){},addEventListener(type,fn){if(type==='popstate')pop=fn;}};
 const history={pushState(state){states.push(state);},back(){states.pop();pop({state:states.at(-1)||null});}};
 const sandbox=vm.createContext({document,window,history,location:{href:'https://example.test/glass'},
  audio:{stop(){}}, refreshImportedHistory:async()=>{}, captureWearableView:(_doc,_win,route,selection)=>({route:{...route},selection:{...selection}}),
  restoreWearableView:(_doc,_win,view)=>restored.push(view.route.page),render(){},focusScreen(){restored.push('agents');}});
 vm.runInContext(`let speakingKey='',route={page:'agents'},stack=[],selectedAgent='',selectedProject='',selectedTask='';${navigation}`,sandbox);
 vm.runInContext("go('projects',{selectedAgent:'codex'});go('chats',{selectedProject:'p'});",sandbox);
 assert.equal(states.length,2);restored.length=0;vm.runInContext('back()',sandbox);assert.deepEqual(restored,['projects']);
 pop({state:null});assert.deepEqual(restored,['projects','agents']);
});

test('direction keys leave the composer and jump from a response to reply',async()=>{
 const source=await readFile(new URL('../public/glass.js',import.meta.url),'utf8');const start=source.indexOf("document.addEventListener('keydown'");const end=source.indexOf('\nasync function registerVoice()',start);let handler,focused='',prevented=false;
 const reply={tagName:'TEXTAREA',focus(){focused='reply';},matches:()=>false,getBoundingClientRect:()=>({}),offsetParent:{}};
 const option={tagName:'BUTTON',focus(){focused='button';},matches:()=>false,getBoundingClientRect:()=>({}),offsetParent:{}};
 const output={tagName:'PRE',matches:s=>s==='.chat-output',getBoundingClientRect:()=>({}),offsetParent:{}};
 const document={activeElement:output,addEventListener:(_name,fn)=>handler=fn,querySelector:()=>reply,querySelectorAll:()=>[reply,option]};
 const sandbox=vm.createContext({document,isWearableBack:()=>false,spatialTarget:()=>1});vm.runInContext(source.slice(start,end),sandbox);
 handler({key:'ArrowRight',preventDefault(){prevented=true;}});assert.equal(focused,'reply');assert.equal(prevented,true);
 document.activeElement=reply;focused='';handler({key:'ArrowDown',preventDefault(){}});assert.equal(focused,'button');
 focused='';handler({key:'ArrowDown',isComposing:true,preventDefault(){}});assert.equal(focused,'');
});

test('opening a chat focuses the latest message unless a decision needs attention',()=>{
 let focused='';const older={focus:()=>focused='older'},latest={focus:()=>focused='latest'},decision={focus:()=>focused='decision'},fallback={focus:()=>focused='fallback'};let pending=false;
 const doc={querySelector:selector=>selector.includes('.decision')?(pending?decision:null):fallback,querySelectorAll:()=>[older,latest]};
 context.focusWearableScreen(doc,'chat',false);assert.equal(focused,'latest');
 pending=true;context.focusWearableScreen(doc,'chat',true);assert.equal(focused,'decision');
 doc.querySelectorAll=()=>[];pending=false;context.focusWearableScreen(doc,'chat',false);assert.equal(focused,'fallback');
});

test('chat focus explicitly scrolls into view and does not steal focus later',()=>{
 let calls=0,frame;const target={isConnected:true,focus(){doc.activeElement=this;},scrollIntoView(){calls++;}};
 const doc={activeElement:null,querySelectorAll:()=>[target],querySelector:()=>null};
 const win={requestAnimationFrame(callback){frame=callback;}};
 context.focusWearableScreen(doc,'chat',false,win);assert.equal(calls,1);frame();assert.equal(calls,2);
 context.focusWearableScreen(doc,'chat',false,win);target.isConnected=false;frame();assert.equal(calls,3);
});

test('opening an imported history refreshes its snapshot and keeps editing focus',async()=>{
 const source=await readFile(new URL('../public/glass.js',import.meta.url),'utf8');const start=source.indexOf('async function refreshImportedHistory('),end=source.indexOf('\nfunction heading(',start);
 let requested='',updates=0,rendered=0,focuses=0;const active={matches:()=>true};const document={activeElement:active,documentElement:{scrollHeight:100},querySelectorAll:()=>[]};
 const sandbox=vm.createContext({document,window:{formatProviderSession:()=>[],scrollY:0},api:async url=>{requested=url;return {messages:[{role:'assistant',text:'updated history'}],total:1,nextBefore:null};},updateChatWhileEditing:()=>updates++,render:()=>rendered++,focusScreen:()=>focuses++,setError(){},t:x=>x});
 vm.runInContext(`const importedSnapshots=new Map();const pagedHistory=new Map();const refreshingSnapshots=new Set();let state={tasks:[{id:'x',prompt:'Importierte Sitzung',agentId:'claude',sessionId:'sid',projectId:'p'}]},route={page:'chat'},selectedTask='x';${source.slice(start,end)}`,sandbox);
 await vm.runInContext("refreshImportedHistory('x')",sandbox);
 assert.equal(requested,'/api/sessions/claude/sid/page?projectId=p');assert.equal(updates,1);assert.equal(rendered,0);assert.equal(focuses,0);assert.equal(vm.runInContext("pagedHistory.get('x').messages[0].text",sandbox),'updated history');
});


test('late wearable focus reset is corrected, but user navigation cancels retries',()=>{
 const timers=[],listeners={};let scrolls=0;const doc={activeElement:null,querySelectorAll:()=>[target],querySelector:()=>null,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:(name)=>delete listeners[name]};
 const target={isConnected:true,focus(){doc.activeElement=this;},scrollIntoView(){scrolls++;},getBoundingClientRect:()=>({top:700,height:80})};
 const win={scrollY:0,innerHeight:600,scrollTo(_x,y){assert.equal(y,440);},setTimeout(fn){timers.push(fn);}};
 context.focusWearableScreen(doc,'chat',false,win);timers[0]();doc.activeElement={};timers[1]();assert.equal(doc.activeElement,target);assert.equal(scrolls,2);listeners.keydown();doc.activeElement={};timers[2]();assert.equal(scrolls,2);
});
