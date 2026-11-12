import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClaude } from '../sessions.js';

test('Claude gibt ausgewählte Antwort und einzelne Ablehnung korrekt zurück',async()=>{
 let questionResult,permissionResult,chosenModel,catalog;
 function fakeQuery({options}){chosenModel=options.model;return {close(){},async supportedModels(){return [{value:'sonnet',displayName:'Sonnet'}]},async *[Symbol.asyncIterator](){
  questionResult=await options.canUseTool('AskUserQuestion',{questions:[{question:'Welcher Weg?',options:[{label:'A'},{label:'B'}]}]},{toolUseID:'q1'});
  permissionResult=await options.canUseTool('Bash',{command:'npm test'},{toolUseID:'p1'});
  yield {type:'result',is_error:false};
 }}}
 await new Promise((resolve,reject)=>runClaude({prompt:'Test',workspace:'/tmp',model:'sonnet',onModels:models=>catalog=models,queryImpl:fakeQuery,onMessage(){},onDecision:async d=>d.kind==='question'?{type:'answer',answers:{'Welcher Weg?':'B'}}:{type:'deny'},onDone:e=>e?reject(e):resolve()}));
 assert.equal(chosenModel,'sonnet');assert.equal(catalog[0].value,'sonnet');assert.equal(questionResult.behavior,'allow');assert.deepEqual(questionResult.updatedInput.answers,{'Welcher Weg?':'B'});assert.equal(permissionResult.behavior,'deny');
});
