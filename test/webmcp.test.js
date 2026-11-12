import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/webmcp.js',import.meta.url),'utf8'),context);
test('voice actions use the selected project, forward cancellation and label external text',async()=>{
 const calls=[];const api=async(url,options)=>{calls.push({url,options});return url==='/api/tasks'?{id:'task-id'}:{tasks:[{id:'task-id',status:'running',output:'agent output'}],projects:[],agents:[]};};
 const tools=context.createWearableTools(api,()=> 'selected-project');const start=tools.find(t=>t.name==='start_coding_task');const signal=new AbortController().signal;
 await start.execute({agentId:'kiro',prompt:'test'},{signal});assert.equal(JSON.parse(calls[0].options.body).projectId,'selected-project');assert.equal(calls[0].options.signal,signal);
 await assert.rejects(start.execute({agentId:'kiro',prompt:''},{}));
 const read=tools.find(t=>t.name==='read_coding_task');assert.equal(read.annotations.untrustedContentHint,true);assert.match((await read.execute({taskId:'task-id'},{signal})).content[0].text,/agent output/);assert.equal(calls.at(-1).options.signal,signal);
});
