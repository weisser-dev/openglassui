import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoverAgentProjects} from '../sessions.js';

test('project discovery merges provider paths and reports unavailable providers',async()=>{
 const result=await discoverAgentProjects({claudeList:async()=>[{cwd:'/project/a'},{cwd:'/project/a'}],codexList:async()=>({data:[{cwd:'/project/a'},{cwd:'/project/b'}]})});
 assert.deepEqual(result.projects,[{path:'/project/a',sources:['claude','codex'],sessions:3},{path:'/project/b',sources:['codex'],sessions:1}]);
 const partial=await discoverAgentProjects({claudeList:async()=>{throw new Error('offline')},codexList:async()=>({data:[]})});assert.deepEqual(partial.unavailable,['claude']);
});
