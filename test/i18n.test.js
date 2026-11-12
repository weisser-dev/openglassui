import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('setup translations default to English and support German',async()=>{
 const values=new Map();const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const context=vm.createContext({window:{},localStorage});vm.runInContext(await readFile(new URL('../public/i18n.js',import.meta.url),'utf8'),context);
 const i18n=context.window.openGlassI18n;assert.equal(i18n.get(),'en');assert.equal(i18n.t('Continue'),'Continue');i18n.set('de');assert.equal(i18n.t('Continue'),'Weiter');assert.equal(i18n.t('Untranslated'),'Untranslated');
});
