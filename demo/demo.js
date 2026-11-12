(() => {
 const frame=document.querySelector('#wearable-demo');let lastFocused=null;
 frame.addEventListener('load',()=>{const doc=frame.contentDocument;lastFocused=null;doc?.addEventListener('focusin',event=>{lastFocused=event.target;});});
 document.querySelectorAll('[data-key]').forEach(button=>button.addEventListener('click',()=>{
  const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)return;
  const current=lastFocused?.isConnected&&!lastFocused.disabled?lastFocused:doc.querySelector('#screen button, #screen textarea, #screen pre[tabindex]');
  if(current && doc.activeElement!==current)current.focus({preventScroll:true});
  const target=doc.activeElement||doc.body,key=button.dataset.key;
  const event=new win.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});target.dispatchEvent(event);
  if(key==='Enter'&&!event.defaultPrevented&&target.tagName==='BUTTON')target.click();
 }));
})();
