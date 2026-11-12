import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('setup translations default to English and support German',async()=>{
 const values=new Map();const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const context=vm.createContext({window:{},localStorage});vm.runInContext(await readFile(new URL('../public/i18n.js',import.meta.url),'utf8'),context);
 const i18n=context.window.openGlassI18n;assert.equal(i18n.get(),'en');assert.equal(i18n.t('Continue'),'Continue');i18n.set('de');assert.equal(i18n.t('Continue'),'Weiter');assert.equal(i18n.t('Untranslated'),'Untranslated');
});
test('wearable labels switch language without translating user content',async()=>{
 const values=new Map();const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const context=vm.createContext({window:{},localStorage});vm.runInContext(await readFile(new URL('../public/i18n.js',import.meta.url),'utf8'),context);vm.runInContext(await readFile(new URL('../public/glass-i18n.js',import.meta.url),'utf8'),context);
 assert.equal(context.glassTranslate('Settings'),'Settings');context.window.openGlassI18n.set('de');assert.equal(context.glassTranslate('Settings'),'Einstellungen');assert.equal(context.glassTranslate('Open dictation or handwriting'),'Diktat oder Handschrift öffnen');assert.equal(context.glassTranslate('A custom user task'),'A custom user task');
});
