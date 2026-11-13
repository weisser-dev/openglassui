import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLatestClaudeMessages} from '../sessions.js';

test('Claude history selects the latest messages, not the first page',async()=>{
 const history=Array.from({length:250},(_,index)=>({index,type:'assistant',message:{content:[{type:'text',text:String(index)}]}}));let options;
 const result=await readLatestClaudeMessages('session','/project',async(_id,input)=>{options=input;return history;});
 assert.deepEqual(options,{dir:'/project'});assert.equal(result.length,100);assert.equal(result[0].index,150);assert.equal(result.at(-1).index,249);
});


test('Claude retains recent text when many later tool-only events exist',async()=>{
 const text={type:'assistant',message:{content:[{type:'text',text:'Latest answer'}]}};const tools=Array.from({length:150},()=>({type:'assistant',message:{content:[{type:'tool_use',name:'Bash'}]}}));
 const result=await readLatestClaudeMessages('session','/project',async()=>[text,...tools]);assert.deepEqual(result,[text]);
});
