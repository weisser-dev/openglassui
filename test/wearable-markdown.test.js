import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('wearable formats common Markdown without interpreting HTML',async()=>{
 const source=await readFile(new URL('../public/glass.js',import.meta.url),'utf8');
 const start=source.indexOf('function renderWearableMarkdown('),end=source.indexOf('\nfunction buildChat(',start);
 const make=tag=>({tag,children:[],append(...items){this.children.push(...items)},textContent:''});
 const document={createElement:make,createTextNode:text=>({tag:'#text',textContent:text})};
 const context=vm.createContext({document});vm.runInContext(source.slice(start,end),context);
 const output=make('pre');context.renderWearableMarkdown(output,'## Heading\n- **Important** and `code`\n<script>alert(1)</script>');
 assert.ok(output.children.some(n=>n.tag==='strong'&&n.children.some(c=>c.textContent==='Heading')));
 assert.ok(output.children.some(n=>n.tag==='strong'&&n.textContent==='Important'));
 assert.ok(output.children.some(n=>n.tag==='code'&&n.textContent==='code'));
 assert.ok(output.children.some(n=>n.tag==='#text'&&n.textContent.includes('<script>')));
});
