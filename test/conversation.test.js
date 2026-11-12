import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startConversationTurn,appendAssistantText} from '../conversation.js';
test('new turns preserve separate user and assistant messages',()=>{
 const task={prompt:'First',output:''};startConversationTurn(task,'First');appendAssistantText(task,'Hello');appendAssistantText(task,' there');startConversationTurn(task,'Next');appendAssistantText(task,'Done');
 assert.deepEqual(task.messages,[{role:'user',text:'First'},{role:'assistant',text:'Hello there'},{role:'user',text:'Next'},{role:'assistant',text:'Done'}]);
});
test('legacy mixed output is labelled as transcript instead of invented speaker attribution',()=>{
 const task={prompt:'Old question',output:'old combined output'};startConversationTurn(task,'New question');
 assert.deepEqual(task.messages,[{role:'user',text:'Old question'},{role:'transcript',text:'old combined output'},{role:'user',text:'New question'}]);
});
