(() => {
 const frame=document.querySelector('#wearable-demo');let lastFocused=null;
 const highlight=gesture=>{document.querySelectorAll('.gesture-guide-item').forEach(item=>{const active=item.dataset?.gesture===gesture;item.classList?.toggle('is-active',active);if(active){const img=item.querySelector?.('img');if(img)img.src=img.src;}});};
 frame.addEventListener('load',()=>{const doc=frame.contentDocument;lastFocused=null;doc?.addEventListener('focusin',event=>{lastFocused=event.target;});});
 document.querySelectorAll('[data-key]').forEach(button=>button.addEventListener('click',()=>{
  const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)return;
  const current=lastFocused?.isConnected&&!lastFocused.disabled?lastFocused:doc.querySelector('#screen button, #screen textarea, #screen pre[tabindex]');
  if(current && doc.activeElement!==current)current.focus({preventScroll:true});
  const target=doc.activeElement||doc.body,key=button.dataset.key;highlight(key==='Enter'?'select':key==='Escape'?'back':'swipe');
  const event=new win.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});target.dispatchEvent(event);
  if(key==='Enter'&&!event.defaultPrevented&&target.tagName==='BUTTON')target.click();
 }));
 const play=document.getElementById?.('demo-play');let playing=false;
 play?.addEventListener('click',async()=>{if(playing)return;playing=true;play.disabled=true;try{const win=frame.contentWindow,doc=frame.contentDocument;if(!win||!doc)return;const delay=()=>new Promise(resolve=>setTimeout(resolve,1000));const click=async selector=>{const item=doc.querySelector(selector);if(item){highlight('swipe');item.focus();await delay();highlight('select');item.click();await delay();}};await click('[data-focus-key^="agent:"]');await click('[data-focus-key^="project:"]');await click('#screen .menu-item');}finally{playing=false;play.disabled=false;}});
})();
