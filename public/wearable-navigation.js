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

// Open a chat at the newest message; pending decisions take precedence.
function focusWearableScreen(doc, page, hasDecision) {
  let target;
  if (page === 'chat' && hasDecision) target = doc.querySelector('#screen .decision pre, #screen .decision button, #screen .decision input');
  if (!target && page === 'chat') target = [...doc.querySelectorAll('#screen [data-chat-message]')].at(-1);
  if (!target) target = doc.querySelector(page === 'chats' ? '#screen textarea' : '#screen button, #screen textarea, #screen pre[tabindex]');
  target?.focus({preventScroll:false});
}
// Some device composers update a text field without dispatching an input event.
function attachWearableComposer(input, send, drafts, key, win) {
 let sending=false;
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
  if(drafts.get(key)!==input.value)sync();
 }
 input.addEventListener('input',sync);
 input.addEventListener('change',focusSend);
 input.addEventListener('blur',sync);
 input.addEventListener('focus',sync);
 const timer=win.setInterval(poll,250);
 sync();
 return {
  sync,
  setSending(value){sending=value;sync();},
  clear(){input.value='';drafts.delete(key);send.disabled=true;},
 };
}
