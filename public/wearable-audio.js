// Optional browser speech. Availability does not guarantee audio on a wearable.
function createWearableAudio(speech,Utterance){
 const available=Boolean(speech && typeof speech.speak==='function' && typeof Utterance==='function');
 return {available,stop(){if(available&&typeof speech.cancel==='function')speech.cancel();},speak(text,onError=()=>{}){if(!available||typeof text!=='string'||!text.trim())return false;try{if(typeof speech.cancel==='function')speech.cancel();const utterance=new Utterance(text.slice(-1500));utterance.onerror=()=>onError('Speech playback failed on this device.');speech.speak(utterance);return true;}catch{onError('Speech playback is unavailable on this device.');return false;}}};
}
