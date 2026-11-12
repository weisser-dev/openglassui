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
test('selected language chooses a matching device voice for playback',()=>{
 let spoken;class Utterance{constructor(text){this.text=text;}}
 const german={lang:'de-DE'},english={lang:'en-US'};
 const audio=context.createWearableAudio({speak:utterance=>{spoken=utterance;},getVoices:()=>[english,german]},Utterance);
 audio.speak('Guten Tag',()=>{},'de-DE');assert.equal(spoken.lang,'de-DE');assert.equal(spoken.voice,german);
 audio.speak('Hello',()=>{},'en-US');assert.equal(spoken.voice,english);
 audio.speak('Bonjour',()=>{},'fr-FR');assert.equal(spoken.lang,'fr-FR');assert.equal(spoken.voice,undefined);
});
