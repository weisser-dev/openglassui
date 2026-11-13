// Fictional browser-only data; never contacts the companion or an agent.
window.OPENGLASS_DEMO=true;
const demoModels={codex:[{id:'demo-codex-standard',name:'Demo Codex Standard'},{id:'demo-codex-fast',name:'Demo Codex Fast'}],claude:[{id:'demo-claude-standard',name:'Demo Claude Standard'},{id:'demo-claude-fast',name:'Demo Claude Fast'}]};
function demoTask(agentId,agentName,id,model){return {id,agentId,agentName,projectId:'demo-project',projectName:'Hello world',prompt:'Create a hello world example',status:'completed',model,createdAt:new Date().toISOString(),lastMessageAt:new Date().toISOString(),sessionId:id,messages:[{role:'user',text:'Create a hello world example'},{role:'assistant',text:'Here is a hello world example:\n\nconsole.log("Hello, world!");\n\nThis is fictional demo data.'}]};}
window.openGlassDemoState={revision:1,agents:[{id:'codex',name:'Codex'},{id:'claude',name:'Claude Code'},{id:'kiro',name:'Kiro CLI'},{id:'opencode',name:'OpenCode'}],projects:[{id:'demo-project',name:'Hello world'}],tasks:[demoTask('codex','Codex','demo-codex-chat','demo-codex-standard'),demoTask('claude','Claude Code','demo-claude-chat','demo-claude-standard')]};
// A fictional decision demonstrates the real wearable controls.
window.openGlassDemoState.tasks[0].status='running';
window.openGlassDemoState.tasks[0].pendingDecision={id:'demo-decision',kind:'question',input:{questions:[{question:'How should the example be formatted?',options:[{label:'Keep it simple',description:'Use one short example'},{label:'Add an explanation',description:'Include a short explanation'}]}]}};
window.openGlassDemoApi=async(url,options={})=>{
 if(url==='/api/state')return window.openGlassDemoState;
 if(url.startsWith('/api/models')){const agent=/[?&]agent=([^&]+)/.exec(url)?.[1],models=demoModels[agent]||[];return {supported:models.length>0,models};}
 if(url.startsWith('/api/sessions?'))return {sessions:[]};
 if(url==='/api/tasks'){const input=JSON.parse(options.body),id=`demo-${Date.now()}`;window.openGlassDemoState.tasks.unshift({id,agentId:input.agentId,agentName:window.openGlassDemoState.agents.find(a=>a.id===input.agentId)?.name||'Agent',projectId:input.projectId,projectName:'Hello world',prompt:input.prompt,status:'completed',model:input.model,createdAt:new Date().toISOString(),lastMessageAt:new Date().toISOString(),sessionId:id,messages:[{role:'user',text:input.prompt},{role:'assistant',text:'This is a simulated response. No agent was contacted.'}]});return {id};}
 if(url.match(/^\/api\/tasks\/[^/]+\/decision$/)){const task=window.openGlassDemoState.tasks.find(t=>url.includes(t.id));if(task){delete task.pendingDecision;task.status='completed';task.messages.push({role:'assistant',text:'Example decision received. This is simulated data.'});}return {ok:true};}
 if(url.match(/^\/api\/tasks\/[^/]+\/resume$/)){const task=window.openGlassDemoState.tasks.find(t=>url.includes(t.id));if(task){const input=JSON.parse(options.body);if(input.model)task.model=input.model;task.messages.push({role:'user',text:input.prompt},{role:'assistant',text:'This is a simulated response.'});}return {ok:true};}
 throw new Error('Unavailable in the browser-only demo.');
};
