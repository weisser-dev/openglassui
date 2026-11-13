// Choose the nearest element in the requested direction using visible geometry.
// Aligned elements are preferred over distant diagonal candidates.
function spatialTarget(current, candidates, direction) {
 const center=rect=>({x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2});
 const origin=center(current);let best=-1,bestScore=Infinity;
 for(let i=0;i<candidates.length;i++){
  const rect=candidates[i];if(!rect || rect.width<=0 || rect.height<=0)continue;
  const target=center(rect),dx=target.x-origin.x,dy=target.y-origin.y;
  const primary=direction==='ArrowDown'?dy:direction==='ArrowUp'?-dy:direction==='ArrowRight'?dx:-dx;
  if(primary<=1)continue;
  const vertical=direction==='ArrowDown'||direction==='ArrowUp';
  const cross=Math.abs(vertical?dx:dy);
  const overlaps=vertical?rect.left<current.right&&rect.right>current.left:rect.top<current.bottom&&rect.bottom>current.top;
  const score=primary+cross*(overlaps?0.15:1.5)+(overlaps?0:40);
  if(score<bestScore){best=i;bestScore=score;}
 }
 return best;
}

// The local preview sends the same keyboard events used by the wearable interface.
if(typeof document!=='undefined' && document.querySelector('[data-simulator-controls]')){
 const frame=document.querySelector('#simulator-frame');let lastFocused=null;
 frame.addEventListener('load',()=>{lastFocused=null;frame.contentDocument?.addEventListener('focusin',event=>{lastFocused=event.target;});});
 document.querySelectorAll('[data-simulator-controls] [data-key]').forEach(button=>button.addEventListener('click',()=>{
  const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)return;
  const current=lastFocused?.isConnected&&!lastFocused.disabled?lastFocused:doc.querySelector('#screen button, #screen textarea, #screen pre[tabindex]');if(current&&doc.activeElement!==current)current.focus({preventScroll:true});
  const target=doc.activeElement||doc.body,key=button.dataset.key,event=new win.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});target.dispatchEvent(event);if(key==='Enter'&&!event.defaultPrevented&&target.tagName==='BUTTON')target.click();
 }));
 document.querySelectorAll('[data-i18n]').forEach(item=>{item.textContent=window.openGlassI18n?.t(item.dataset.i18n)||item.dataset.i18n;});
}
