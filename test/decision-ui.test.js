import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.value='';}
 append(...items){this.children.push(...items);}setAttribute(key,value){this.attributes[key]=value;}
 querySelector(selector){const match=selector.match(/data-focus-key="([^"]+)"/);return this.find(el=>el.dataset.focusKey===match?.[1]);}
 find(predicate){for(const child of this.children){if(predicate(child))return child;const nested=child.find(predicate);if(nested)return nested;}return null;}
 focus(){this.focused=true;}
}
const window={},document={createElement:tag=>new Element(tag)};const context=vm.createContext({window,document,JSON});
vm.runInContext(await readFile(new URL('../public/decisions.js',import.meta.url),'utf8'),context);
test('decision choices require a separate send and preserve the selected answer',()=>{
 const calls=[];const task={id:'task',agentName:'Agent',prompt:'Example',pendingDecision:{id:'decision',kind:'question',input:{questions:[{question:'Which?',options:[{label:'A'},{label:'B'}]}]}}};
 const ui=window.decisionUI(task,(url,body)=>calls.push({url,body}));const a=ui.find(el=>el.dataset.focusKey==='decision:0:0'),b=ui.find(el=>el.dataset.focusKey==='decision:0:1'),send=ui.find(el=>el.dataset.focusKey==='decision-submit');
 send.onclick();assert.equal(calls.length,0);assert.equal(a.focused,true);b.onclick();assert.equal(b.attributes['aria-pressed'],'true');assert.equal(a.attributes['aria-pressed'],'false');assert.equal(calls.length,0);send.onclick();assert.equal(calls.length,1);assert.equal(calls[0].body.answers['Which?'],'B');assert.equal(calls[0].body.decisionId,'decision');
});
test('approval options keep tool details visible and send only the selected response',()=>{
 const calls=[];const task={id:'task',prompt:'Example',pendingDecision:{id:'d',kind:'approval',toolName:'Write',description:'Change a file',input:{path:'a.txt'}}};const ui=window.decisionUI(task,(url,body)=>calls.push(body));
 assert.match(ui.find(el=>el.tagName==='pre').textContent,/a.txt/);assert.equal(ui.find(el=>el.dataset.focusKey==='decision-option:allow').dataset.defaultApproval,'');assert.equal(calls.length,0);ui.find(el=>el.dataset.focusKey==='decision-option:deny').onclick();assert.equal(calls[0].type,'deny');
});
