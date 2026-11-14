// Preserve the originating control and scroll positions across screen changes.
function captureWearableView(doc, win, route, selection) {
  const active = doc.activeElement;
  return { route: { ...route }, selection: { ...selection }, focusKey: active?.dataset?.focusKey || null,
    scrollY: win.scrollY, outputScroll: active?.matches?.('.chat-output') ? active.scrollTop : 0 };
}
function restoreWearableView(doc, win, view) {
  const target = view.focusKey && [...doc.querySelectorAll('[data-focus-key]')].find(item => item.dataset.focusKey === view.focusKey && !item.disabled && item.offsetParent !== null);
  const fallback = doc.querySelector('#screen button, #screen textarea, #screen pre[tabindex]');
  (target || fallback)?.focus({ preventScroll: true });
  const output = target?.matches?.('.chat-output') ? target : null;
  if (output) output.scrollTop = view.outputScroll;
  win.scrollTo(0, view.scrollY);
}
function isWearableBack(event, active) {
  return !event.defaultPrevented && !event.isComposing && (event.key === 'Escape' ||
    (event.key === 'Backspace' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName)));
}

// Keep the entire focused message above the sticky composer on small displays.
function ensureWearableMessageVisible(doc,win,target){
 const rect=target?.getBoundingClientRect?.();if(!rect||!Number.isFinite(win.innerHeight)||!Number.isFinite(win.scrollY)||typeof win.scrollTo!=='function')return;
 const composer=doc.querySelector?.('#screen .composer-wrap'),bar=composer?.getBoundingClientRect?.();const bottom=bar&&bar.top>0&&bar.top<win.innerHeight?bar.top:win.innerHeight;const padding=12;
 if(rect.bottom>bottom-padding)win.scrollTo(0,Math.max(0,win.scrollY+rect.bottom-(bottom-padding)));
 else if(rect.top<padding)win.scrollTo(0,Math.max(0,win.scrollY+rect.top-padding));
}

// Open a chat at the newest message; pending decisions take precedence.
function focusWearableScreen(doc, page, hasDecision, win = globalThis) {
  let target;
  if (page === 'agents') target = doc.querySelector('#screen [data-recent-chat]');
  if (page === 'chat' && hasDecision) target = doc.querySelector('#screen .decision [data-default-approval]') || doc.querySelector('#screen .decision pre, #screen .decision button, #screen .decision input');
  if (!target && page === 'chat') target = [...doc.querySelectorAll('#screen [data-chat-message]')].at(-1);
  if (!target) target = doc.querySelector(page === 'chats' ? '#screen textarea' : '#screen button, #screen textarea, #screen pre[tabindex]');
  if (!target) return;
  target.focus({preventScroll:false});
  // The glasses WebKit host can focus an element without scrolling it into view.
  if (page === 'chat' && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({block:'center',inline:'nearest'});
    let cancelled=false;
    const events=['keydown','pointerdown','touchstart','wheel'];
    const cleanup=()=>{cancelled=true;for(const event of events)doc.removeEventListener?.(event,cleanup,true);};
    // Attach after the selection gesture that opened the chat has finished.
    if(typeof win.setTimeout==='function'&&typeof doc.addEventListener==='function')win.setTimeout(()=>{if(!cancelled)for(const event of events)doc.addEventListener(event,cleanup,{capture:true,once:true});},0);
    const align=()=>{
      if (cancelled || !target.isConnected) return;
      // Some hosts reset focus after navigation. Restore it unless the user has
      // started navigating, in which case the listeners above cancel retries.
      if(doc.activeElement!==target)target.focus({preventScroll:true});
      target.scrollIntoView({block:'center',inline:'nearest'});
      const rect=target.getBoundingClientRect?.();
      if (rect && typeof win.scrollTo==='function' && Number.isFinite(win.scrollY) && Number.isFinite(win.innerHeight)) {
        const position=Math.max(0,win.scrollY+rect.top-(win.innerHeight-rect.height)/2);
        win.scrollTo(0,position);
        ensureWearableMessageVisible(doc,win,target);
      }
    };
    if (typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(align);
    if (typeof win.setTimeout === 'function') {win.setTimeout(align,150);win.setTimeout(align,500);win.setTimeout(cleanup,800);}
  }
}
// Some device composers update a text field without dispatching an input event.
function attachWearableComposer(input, send, drafts, key, win) {
 let sending=false,composing=false,silentPending=false,stablePolls=0,focusValue=input.value;
 function sync() {
  drafts.set(key,input.value);
  send.disabled=sending||!input.value.trim();
 }
 function focusSend() {
  sync();
  if(input.value.trim())win.setTimeout(()=>{if(send.isConnected&&!send.disabled)send.focus();},0);
 }
 function poll() {
  if(!input.isConnected){win.clearInterval(timer);return;}
  if(drafts.get(key)!==input.value){sync();silentPending=true;stablePolls=0;}else if(silentPending&&!composing&&++stablePolls>=4){silentPending=false;if(win.document?.activeElement===input)focusSend();}
 }
 input.addEventListener('input',()=>{silentPending=false;sync();});
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;sync();});
 input.addEventListener('change',()=>{silentPending=false;focusSend();});
 input.addEventListener('blur',event=>{sync();if(!composing&&input.value!==focusValue&&!event?.relatedTarget)focusSend();});
 input.addEventListener('focus',()=>{focusValue=input.value;sync();});
 const timer=win.setInterval(poll,250);
 sync();
 return {
  sync,
  setSending(value){sending=value;sync();},
  clear(){input.value='';drafts.delete(key);send.disabled=true;},
 };
}
