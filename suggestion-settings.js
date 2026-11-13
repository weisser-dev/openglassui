import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
export const defaultSuggestionSettings={provider:'claude',model:'',maxMessages:6,maxChars:12000};
export function validateSuggestionSettings(value){
 if(!value||value.provider!=='claude'||typeof value.model!=='string'||value.model.length>160||!/^[-a-zA-Z0-9_.:]*$/.test(value.model)||!Number.isInteger(value.maxMessages)||value.maxMessages<2||value.maxMessages>20||!Number.isInteger(value.maxChars)||value.maxChars<2000||value.maxChars>50000)throw new Error('Invalid suggestion settings.');
 return {provider:value.provider,model:value.model,maxMessages:value.maxMessages,maxChars:value.maxChars};
}
export function createSuggestionSettings(dataDir){const file=path.join(dataDir,'suggestion-settings.json');let queue=Promise.resolve();return {
 async read(){try{return validateSuggestionSettings(JSON.parse(await readFile(file,'utf8')));}catch(error){if(error.code==='ENOENT')return {...defaultSuggestionSettings};throw error;}},
 async write(input){const settings=validateSuggestionSettings(input);queue=queue.catch(()=>{}).then(async()=>{const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(settings,null,2)+'\n',{mode:0o600});await rename(tmp,file);});await queue;return settings;}
};}
