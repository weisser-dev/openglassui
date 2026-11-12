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
