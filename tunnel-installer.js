import {spawn} from 'node:child_process';
// An explicit local user action can install one fixed Homebrew formula only.
export function createCloudflaredInstaller({platform=process.platform,spawnProcess=spawn}={}){
 let child=null,state={status:'idle',error:null};
 function start(){
  if(platform!=='darwin')throw new Error('Homebrew installation is available on macOS only.');
  if(child)throw new Error('Installation is already running.');
  state={status:'installing',error:null};
  try{child=spawnProcess('brew',['install','cloudflared'],{stdio:['ignore','ignore','ignore'],shell:false,env:{...process.env,HOMEBREW_NO_AUTO_UPDATE:'1',HOMEBREW_NO_INSTALL_CLEANUP:'1'}});}catch{state={status:'failed',error:'Could not start Homebrew. Install cloudflared using the official instructions.'};return state;}
  const current=child;current.on('error',()=>{if(child!==current)return;child=null;state={status:'failed',error:'Could not start Homebrew. Check that brew is installed and in PATH.'};});
  current.on('close',code=>{if(child!==current)return;child=null;state=code===0?{status:'completed',error:null}:{status:'failed',error:'Homebrew could not install cloudflared. Run brew install cloudflared in Terminal to see details.'};});
  return state;
 }
 return {start,status:()=>({...state})};
}
