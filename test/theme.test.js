import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('themes default safely, persist per origin and follow storage changes',async()=>{
 const values=new Map(),events={},root={dataset:{}},select={value:''};
 const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const document={documentElement:root,querySelectorAll:()=>[select],addEventListener(){}};
 const window={addEventListener:(name,fn)=>events[name]=fn};
 const context=vm.createContext({window,document,localStorage});vm.runInContext(await readFile(new URL('../public/theme.js',import.meta.url),'utf8'),context);
 assert.equal(root.dataset.theme,'default');window.OpenGlassTheme.set('hacker');assert.equal(root.dataset.theme,'hacker');assert.equal(values.get('openglass-theme'),'hacker');assert.equal(select.value,'hacker');
 events.storage({key:'openglass-theme',newValue:'light'});assert.equal(root.dataset.theme,'light');window.OpenGlassTheme.set('invalid');assert.equal(root.dataset.theme,'default');
});
