// Legacy output can contain mixed turns and tool logs; keep it labelled as a transcript.
export function startConversationTurn(task,prompt){
 if(!Array.isArray(task.messages)){
  task.messages=[];
  if(task.prompt && task.prompt!=='Importierte Sitzung')task.messages.push({role:'user',text:task.prompt});
  if(task.output)task.messages.push({role:'transcript',text:task.output});
  if(!task.output && task.prompt===prompt)return;
 }
 task.messages.push({role:'user',text:prompt});
 if(task.messages.length>200)task.messages.splice(0,task.messages.length-200);
}
export function appendAssistantText(task,text){
 if(!text)return;
 const messages=task.messages ||= [],last=messages.at(-1);
 if(last?.role==='assistant')last.text=(last.text+text).slice(-100000);
 else messages.push({role:'assistant',text:text.slice(-100000)});
}
