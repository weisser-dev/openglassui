// Browser-only dashboard fixtures. No request is forwarded to a companion or third party.
(() => {
 const now=new Date().toISOString();let next=0;
 const projects=[{id:'default',name:'Hello world'}],agents=[{id:'codex',name:'Codex'},{id:'claude',name:'Claude Code'},{id:'kiro',name:'Kiro CLI'},{id:'opencode',name:'OpenCode'}];
 const tasks=[{id:'demo-task-1',agentId:'codex',agentName:'Codex',projectId:'default',projectName:'Hello world',prompt:'Create a hello world example',status:'completed',sessionId:'demo-session',createdAt:now,trackedMessages:1,pairedRequests:8,pairedCompleted:6,pairedSuggestionCount:12,pairedSuggestedWords:113,pairedSuggestionsAccepted:4,output:'Hello world! This is simulated output.'},{id:'demo-task-2',agentId:'claude',agentName:'Claude Code',projectId:'default',projectName:'Hello world',prompt:'Review the example project',status:'running',createdAt:now,trackedMessages:1,output:'Checking the project…'}];
 let suggestionSettings={provider:'claude',model:'haiku',maxMessages:12,maxChars:36000,prompt:'Review the user’s request and recent exchange. Identify what was done, what remains open, and any explicit question. Suggest three distinct, useful replies in the user’s language, using one to three sentences when more detail would help. Do not claim that an action happened or that a permission was granted unless the context says so.'};
 const devices=[{id:'demo-device',name:'Demo glasses',createdAt:now,pushEnabled:false}];let tunnel={status:'running',provider:'cloudflare',url:'https://demo.invalid'};
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const body=options=>{try{return JSON.parse(options?.body||'{}');}catch{return {};}};
 const state=()=>({revision:++next,workspace:'Demo workspace',agents,projects,tasks});
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),path=url.pathname,method=(options.method||'GET').toUpperCase();
  if(url.origin!==location.origin||!path.startsWith('/api/'))return json({error:'Network access is disabled in the demo.'},403);
  if(path==='/api/suggestion-settings'){if(method==='POST')suggestionSettings={...suggestionSettings,...body(options)};return json(suggestionSettings);}
  if(path==='/api/suggestion-models')return json({provider:'claude',models:[{id:'',name:'Provider default'},{id:'haiku',name:'Haiku 5.5'},{id:'sonnet',name:'Sonnet 5.5'}]});
  if(path==='/api/state')return json(state());
  if(path==='/api/devices')return json({devices});
  if(path==='/api/tunnel')return json(tunnel);
  if(path==='/api/tunnel/start'){tunnel={status:'running',provider:body(options).provider,url:'https://demo.invalid'};return json(tunnel);}
  if(path==='/api/tunnel/stop'){tunnel={status:'stopped'};return json(tunnel);}
  if(path==='/api/pairing'){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="white"/><text x="90" y="90" text-anchor="middle" fill="black">DEMO ONLY</text></svg>';return json({qr:'data:image/svg+xml,'+encodeURIComponent(svg),deepLink:'#',expiresIn:300});}
  if(path==='/api/revoke'){devices.splice(0);return json({ok:true});}
  const device=path.match(/^\/api\/devices\/([^/]+)\/(rename|revoke)$/);if(device){const index=devices.findIndex(item=>item.id===device[1]);if(index<0)return json({error:'Device not found'},404);if(device[2]==='revoke')devices.splice(index,1);else devices[index].name=String(body(options).name||'Demo device');return json({ok:true});}
  if(path==='/api/projects'&&method==='POST'){const project={id:'demo-project-'+(++next),name:String(body(options).name||'Example')};projects.push(project);return json(project);}
  const project=path.match(/^\/api\/projects\/([^/]+)\/remove$/);if(project){const index=projects.findIndex(p=>p.id===project[1]);if(index>0)projects.splice(index,1);return json({ok:true});}
  if(path==='/api/sessions')return json({sessions:[{id:'demo-session',agent:url.searchParams.get('agent'),title:'Hello world example'}]});
  if(path.startsWith('/api/sessions/')&&method==='GET')return json({text:'This is a simulated conversation.'});
  if(path==='/api/sessions/discover')return json({sessions:[]});
  if(path==='/api/sessions/open')return json({id:'demo-task-1'});
  if(path==='/api/tasks'&&method==='POST'){const data=body(options),agent=agents.find(item=>item.id===data.agentId);const task={id:'demo-task-'+(++next),agentId:data.agentId,agentName:agent?.name||'Demo agent',projectId:data.projectId,projectName:'Hello world',prompt:data.prompt,status:'completed',sessionId:'demo-session',createdAt:now,trackedMessages:1,output:'This is a simulated response.'};tasks.unshift(task);return json(task);}
  if(/^\/api\/tasks\/[^/]+\/(resume|stop|decision)$/.test(path)){const id=path.split('/')[3],task=tasks.find(item=>item.id===id);if(!task)return json({error:'Task not found'},404);if(path.endsWith('/stop'))task.status='stopped';if(path.endsWith('/resume')){task.status='completed';task.output+='\nThis is a simulated follow-up.';}return json(task);}
  return json({error:'This action is not available in the demo.'},404);
 };
 document.addEventListener('DOMContentLoaded',()=>{const setup=document.querySelector('#setup-open');if(setup){setup.disabled=true;setup.textContent='Setup is unavailable in the demo';}const discovery=document.querySelector('#discover-sessions');if(discovery)discovery.onclick=()=>{document.querySelector('#discovery-results').textContent='No additional simulated sessions.';};});
})();
