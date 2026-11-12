// Themes are stored per browser origin; no preference is sent to the companion.
(() => {
 const key='openglass-theme',allowed=['default','hacker','light','dark'];
 const normalize=value=>allowed.includes(value)?value:'default';
 function apply(value){const theme=normalize(value);document.documentElement.dataset.theme=theme;document.querySelectorAll('[data-theme-selector]').forEach(select=>{select.value=theme;});return theme;}
 function set(value){const theme=apply(value);localStorage.setItem(key,theme);return theme;}
 window.OpenGlassTheme={get:()=>normalize(localStorage.getItem(key)),set,apply};
 apply(window.OpenGlassTheme.get());
 document.addEventListener('change',event=>{if(event.target.matches?.('[data-theme-selector]'))set(event.target.value);});
 window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
})();
