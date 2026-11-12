import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/recent-chats.js',import.meta.url),'utf8'),context);
test('recent chats respect selected agents, projects, activity window and limit',()=>{
 const now=Date.parse('2026-11-12T12:00:00Z'),date=hours=>new Date(now-hours*3600000).toISOString();
 const tasks=[{id:'recent',agentId:'a',projectId:'p',createdAt:date(100),lastMessageAt:date(1)}, {id:'old',agentId:'a',projectId:'p',createdAt:date(30)}, {id:'running',agentId:'b',projectId:'p',createdAt:date(100),status:'running'}, {id:'hidden',agentId:'c',projectId:'p',createdAt:date(1)}, {id:'removed',agentId:'a',projectId:'x',createdAt:date(1)}];
 const ids=Array.from(context.recentChats(tasks,[{id:'a'},{id:'b'}],[{id:'p'}],{now,hours:24,limit:3}),task=>task.id);
 assert.deepEqual(ids,['running','recent']);
 assert.deepEqual(Array.from(context.recentChats(tasks,[{id:'a'},{id:'b'}],[{id:'p'}],{now,hours:72,limit:2}),task=>task.id),['running','recent']);
});
