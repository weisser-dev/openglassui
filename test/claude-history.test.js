import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLatestClaudeMessages} from '../sessions.js';

test('Claude history selects the latest messages, not the first page',async()=>{
 const history=Array.from({length:250},(_,index)=>({index}));let options;
 const result=await readLatestClaudeMessages('session','/project',async(_id,input)=>{options=input;return history;});
 assert.deepEqual(options,{dir:'/project'});assert.equal(result.length,100);assert.equal(result[0].index,150);assert.equal(result.at(-1).index,249);
});
