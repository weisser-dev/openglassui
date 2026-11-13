#!/usr/bin/env node
// Optional Claude Code PermissionRequest bridge. Fail open to Claude's own prompt,
// never approve unless a paired OpenGlassUI user explicitly chose Allow once.
let raw='';
try {
 for await (const chunk of process.stdin) { raw+=chunk; if(raw.length>15000) throw new Error('Hook input too large'); }
 const input=JSON.parse(raw),port=Number(process.env.OPENGLASS_PORT||4173);
 if(!Number.isInteger(port)||port<1||port>65535||input.hook_event_name!=='PermissionRequest') throw new Error('Invalid request');
 const origin=`http://127.0.0.1:${port}`;
 const response=await fetch(`${origin}/api/hooks/claude/permission`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(input),signal:AbortSignal.timeout(115000)});
 if(!response.ok)throw new Error('Bridge unavailable');
 const result=await response.json();
 if(result.type==='allow'||result.type==='deny'||(result.type==='answer'&&input.tool_name==='AskUserQuestion'&&result.answers)) {
  const decision=result.type==='deny'?{behavior:'deny',message:'Denied by user in OpenGlassUI.'}:{behavior:'allow'};
  if(result.type==='answer'&&input.tool_name==='AskUserQuestion'&&result.answers)decision.updatedInput={...input.tool_input,answers:result.answers};
  process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PermissionRequest',decision}}));
 } else process.stdout.write('{}');
} catch {process.stdout.write('{}');}
