window.renderTaskEvents=function(events){
 const section=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('ol');
 section.className='task-events';heading.textContent='Werkzeugverlauf';list.setAttribute('aria-label','Werkzeugverlauf');
 for(const event of events){const item=document.createElement('li');item.textContent=`${event.title} · ${event.status}`;list.append(item);}
 section.append(heading,list);return section;
};
