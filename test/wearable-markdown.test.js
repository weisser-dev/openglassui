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

test('representative agent replies remain readable on a narrow display',async()=>{
 const source=await readFile(new URL('../public/glass.js',import.meta.url),'utf8'),start=source.indexOf('function renderWearableMarkdown('),end=source.indexOf('\nfunction buildChat(',start);
 const make=tag=>({tag,children:[],className:'',append(...items){this.children.push(...items)},textContent:'',addEventListener(){}}),document={createElement:make,createTextNode:text=>({tag:'#text',textContent:text})},context=vm.createContext({document});vm.runInContext(source.slice(start,end),context);
 const render=text=>{const out=make('pre');context.renderWearableMarkdown(out,text);return out;},find=(node,predicate)=>[...(predicate(node)?[node]:[]),...(node.children||[]).flatMap(child=>find(child,predicate))];
 const table=render('| Task | Status |\n| :--- | ---: |\n| Build | **Passed** |\n| Tests | 12/12 |');const rows=find(table,n=>n.className==='markdown-table-row');assert.equal(rows.length,2);assert.equal(rows[0].children[0].textContent,'Task: ');assert.equal(rows[0].children[3].textContent,'Status: ');assert.ok(find(rows[0],n=>n.tag==='strong'&&n.children.some(c=>c.textContent==='Passed')).length);
 const code=render('Here is code:\n```js\nconst result = "a | b";\n  console.log(result);\n```\nDone.');const blocks=find(code,n=>n.className==='markdown-code-block');assert.equal(blocks.length,1);assert.equal(find(blocks[0],n=>n.tag==='code')[0].textContent,'const result = "a | b";\n  console.log(result);');assert.equal(find(blocks[0],n=>n.className==='markdown-code-language')[0].textContent,'js');assert.ok(find(code,n=>n.textContent==='Done.').length);
 const checklist=render('- [x] Done\n- [ ] Still open\n1. First\n2. Second\n> Note');const all=find(checklist,n=>n.tag==='#text').map(n=>n.textContent).join('');assert.match(all,/☑ /);assert.match(all,/☐ /);assert.match(all,/1\. /);assert.match(all,/│ /);
 const escaped=render('| Name | Value |\n| --- | --- |\n| A \\| B | 3 |');assert.ok(find(escaped,n=>n.textContent==='A | B').length);
 const unsafe=render('[Unsafe](javascript:alert(1)) <script>alert(1)</script>');assert.equal(find(unsafe,n=>n.tag==='a').length,0);assert.ok(find(unsafe,n=>n.textContent.includes('<script>')).length);
 const long=render('Long line: '+ 'word '.repeat(1000));assert.ok(find(long,n=>n.textContent.includes('word '.repeat(100))).length);
});
