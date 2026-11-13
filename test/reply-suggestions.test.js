import {test} from 'node:test';import assert from 'node:assert/strict';import {generateReplySuggestions} from '../reply-suggestions.js';
test('suggestions run as an isolated tool-free Claude turn and return choices',async()=>{
 let options,prompt,closed=false;const queryImpl=input=>{options=input.options;prompt=input.prompt;return {close(){closed=true;},async *[Symbol.asyncIterator](){yield {type:'result',result:'["Yes, continue", "Explain first", "Stop"]'};}}};
 const result=await generateReplySuggestions([{role:'user',text:'Question'},{role:'assistant',text:'Answer'}],{queryImpl,workspace:'/tmp'});assert.deepEqual(result,['Yes, continue','Explain first','Stop']);assert.deepEqual(options.tools,[]);assert.equal(options.persistSession,false);assert.deepEqual(options.settingSources,[]);assert.match(prompt,/Question/);assert.match(prompt,/Answer/);assert.equal(closed,true);
});
test('suggestions require a conversation and reject malformed results',async()=>{
 await assert.rejects(generateReplySuggestions([],{workspace:'/tmp'}));const queryImpl=()=>({close(){},async *[Symbol.asyncIterator](){yield {type:'result',result:'not json'};}});await assert.rejects(generateReplySuggestions([{role:'user',text:'Q'},{role:'assistant',text:'A'}],{queryImpl,workspace:'/tmp'}));
});
test('configured model and context limits are passed to the isolated request',async()=>{
 let captured;const queryImpl=input=>{captured=input;return {close(){},async *[Symbol.asyncIterator](){yield {type:'result',result:'["One","Two","Three"]'};}}};
 const messages=[{role:'user',text:'old-only-marker'},{role:'assistant',text:'old-answer'},{role:'user',text:'A'.repeat(3000)},{role:'assistant',text:'B'.repeat(3000)}];await generateReplySuggestions(messages,{queryImpl,workspace:'/tmp',model:'haiku',maxMessages:2,maxChars:2000});const context=JSON.parse(captured.prompt.split('Conversation JSON:\n')[1]);assert.equal(context.length,2);assert.ok(context.reduce((sum,row)=>sum+row.text.length,0)<=2000);assert.equal(captured.options.model,'haiku');assert.ok(!captured.prompt.includes('old-only-marker'));
});
