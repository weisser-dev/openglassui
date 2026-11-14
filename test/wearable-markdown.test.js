import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('wearable formats common Markdown without interpreting HTML',async()=>{
 const source=await readFile(new URL('../public/glass.js',import.meta.url),'utf8');
 const start=source.indexOf('function renderWearableMarkdown('),end=source.indexOf('\nfunction buildChat(',start);
 const make=tag=>({tag,children:[],append(...items){this.children.push(...items)},textContent:'',addEventListener(){}});
 const document={createElement:make,createTextNode:text=>({tag:'#text',textContent:text})};
 const context=vm.createContext({document});vm.runInContext(source.slice(start,end),context);
 const output=make('pre');context.renderWearableMarkdown(output,'## Heading\n- **Important** and `code`\n*emphasis* and ~~old~~\n<script>alert(1)</script>\n[Example](https://example.com)');
 assert.ok(output.children.some(n=>n.tag==='strong'&&n.children.some(c=>c.textContent==='Heading')));
 assert.ok(output.children.some(n=>n.tag==='strong'&&n.children.some(c=>c.textContent==='Important')));
 assert.ok(output.children.some(n=>n.tag==='code'&&n.textContent==='code'));
 assert.ok(output.children.some(n=>n.tag==='em'&&n.children.some(c=>c.textContent==='emphasis')));
 assert.ok(output.children.some(n=>n.tag==='s'&&n.children.some(c=>c.textContent==='old')));
 assert.ok(output.children.some(n=>n.tag==='#text'&&n.textContent.includes('<script>')));
 assert.ok(output.children.some(n=>n.tag==='a'&&n.href==='https://example.com'&&n.rel==='noopener noreferrer'));
});
