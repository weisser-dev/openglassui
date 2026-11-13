// Provider session formats contain tool payloads and metadata alongside chat.
// Keep the overview readable and avoid presenting those payloads as messages.
export function formatSession(session,agent){
 const rows=[];
 const text=value=>typeof value==='string'?value:Array.isArray(value)?value.filter(part=>part?.type==='text' && typeof part.text==='string').map(part=>part.text).join('\n'):'';
 const add=(role,content)=>{const value=text(content).replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi,'').trim();if(value)rows.push(`${role}\n${value}`);};
 if(Array.isArray(session)){
  for(const message of session){if(message?.type==='user')add('DU',message.message?.content);else if(message?.type==='assistant')add(agent.toUpperCase(),message.message?.content);}
 }else if(Array.isArray(session?.turns)){
  for(const turn of session.turns)for(const item of turn.items || []){if(item.type==='userMessage')add('DU',item.content);else if(item.type==='agentMessage')add('CODEX',item.text);}
 }
 return rows.join('\n\n').slice(-100000) || 'Keine Textnachrichten in diesem Verlauf verfügbar.';
}
