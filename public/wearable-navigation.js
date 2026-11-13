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
