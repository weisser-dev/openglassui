window.decisionUI=function(task,post,t=value=>value){
 const d=task.pendingDecision,box=document.createElement('section');box.className='decision';box.dataset.decisionId=d.id;box.setAttribute('aria-label',t('Decision required'));
 const heading=document.createElement('h3');heading.textContent=['approval','kiro_permission'].includes(d.kind)?t('Approval required'):`${task.agentName} ${t('asks')}`;box.append(heading);
 const context=document.createElement('p');context.textContent=`${t('Task')}: ${task.prompt}`;box.append(context);
 const control=(label,key,action)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.focusKey=key;button.onclick=action;return button;};
 if(d.kind==='kiro_permission'||d.kind==='approval'){
  const details=document.createElement('pre');details.textContent=d.kind==='kiro_permission'?JSON.stringify(d.input.toolCall,null,2):`${d.toolName}\n${d.description||''}\n${JSON.stringify(d.input,null,2)}`;details.tabIndex=0;details.dataset.focusKey='decision-details';details.setAttribute('aria-label',t('Approval details. Use up and down to scroll.'));box.append(details);
  if(d.kind==='kiro_permission')for(const option of d.input.options){const choice=control(option.name || (option.kind==='allow_once'?t('Allow once'):t('Deny')),`decision-option:${option.optionId}`,()=>post(`/api/tasks/${task.id}/decision`,{decisionId:d.id,type:'choice',optionId:option.optionId}));if(option.kind==='allow_once')choice.dataset.defaultApproval='';box.append(choice);}
  else for(const [type,label] of [['deny','Deny'],['allow','Allow once']]){const choice=control(t(label),`decision-option:${type}`,()=>post(`/api/tasks/${task.id}/decision`,{decisionId:d.id,type}));if(type==='allow')choice.dataset.defaultApproval='';box.append(choice);}
 }else{
  const form=document.createElement('form'),questions=d.input?.questions||[],answers=new Map();
  form.onsubmit=event=>event.preventDefault();
  questions.forEach((q,i)=>{const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=q.question;field.append(legend);const choices=[];
   function select(button,value){answers.set(i,value);for(const choice of choices)choice.setAttribute('aria-pressed',String(choice===button));}
   for(const [j,option] of (q.options||[]).entries()){const optionButton=control(option.label+(option.description?' — '+option.description:''),`decision:${i}:${j}`,()=>select(optionButton,option.label));optionButton.setAttribute('aria-pressed','false');choices.push(optionButton);field.append(optionButton);}
   const text=document.createElement('input');text.type='text';text.placeholder=t('Custom answer');text.setAttribute('aria-label',t('Custom answer'));text.dataset.focusKey=`decision-custom:${i}`;text.oninput=()=>{answers.set(i,text.value);for(const choice of choices)choice.setAttribute('aria-pressed','false');};field.append(text);form.append(field);
  });
  const submit=control(t('Send answer'),'decision-submit',()=>{const result={};for(let i=0;i<questions.length;i++){const value=answers.get(i);if(!value||!value.trim()){const first=form.querySelector(`[data-focus-key="decision:${i}:0"], [data-focus-key="decision-custom:${i}"]`);first?.focus();return;}result[questions[i].question]=value;}post(`/api/tasks/${task.id}/decision`,{decisionId:d.id,type:'answer',answers:result});});form.append(submit);box.append(form);
 }
 return box;
};
