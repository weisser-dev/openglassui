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
