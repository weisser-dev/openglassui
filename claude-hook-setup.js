import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const quote=value=>`'${String(value).replaceAll("'", "'\\''")}'`;
// Explicit opt-in. Merge without replacing any unrelated Claude settings or hooks.
export async function enableClaudePermissionHook({configDir=process.env.CLAUDE_CONFIG_DIR||path.join(homedir(),'.claude'),node=process.execPath,platform=process.platform}={}){
 if(platform==='win32')throw new Error('Automatic Claude hook setup currently supports macOS and Linux only.');
 const file=path.join(configDir,'settings.json');let settings={};try{settings=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||settings.hooks&&(typeof settings.hooks!=='object'||Array.isArray(settings.hooks)))throw new Error('Invalid Claude settings. No changes made.');
 const hookPath=fileURLToPath(new URL('./bin/claude-permission-hook.js',import.meta.url)),command=`${quote(node)} ${quote(hookPath)}`;
 settings.hooks ||= {};const existing=settings.hooks.PermissionRequest||[];if(!Array.isArray(existing))throw new Error('Invalid PermissionRequest hooks. No changes made.');
 if(!existing.some(group=>Array.isArray(group.hooks)&&group.hooks.some(hook=>hook.command===command)))existing.push({hooks:[{type:'command',command,timeout:120}]});settings.hooks.PermissionRequest=existing;
 await mkdir(configDir,{recursive:true,mode:0o700});const temp=path.join(configDir,`.openglassui-settings-${process.pid}.tmp`);await writeFile(temp,JSON.stringify(settings,null,2)+'\n',{mode:0o600});await rename(temp,file);return file;
}
