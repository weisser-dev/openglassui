// Provider histories contain tool payloads and metadata alongside conversation text.
export function formatSessionMessages(session){
 const rows=[];
 const text=value=>typeof value==='string'?value:Array.isArray(value)?value.filter(part=>part?.type==='text' && typeof part.text==='string').map(part=>part.text).join('\n'):'';
 const add=(role,content)=>{const value=text(content).replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi,'').trim();if(value)rows.push({role,text:value.slice(-100000)});};
 if(Array.isArray(session)){
  for(const message of session){if(message?.type==='user')add('user',message.message?.content);else if(message?.type==='assistant')add('assistant',message.message?.content);}
 }else if(Array.isArray(session?.turns)){
  for(const turn of session.turns)for(const item of turn.items || []){if(item.type==='userMessage')add('user',item.content);else if(item.type==='agentMessage')add('assistant',item.text);}
 }
 const recent=rows.slice(-100),bounded=[];let remaining=100000;for(let i=recent.length-1;i>=0&&remaining>0;i--){const item=recent[i],value=item.text.slice(-remaining);bounded.unshift({role:item.role,text:value});remaining-=value.length;}return bounded;
}
export function formatSession(session,agent){
 return formatSessionMessages(session).map(row=>`${row.role==='user'?'DU':agent.toUpperCase()}\n${row.text}`).join('\n\n').slice(-100000) || 'Keine Textnachrichten in diesem Verlauf verfügbar.';
}
