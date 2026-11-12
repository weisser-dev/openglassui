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
test('return restores originating focus and both scroll positions, or uses a fallback',()=>{
 let focused='',position;const output={scrollTop:35};
 const origin={dataset:{focusKey:'project:two'},offsetParent:{},focus:()=>focused='origin'};
 const fallback={focus:()=>focused='fallback'};
 const doc={activeElement:origin,querySelector:s=>s==='#screen .chat-output'?output:fallback,querySelectorAll:()=>[origin]};
 const win={scrollY:240,scrollTo:(x,y)=>{position=[x,y];}};
 const saved=context.captureWearableView(doc,win,{page:'projects'},{selectedAgent:'a'});
 output.scrollTop=0;context.restoreWearableView(doc,win,saved);
 assert.equal(focused,'origin');assert.equal(output.scrollTop,35);assert.deepEqual(position,[0,240]);
 origin.offsetParent=null;context.restoreWearableView(doc,win,saved);assert.equal(focused,'fallback');
});

test('screen navigation follows browser history and restores one view per back',async()=>{
 const source=await readFile(new URL('../public/glass.js',import.meta.url),'utf8');
 const navigation=source.slice(source.indexOf('function go('),source.indexOf('function setError('));
 const states=[];let pop,restored=[];
 const document={};const window={scrollTo(){},addEventListener(type,fn){if(type==='popstate')pop=fn;}};
 const history={pushState(state){states.push(state);},back(){states.pop();pop({state:states.at(-1)||null});}};
 const sandbox=vm.createContext({document,window,history,location:{href:'https://example.test/glass'},
  captureWearableView:(_doc,_win,route,selection)=>({route:{...route},selection:{...selection}}),
  restoreWearableView:(_doc,_win,view)=>restored.push(view.route.page),render(){},focusScreen(){}});
 vm.runInContext(`let route={page:'agents'},stack=[],selectedAgent='',selectedProject='',selectedTask='';${navigation}`,sandbox);
 vm.runInContext("go('projects',{selectedAgent:'codex'});go('chats',{selectedProject:'p'});",sandbox);
 assert.equal(states.length,2);vm.runInContext('back()',sandbox);assert.deepEqual(restored,['projects']);
 pop({state:null});assert.deepEqual(restored,['projects','agents']);
});
