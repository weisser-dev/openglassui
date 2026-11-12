import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/wearable-audio.js',import.meta.url),'utf8'),context);
test('speech is optional and only sends bounded text to an available engine',()=>{
 const missing=context.createWearableAudio(null,null);assert.equal(missing.available,false);assert.equal(missing.speak('hello'),false);
 let spoken,cancelled=0;class Utterance{constructor(text){this.text=text;}}const audio=context.createWearableAudio({speak:u=>{spoken=u;},cancel:()=>cancelled++},Utterance);
 assert.equal(audio.available,true);assert.equal(audio.speak('x'.repeat(2000)),true);assert.equal(spoken.text.length,1500);audio.stop();assert.equal(cancelled,2);
 let error;spoken.onerror();const broken=context.createWearableAudio({speak(){throw new Error('blocked');}},Utterance);assert.equal(broken.speak('hello',message=>error=message),false);assert.match(error,/unavailable/);
});
