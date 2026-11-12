import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('wearable demo uses fictional state without companion access',async()=>{
 const window={};const context=vm.createContext({window,Date,JSON,Error});
 vm.runInContext(await readFile(new URL('../demo/wearable-mock.js',import.meta.url),'utf8'),context);
 assert.equal(window.OPENGLASS_DEMO,true);const state=await window.openGlassDemoApi('/api/state');assert.equal(state.agents.length,3);
 const result=await window.openGlassDemoApi('/api/tasks',{body:JSON.stringify({agentId:'codex',projectId:'demo-project',prompt:'Example'})});assert.ok(result.id);assert.equal(state.tasks[0].messages[1].text,'This is a simulated response. No agent was contacted.');
 await assert.rejects(window.openGlassDemoApi('/api/push/key'),/Unavailable/);
});
