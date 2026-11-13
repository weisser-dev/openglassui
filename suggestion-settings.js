import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
export const defaultSuggestionPrompt='Review the user’s request and recent exchange. Identify what was done, what remains open, and any explicit question. Suggest three distinct, useful replies in the user’s language, using one to three sentences when more detail would help. Do not claim that an action happened or that a permission was granted unless the context says so.';
export const defaultSuggestionSettings={provider:'claude',model:'',maxMessages:12,maxChars:36000,prompt:defaultSuggestionPrompt};
export function validateSuggestionSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid suggestion settings.');
 value={...defaultSuggestionSettings,...value};
 if(typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>2000||value.provider!=='claude'||typeof value.model!=='string'||value.model.length>160||!/^[-a-zA-Z0-9_.:]*$/.test(value.model)||!Number.isInteger(value.maxMessages)||value.maxMessages<2||value.maxMessages>50||!Number.isInteger(value.maxChars)||value.maxChars<2000||value.maxChars>200000)throw new Error('Invalid suggestion settings.');
 return {provider:value.provider,model:value.model,maxMessages:value.maxMessages,maxChars:value.maxChars,prompt:value.prompt.trim()};
}
export function createSuggestionSettings(dataDir){const file=path.join(dataDir,'suggestion-settings.json');let queue=Promise.resolve();return {
 async read(){try{return validateSuggestionSettings(JSON.parse(await readFile(file,'utf8')));}catch(error){if(error.code==='ENOENT')return {...defaultSuggestionSettings};throw error;}},
 async write(input){const settings=validateSuggestionSettings(input);queue=queue.catch(()=>{}).then(async()=>{const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(settings,null,2)+'\n',{mode:0o600});await rename(tmp,file);});await queue;return settings;}
};}
