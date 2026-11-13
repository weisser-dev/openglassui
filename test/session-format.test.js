import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatSession} from '../session-format.js';

test('session imports show conversation text and omit tool payloads',()=>{
 const codex={turns:[{items:[{type:'userMessage',content:[{type:'text',text:'Question'}]},{type:'commandExecution',command:'private-command'},{type:'agentMessage',text:'Answer'}]}]};
 assert.equal(formatSession(codex,'codex'),'DU\nQuestion\n\nCODEX\nAnswer');
 const claude=[{type:'user',message:{content:'Question'}},{type:'assistant',message:{content:[{type:'tool_use',name:'Bash',input:{command:'private-command'}},{type:'text',text:'Answer'}]}},{type:'user',message:{content:[{type:'tool_result',content:'private-output'}]}}];
 assert.equal(formatSession(claude,'claude'),'DU\nQuestion\n\nCLAUDE\nAnswer');
 assert.equal(formatSession([{type:'assistant',message:{content:'Hallo'}}],'kiro'),'KIRO\nHallo');
 assert.match(formatSession({turns:[]},'codex'),/Keine Textnachrichten/);
});

test('imported conversation hides system-reminder blocks',()=>{
 const claude=[{type:'user',message:{content:'Hello\n<system-reminder>internal details</system-reminder>\nWorld'}}];
 assert.equal(formatSession(claude,'claude'),'DU\nHello\n\nWorld');
});

test('structured session messages preserve recent content within a bounded total',async()=>{
 const {formatSessionMessages}=await import('../session-format.js');const rows=formatSessionMessages([{type:'user',message:{content:'a'.repeat(80000)}},{type:'assistant',message:{content:'b'.repeat(80000)}}]);assert.equal(rows.reduce((sum,row)=>sum+row.text.length,0),100000);assert.equal(rows.at(-1).text,'b'.repeat(80000));
});
