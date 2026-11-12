import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({window:{},Intl});
vm.runInContext(await readFile(new URL('../public/usage.js',import.meta.url),'utf8'),context);
const format=context.window.formatUsage;
test('usage formatting reports only provider-supplied token, context and cost values',()=>{
 const codex=format({provider:'codex',tokenUsage:{total:{inputTokens:1100,outputTokens:25,totalTokens:1125},modelContextWindow:10000}});
 assert.match(codex,/Input: 1,100 Tokens/);assert.match(codex,/Output: 25 Tokens/);assert.doesNotMatch(codex,/cost/);
 const claude=format({provider:'claude',usage:{input_tokens:4,output_tokens:7},costUsd:0.0123});assert.match(claude,/\$0\.0123/);
 assert.match(codex,/reported total/);assert.match(claude,/last reported run/);
 assert.match(format({provider:'kiro',context:{usagePercentage:42.5},turn:{promptTurnSummaries:[{unit:'credit',unitPlural:'credits',usage:2}]}}),/Last turn: 2 credits/);
 assert.match(format({provider:'kiro',context:{usagePercentage:42.5}}),/42\.5 %/);
 assert.match(format({provider:'kiro'}),/No detailed usage/);
});
test('local activity counts tracked prompts without inventing historical values',()=>{
 const summary=context.window.summarizeLocalActivity([{trackedMessages:2,pendingDecision:{id:'1'}},{},{trackedMessages:-1},{trackedMessages:1}]);
 assert.equal(summary.tasks,4);assert.equal(summary.messages,3);assert.equal(summary.pending,1);
});
