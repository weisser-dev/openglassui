import {runKiro,listGenericAcpSessions,readGenericAcpSession} from './kiro.js';

// Internal client interface for a trusted, locally installed ACP v1 executable.
// Adapters do not execute shell commands and must surface unsupported capabilities.
export function createAcpClient(agent){
 if(!agent || agent.type!=='acp' || typeof agent.id!=='string' || typeof agent.name!=='string' || typeof agent.command!=='string' || !Array.isArray(agent.args) || !agent.args.every(arg=>typeof arg==='string'))throw new Error('Invalid ACP agent configuration.');
 return {
  run(options){return runKiro({...options,command:agent.command,args:agent.args,agentName:agent.name});},
  listSessions(workspace){return listGenericAcpSessions(agent,workspace);},
  discoverSessions(workspace){return listGenericAcpSessions(agent,workspace,true);},
  readSession(workspace,id){return readGenericAcpSession(agent,workspace,id);}
 };
}
