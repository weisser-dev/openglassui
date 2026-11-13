import {test} from 'node:test';import assert from 'node:assert/strict';import {generateReplySuggestions} from '../reply-suggestions.js';
test('suggestions run as an isolated tool-free Claude turn and return choices',async()=>{
 let options,prompt,closed=false;const queryImpl=input=>{options=input.options;prompt=input.prompt;return {close(){closed=true;},async *[Symbol.asyncIterator](){yield {type:'result',result:'["Yes, continue", "Explain first", "Stop"]'};}}};
 const result=await generateReplySuggestions([{role:'user',text:'Question'},{role:'assistant',text:'Answer'}],{queryImpl,workspace:'/tmp'});assert.deepEqual(result,['Yes, continue','Explain first','Stop']);assert.deepEqual(options.tools,[]);assert.equal(options.outputFormat.type,'json_schema');assert.equal(options.persistSession,false);assert.deepEqual(options.settingSources,[]);assert.match(prompt,/Question/);assert.match(prompt,/Answer/);assert.equal(closed,true);
});
test('suggestions require a conversation and reject malformed results',async()=>{
 await assert.rejects(generateReplySuggestions([],{workspace:'/tmp'}));const queryImpl=()=>({close(){},async *[Symbol.asyncIterator](){yield {type:'result',result:'not json'};}});await assert.rejects(generateReplySuggestions([{role:'user',text:'Q'},{role:'assistant',text:'A'}],{queryImpl,workspace:'/tmp'}));
});
test('configured model and context limits are passed to the isolated request',async()=>{
 let captured;const queryImpl=input=>{captured=input;return {close(){},async *[Symbol.asyncIterator](){yield {type:'result',result:'["One","Two","Three"]'};}}};
 const messages=[{role:'user',text:'old-only-marker'},{role:'assistant',text:'old-answer'},{role:'user',text:'A'.repeat(3000)},{role:'assistant',text:'B'.repeat(3000)}];await generateReplySuggestions(messages,{queryImpl,workspace:'/tmp',model:'haiku',maxMessages:2,maxChars:2000});const context=JSON.parse(captured.prompt.split('Conversation JSON:\n')[1]);assert.equal(context.messages.length,2);assert.ok(JSON.stringify(context).length<=2100);assert.ok(context.messages.reduce((sum,row)=>sum+row.text.length,0)<=2000);assert.equal(captured.options.model,'haiku');assert.ok(!captured.prompt.includes('old-only-marker'));
});
test('context character cap includes escaped text and activity metadata',async()=>{
 let prompt;const queryImpl=input=>{prompt=input.prompt;return {close(){},async *[Symbol.asyncIterator](){yield {type:'result',result:'["A","B","C"]'};}}};
 await generateReplySuggestions([{role:'user',text:'"\\\n'.repeat(2500)},{role:'assistant',text:'\\"\n'.repeat(2500)}],{queryImpl,workspace:'/tmp',maxMessages:2,maxChars:2000,activity:'completed',events:[{title:'Run checks',status:'completed'}]});const serialized=prompt.split('Conversation JSON:\n')[1];assert.ok(serialized.length<=2000);const data=JSON.parse(serialized);assert.equal(data.activity,'completed');assert.equal(data.events[0].title,'Run checks');
});

test('structured SDK result is accepted and incomplete suggestions are rejected',async()=>{
 const rows=[{role:'user',text:'Q'},{role:'assistant',text:'A'}],make=payload=>()=>({close(){},async *[Symbol.asyncIterator](){yield {type:'result',structured_output:payload};}});
 assert.deepEqual(await generateReplySuggestions(rows,{workspace:'/tmp',queryImpl:make({suggestions:['Ja','Nein','Bitte erklären']})}),['Ja','Nein','Bitte erklären']);await assert.rejects(generateReplySuggestions(rows,{workspace:'/tmp',queryImpl:make({suggestions:['one']})}));
});
