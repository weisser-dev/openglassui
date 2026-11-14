import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

// Only explicitly launched child processes are managed. Public URLs are not credentials.
export function createTunnelManager({port,spawnProcess=spawn,platform=process.platform,exists=existsSync}) {
 let child=null, startupTimer=null, state={status:'stopped',provider:null,url:null,error:null};
 function stop(){const old=child;child=null;clearTimeout(startupTimer);startupTimer=null;if(old)old.kill('SIGTERM');state={status:'stopped',provider:null,url:null,error:null};return state;}
 function start(provider){
  if(child)throw new Error('A connection is already running or starting.');
  if(!['cloudflare','ngrok','tailscale-funnel'].includes(provider))throw new Error('Unknown tunnel provider.');
  const macTailscale='/Applications/Tailscale.app/Contents/MacOS/Tailscale';
  const command=provider==='cloudflare'?'cloudflared':provider.startsWith('tailscale')?(platform==='darwin'&&exists(macTailscale)?macTailscale:'tailscale'):'ngrok';
  const args=provider==='cloudflare'?['tunnel','--url',`http://127.0.0.1:${port}`]:provider.startsWith('tailscale')?['funnel',`http://127.0.0.1:${port}`]:['http',String(port),'--log','stdout','--log-format','json'];
  state={status:'starting',provider,url:null,error:null};
  const process=spawnProcess(command,args,{stdio:['ignore','pipe','pipe'],shell:false}); child=process;
  function setDeadline(ms){clearTimeout(startupTimer);startupTimer=setTimeout(()=>{if(child!==process || state.status!=='starting')return;child=null;process.kill('SIGTERM');state={status:'failed',provider,url:null,error:provider.startsWith('tailscale')?'Tailscale did not start. Check that Tailscale is connected, HTTPS is enabled for your tailnet, and Funnel is available.':'Tunnel did not start. Check the provider installation and sign-in.'};},ms);startupTimer.unref();}setDeadline(30000);
  let buffer='';
  const read=chunk=>{if(child!==process)return;buffer=(buffer+chunk.toString()).slice(-10000);if(provider.startsWith('tailscale')&&!state.approvalUrl){const approval=buffer.match(/https:\/\/login\.tailscale\.com\/f\/[a-z0-9_-]+(?:\?[a-z0-9_.~%=&-]+)?(?=[\s"'<>]|$)/i)?.[0];if(approval){state={...state,approvalUrl:approval};setDeadline(120000);}}const matches=buffer.match(/https:\/\/[a-z0-9-]+\.(?:[a-z0-9-]+\.ts\.net|trycloudflare\.com|ngrok-free\.app|ngrok-free\.dev|ngrok\.io|ngrok\.app|ngrok\.dev)(?![a-z0-9.:-])/ig) || [];for(const url of matches){const host=new URL(url).hostname;if((provider==='cloudflare'&&host.endsWith('.trycloudflare.com'))||(provider==='ngrok'&&/\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.io|ngrok\.app|ngrok\.dev)$/.test(host))||(provider.startsWith('tailscale')&&/^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/.test(host))){clearTimeout(startupTimer);startupTimer=null;state={status:'running',provider,url,error:null};}}};
  process.stdout?.on('data',read);process.stderr?.on('data',read);
  process.on('error',error=>{if(child!==process)return;child=null;clearTimeout(startupTimer);startupTimer=null;state={status:'failed',provider,url:null,error:error.code==='ENOENT'?`${command} is not installed or not in PATH.`:'The connection could not be started.'};});
  process.on('close',code=>{if(child!==process)return;child=null;clearTimeout(startupTimer);startupTimer=null;state={status:'failed',provider,url:null,error:`Connection ended (code ${code ?? 'unknown'}). Check installation and sign-in.${provider.startsWith('tailscale')?' Tailscale also requires HTTPS and an available Funnel configuration.':''}`};});
  return state;
 }
 return {start,stop,status:()=>({...state})};
}
