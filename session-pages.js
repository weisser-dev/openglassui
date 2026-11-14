// Convert provider content into safe, bounded page entries. Tool text and paths
// are never exposed; images must be embedded raster data in the session itself.
const signatures={ 'image/png':'89504e470d0a1a0a','image/jpeg':'ffd8ff','image/gif':'47494638','image/webp':'52494646' };
function image(part){
 const source=part?.source;if(part?.type!=='image'||source?.type!=='base64'||!Object.hasOwn(signatures,source.media_type)||typeof source.data!=='string'||source.data.length>1400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(source.data))return null;
 const bytes=Buffer.from(source.data,'base64');if(bytes.length>1024*1024||!bytes.subarray(0,8).toString('hex').startsWith(signatures[source.media_type]))return null;
 if(source.media_type==='image/webp'&&bytes.subarray(8,12).toString()!=='WEBP')return null;
 return `data:${source.media_type};base64,${bytes.toString('base64')}`;
}
export function sessionPageEntries(session){
 const rows=[];const add=(role,content)=>{const parts=typeof content==='string'?[{type:'text',text:content}]:Array.isArray(content)?content:[];const text=parts.filter(p=>p?.type==='text'&&typeof p.text==='string').map(p=>p.text).join('\n').replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi,'').trim();const images=[];for(const part of parts){const direct=image(part);if(direct)images.push(direct);if(part?.type==='tool_result'&&Array.isArray(part.content))for(const nested of part.content){const found=image(nested);if(found)images.push(found);}}if(text||images.length)rows.push({role:!text&&parts.some(part=>part?.type==='tool_result')?'tool':role,text:text.slice(-100000),...(images.length?{images:images.slice(0,4)}:{})});};
 if(Array.isArray(session))for(const row of session){if(row?.type==='user'||row?.type==='assistant')add(row.type,row.message?.content);}else if(Array.isArray(session?.turns))for(const turn of session.turns)for(const item of turn.items||[]){if(item.type==='userMessage')add('user',item.content);else if(item.type==='agentMessage')add('assistant',item.text);}
 return rows;
}
export function getSessionPage(session,{before,limit=10}={}){const rows=sessionPageEntries(session);const end=before===undefined?rows.length:Math.min(before,rows.length),start=Math.max(0,end-limit);return {messages:rows.slice(start,end),nextBefore:start>0?start:null,total:rows.length};}
