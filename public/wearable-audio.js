// Read the complete response in bounded sections. Never send text to a service.
function splitWearableText(text, limit=600){
 const parts=[];let remaining=String(text||'');
 while(remaining.length>limit){let cut=-1;for(let i=limit-1;i>=Math.floor(limit/3);i--){if(/\s/.test(remaining[i])){cut=i+1;break;}}if(cut<0)cut=limit;parts.push(remaining.slice(0,cut));remaining=remaining.slice(cut);}
 if(remaining)parts.push(remaining);return parts;
}
function createWearableAudio(speech,Utterance){
 const available=Boolean(speech && typeof speech.speak==='function' && typeof Utterance==='function');
 let run=0,playing=false,paused=false;
 const api={available,get playing(){return playing;},get paused(){return paused;},
  stop(){run++;playing=false;paused=false;if(available&&typeof speech.cancel==='function')speech.cancel();},
  togglePause(){if(!playing)return false;if(!paused&&typeof speech.pause==='function'){speech.pause();paused=true;return true;}if(paused&&typeof speech.resume==='function'){speech.resume();paused=false;return true;}return false;},
  speak(text,onError=()=>{},language='',onEnd=()=>{},onPart=()=>{}){
   if(!available||typeof text!=='string'||!text.trim())return false;
   api.stop();const id=run,parts=splitWearableText(text,1500);playing=true;
   const next=index=>{if(id!==run)return;if(index>=parts.length){playing=false;paused=false;onEnd();return;}try{const utterance=new Utterance(parts[index]);if(language){utterance.lang=language;const voices=typeof speech.getVoices==='function'?speech.getVoices():[];const voice=voices.find(v=>v.lang?.toLowerCase()===language.toLowerCase())||voices.find(v=>v.lang?.toLowerCase().split('-')[0]===language.toLowerCase().split('-')[0]);if(voice)utterance.voice=voice;}utterance.onend=()=>next(index+1);utterance.onerror=()=>{if(id===run){playing=false;onError('Speech playback failed on this device.');}};onPart(index+1,parts.length);speech.speak(utterance);}catch{playing=false;onError('Speech playback is unavailable on this device.');}};
   next(0);return playing;
  }};return api;
}
