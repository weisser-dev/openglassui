import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/wearable-navigation.js',import.meta.url),'utf8'),context);
function setup(initial=''){
 const listeners={},drafts=new Map(),input={value:initial,isConnected:true,addEventListener:(name,fn)=>{listeners[name]=fn;}},send={disabled:false,isConnected:true,focus(){this.focused=true;}};
 let poll,cleared=false;const win={setInterval(fn){poll=fn;return 1;},clearInterval(){cleared=true;},setTimeout(fn){fn();}};
 const control=context.attachWearableComposer(input,send,drafts,'chat',win);return {input,send,drafts,listeners,control,poll:()=>poll(),isCleared:()=>cleared};
}
test('a device composer that silently changes the value enables send and retains the draft',()=>{
 const f=setup();assert.equal(f.send.disabled,true);f.input.value='Hello from dictation';f.poll();assert.equal(f.send.disabled,false);assert.equal(f.drafts.get('chat'),'Hello from dictation');
 f.control.setSending(true);f.input.value='Updated';f.poll();assert.equal(f.send.disabled,true);assert.equal(f.drafts.get('chat'),'Updated');f.control.setSending(false);assert.equal(f.send.disabled,false);
 f.control.clear();assert.equal(f.input.value,'');assert.equal(f.send.disabled,true);assert.equal(f.drafts.has('chat'),false);
});
test('blur retains the current value and change focuses send; detached composers stop polling',()=>{
 const f=setup();f.input.value='A message';f.listeners.blur();assert.equal(f.drafts.get('chat'),'A message');assert.equal(f.send.disabled,false);f.listeners.change();assert.equal(f.send.focused,true);f.input.isConnected=false;f.poll();assert.equal(f.isCleared(),true);
});
