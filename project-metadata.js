import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const exec=promisify(execFile);
export function safeRepositoryLabel(remote){
 if(typeof remote!=='string')return null;
 let host,pathname;
 try{const url=new URL(remote);if(!['https:','http:','ssh:','git:'].includes(url.protocol))return null;host=url.hostname;pathname=url.pathname;}catch{const match=remote.match(/^(?:[^@/:]+@)?([a-z0-9.-]+):(.+)$/i);if(!match)return null;host=match[1];pathname=match[2];}
 const parts=pathname.replace(/\.git\/?$/i,'').split('/').filter(Boolean);if(parts.length<2)return null;const tail=parts.slice(-2);if(!/^[a-z0-9.-]+$/i.test(host)||tail.some(part=>!/^[a-z0-9_.-]+$/i.test(part)))return null;return `${host}/${tail.join('/')}`;
}
export async function readProjectRepository(directory){
 try{const {stdout}=await exec('git',['-C',directory,'rev-parse','--show-toplevel'],{timeout:3000,maxBuffer:65536});const root=stdout.trim();let remote='';try{remote=(await exec('git',['-C',root,'config','--get','remote.origin.url'],{timeout:3000,maxBuffer:65536})).stdout.trim();}catch{}return safeRepositoryLabel(remote)||path.basename(root)||null;}catch{return null;}
}
