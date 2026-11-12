window.decisionUI=function(task,post){
 const d=task.pendingDecision, box=document.createElement('section');box.className='decision';
 const heading=document.createElement('h3');heading.textContent=['approval','kiro_permission'].includes(d.kind)?'Approval required':`${task.agentName} asks`;box.append(heading);
 const context=document.createElement('p');context.textContent=`Task: ${task.prompt}`;box.append(context);
 if(d.kind==='kiro_permission'){
  const details=document.createElement('pre');details.textContent=JSON.stringify(d.input.toolCall,null,2);box.append(details);
  for(const option of d.input.options){const button=document.createElement('button');button.type='button';button.textContent=option.name || (option.kind==='allow_once'?'Allow once':'Deny');button.onclick=()=>post(`/api/tasks/${task.id}/decision`,{decisionId:d.id,type:'choice',optionId:option.optionId});box.append(button);}
 }else if(d.kind==='approval'){
  const details=document.createElement('pre');details.textContent=`${d.toolName}\n${d.description||''}\n${JSON.stringify(d.input,null,2)}`;box.append(details);
  for(const [type,label] of [['deny','Deny'],['allow','Allow once']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>post(`/api/tasks/${task.id}/decision`,{decisionId:d.id,type});box.append(button);}
 }else{
  const form=document.createElement('form');const questions=d.input?.questions||[];
  questions.forEach((q,i)=>{const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=q.question;field.append(legend);for(const option of q.options||[]){const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='q'+i;radio.value=option.label;radio.required=true;label.append(radio,document.createTextNode(' '+option.label+(option.description?' — '+option.description:'')));field.append(label);}const label=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('input');radio.type='radio';radio.name='q'+i;radio.value='__other__';radio.required=true;text.type='text';text.placeholder='Custom answer';text.oninput=()=>{radio.checked=true};label.append(radio,text);field.append(label);form.append(field);});
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Send answer';form.append(submit);form.onsubmit=e=>{e.preventDefault();const answers={};for(let i=0;i<questions.length;i++){const field=form.querySelectorAll('fieldset')[i],chosen=field.querySelector('input[type=radio]:checked');const value=chosen?.value==='__other__'?field.querySelector('input[type=text]').value:chosen?.value;if(!value){alert('Please answer every question.');return}answers[questions[i].question]=value;}post(`/api/tasks/${task.id}/decision`,{decisionId:d.id,type:'answer',answers});};box.append(form);
 }
 return box;
};
