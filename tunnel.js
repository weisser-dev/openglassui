import { spawn } from 'node:child_process';

// Only explicitly launched child processes are managed. Public URLs are not credentials.
export function createTunnelManager({port,spawnProcess=spawn}) {
 let child=null, state={status:'stopped',provider:null,url:null,error:null};
 function stop(){const old=child;child=null;if(old)old.kill('SIGTERM');state={status:'stopped',provider:null,url:null,error:null};return state;}
 function start(provider){
  if(child)throw new Error('Ein Tunnel läuft bereits.');
  if(!['cloudflare','ngrok'].includes(provider))throw new Error('Unbekannter Tunnelanbieter.');
  const command=provider==='cloudflare'?'cloudflared':'ngrok';
  const args=provider==='cloudflare'?['tunnel','--url',`http://127.0.0.1:${port}`]:['http',String(port),'--log','stdout','--log-format','json'];
  state={status:'starting',provider,url:null,error:null};
  const process=spawnProcess(command,args,{stdio:['ignore','pipe','pipe'],shell:false}); child=process;
  let buffer='';
  const read=chunk=>{if(child!==process)return;buffer=(buffer+chunk.toString()).slice(-10000);const matches=buffer.match(/https:\/\/[a-z0-9-]+\.(?:trycloudflare\.com|ngrok-free\.app|ngrok-free\.dev|ngrok\.io|ngrok\.app|ngrok\.dev)(?![a-z0-9.:-])/ig) || [];for(const url of matches){const host=new URL(url).hostname;if((provider==='cloudflare'&&host.endsWith('.trycloudflare.com'))||(provider==='ngrok'&&/\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.io|ngrok\.app|ngrok\.dev)$/.test(host)))state={status:'running',provider,url,error:null};}};
  process.stdout?.on('data',read);process.stderr?.on('data',read);
  process.on('error',error=>{if(child!==process)return;child=null;state={status:'failed',provider,url:null,error:error.code==='ENOENT'?`${command} ist nicht installiert oder nicht im PATH.`:'Tunnel konnte nicht gestartet werden.'};});
  process.on('close',code=>{if(child!==process)return;child=null;state={status:'failed',provider,url:null,error:`Tunnel beendet (Code ${code ?? 'unbekannt'}). Prüfe Installation und Anmeldung.`};});
  return state;
 }
 return {start,stop,status:()=>({...state})};
}
