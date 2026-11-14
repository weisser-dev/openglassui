import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('pairing tree reveals the original QR without altering its contents',async()=>{
 const make=tag=>({tag,children:[],attributes:{},hidden:false,style:{setProperty(){}},append(...nodes){this.children.push(...nodes)},setAttribute(key,value){this.attributes[key]=value},addEventListener(_event,fn){this.click=fn}});
 const document={createElement:make},window={};const source=await readFile(new URL('../public/usage.js',import.meta.url),'utf8');vm.runInNewContext(source.slice(source.indexOf('window.createPairingTree=')),{window,document});
 const qr=make('img');qr.src='data:image/png;base64,example';const tree=window.createPairingTree(qr);const [art,reveal,button]=tree.children;
 assert.equal(reveal.hidden,true);assert.equal(reveal.children[0],qr);art.click();assert.equal(reveal.hidden,false);assert.equal(art.hidden,true);assert.equal(qr.src,'data:image/png;base64,example');assert.equal(button.attributes['aria-expanded'],'true');button.click();assert.equal(reveal.hidden,true);tree.resetPairingTree();assert.equal(art.hidden,false);
});
