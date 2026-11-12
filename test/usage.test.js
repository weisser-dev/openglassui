import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({window:{},Intl});
vm.runInContext(await readFile(new URL('../public/usage.js',import.meta.url),'utf8'),context);
const format=context.window.formatUsage;
test('usage formatting reports only provider-supplied token, context and cost values',()=>{
 const codex=format({provider:'codex',tokenUsage:{total:{inputTokens:1100,outputTokens:25,totalTokens:1125},modelContextWindow:10000}});
 assert.match(codex,/Eingabe: 1\.100 Tokens/);assert.match(codex,/Ausgabe: 25 Tokens/);assert.doesNotMatch(codex,/Kosten/);
 const claude=format({provider:'claude',usage:{input_tokens:4,output_tokens:7},costUsd:0.0123});assert.match(claude,/\$0\.0123/);
 assert.match(codex,/gemeldete Gesamtsumme/);assert.match(claude,/letzte gemeldete Ausführung/);
 assert.match(format({provider:'kiro',context:{usagePercentage:42.5},turn:{promptTurnSummaries:[{unit:'credit',unitPlural:'credits',usage:2}]}}),/Letzte Runde: 2 credits/);
 assert.match(format({provider:'kiro',context:{usagePercentage:42.5}}),/42\.5 %/);
 assert.match(format({provider:'kiro'}),/Keine detaillierten Angaben/);
});
