// OpenGlassUI-managed tasks only. Older records fall back to creation time.
function recentChats(tasks, agents, projects, {limit=3,hours=24,now=Date.now()}={}){
 const allowedAgents=new Set(agents.map(agent=>agent.id)),allowedProjects=new Set(projects.map(project=>project.id));
 return tasks.filter(task=>allowedAgents.has(task.agentId)&&allowedProjects.has(task.projectId||'default'))
  .map(task=>({task,time:Date.parse(task.lastMessageAt || task.createdAt)}))
  .filter(({task,time})=>task.status==='running'||task.pendingDecision||(Number.isFinite(time)&&time<=now&&now-time<=hours*3600000))
  .sort((a,b)=>(b.task.pendingDecision?2:b.task.status==='running'?1:0)-(a.task.pendingDecision?2:a.task.status==='running'?1:0)||(Number.isFinite(b.time)?b.time:0)-(Number.isFinite(a.time)?a.time:0))
  .slice(0,limit).map(item=>item.task);
}
