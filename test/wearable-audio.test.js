import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/wearable-audio.js',import.meta.url),'utf8'),context);
test('speech reads the complete response in bounded sections and supports pause',()=>{
 const missing=context.createWearableAudio(null,null);assert.equal(missing.speak('hello'),false);
 const spoken=[];let cancelled=0,paused=0,resumed=0,ended=false;class Utterance{constructor(text){this.text=text;}}
 const audio=context.createWearableAudio({speak:u=>spoken.push(u),cancel:()=>cancelled++,pause:()=>paused++,resume:()=>resumed++},Utterance);
 const text='word '.repeat(500).trim();assert.equal(audio.speak(text,()=>{},'',()=>ended=true),true);assert.ok(spoken[0].text.length<=1500);assert.equal(audio.togglePause(),true);assert.equal(audio.paused,true);assert.equal(audio.togglePause(),true);assert.equal(paused,1);assert.equal(resumed,1);spoken[0].onend();assert.equal(spoken.length,2);spoken[1].onend();assert.equal(spoken.map(u=>u.text).join(''),text);assert.equal(ended,true);audio.stop();assert.equal(cancelled,2);
});
test('speech cancellation prevents later sections and selects the requested voice',()=>{
 const spoken=[];class Utterance{constructor(text){this.text=text;}}const german={lang:'de-DE'};const audio=context.createWearableAudio({speak:u=>spoken.push(u),cancel(){},getVoices:()=>[german]},Utterance);
 audio.speak('x'.repeat(2000),()=>{},'de-DE');assert.equal(spoken[0].voice,german);assert.equal(spoken[0].lang,'de-DE');audio.stop();spoken[0].onend();assert.equal(spoken.length,1);
});
test('visible response sections keep every word and respect the size limit',()=>{
 const text=('A short sentence.\n  code example\n'.repeat(70)).trim();const parts=Array.from(context.splitWearableText(text,300));assert.ok(parts.length>1);assert.ok(parts.every(part=>part.length<=300));assert.equal(parts.join(''),text);
});
