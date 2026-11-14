import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const assets=['glass.css','theme.js','i18n.js','glass-i18n.js','usage.js','notifications.js','spatial.js','webmcp.js','events.js','push-client.js','decisions.js','wearable-audio.js','wearable-navigation.js','recent-chats.js','glass.js','favicon.svg'];
await mkdir('demo/wearable',{recursive:true});
await mkdir('demo/wearable/icons/gestures',{recursive:true});
for(const name of ['swipe','select','back'])await copyFile(`public/icons/gestures/${name}.gif`,`demo/wearable/icons/gestures/${name}.gif`);
await copyFile('public/theme.js','demo/theme.js');
await copyFile('public/setup-glasses.png','demo/setup-glasses.png');
for(const name of assets)await copyFile(`public/${name}`,`demo/wearable/${name}`);
let html=await readFile('public/glass.html','utf8');html=html.replaceAll('src="/','src="').replaceAll('href="/','href="').replace('<script src="glass.js" defer></script>','<script src="mock.js" defer></script><script src="glass.js" defer></script>');
await writeFile('demo/wearable/glass.html',html);await copyFile('demo/wearable-mock.js','demo/wearable/mock.js');

const dashboardAssets=['style.css','theme.js','usage.js','notifications.js','events.js','app.js','decisions.js','sessions-ui.js','i18n.js','favicon.svg'];
await mkdir('demo/dashboard',{recursive:true});
for(const name of dashboardAssets)await copyFile(`public/${name}`,`demo/dashboard/${name}`);
let dashboard=await readFile('public/index.html','utf8');
dashboard=dashboard.replaceAll('src="/','src="').replaceAll('href="/','href="').replace('<script src="app.js" defer></script>','<script src="mock.js" defer></script><script src="app.js" defer></script>').replace('<script src="setup.js" defer></script>','').replace('href="simulator.html"','href="../wearable/glass.html"').replace('<main class="shell">','<main class="shell"><p class="demo-warning">DEMO MODE · Fictional data only. No devices or agents are connected.</p>');
await writeFile('demo/dashboard/index.html',dashboard);await copyFile('demo/dashboard-mock.js','demo/dashboard/mock.js');
