import {test} from 'node:test';import assert from 'node:assert/strict';import {generateReplySuggestions} from '../reply-suggestions.js';
test('suggestions run as an isolated tool-free Claude turn and return choices',async()=>{
 let options,prompt,closed=false;const queryImpl=input=>{options=input.options;prompt=input.prompt;return {close(){closed=true;},async *[Symbol.asyncIterator](){yield {type:'result',result:'["Yes, continue", "Explain first", "Stop"]'};}}};
 const result=await generateReplySuggestions([{role:'user',text:'Question'},{role:'assistant',text:'Answer'}],{queryImpl,workspace:'/tmp'});assert.deepEqual(result,['Yes, continue','Explain first','Stop']);assert.deepEqual(options.tools,[]);assert.equal(options.persistSession,false);assert.deepEqual(options.settingSources,[]);assert.match(prompt,/Question/);assert.match(prompt,/Answer/);assert.equal(closed,true);
});
test('suggestions require a conversation and reject malformed results',async()=>{
 await assert.rejects(generateReplySuggestions([],{workspace:'/tmp'}));const queryImpl=()=>({close(){},async *[Symbol.asyncIterator](){yield {type:'result',result:'not json'};}});await assert.rejects(generateReplySuggestions([{role:'user',text:'Q'},{role:'assistant',text:'A'}],{queryImpl,workspace:'/tmp'}));
});
