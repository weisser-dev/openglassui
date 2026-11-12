import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/spatial.js',import.meta.url),'utf8'),context);
const rect=(x,y,w=100,h=40)=>({left:x,top:y,right:x+w,bottom:y+h,width:w,height:h});
test('directional navigation follows geometry rather than document order',()=>{
 const origin=rect(0,0);const candidates=[rect(0,100),rect(120,0),rect(0,50),origin];
 assert.equal(context.spatialTarget(origin,candidates,'ArrowDown'),2);
 assert.equal(context.spatialTarget(origin,candidates,'ArrowRight'),1);
 assert.equal(context.spatialTarget(origin,candidates,'ArrowLeft'),-1);
 assert.equal(context.spatialTarget(rect(120,0),candidates,'ArrowLeft'),3);
});
