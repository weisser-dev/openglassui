import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const assets=['glass.css','i18n.js','glass-i18n.js','usage.js','notifications.js','spatial.js','webmcp.js','events.js','push-client.js','decisions.js','wearable-audio.js','wearable-navigation.js','recent-chats.js','glass.js','favicon.svg'];
await mkdir('demo/wearable',{recursive:true});
for(const name of assets)await copyFile(`public/${name}`,`demo/wearable/${name}`);
let html=await readFile('public/glass.html','utf8');html=html.replaceAll('src="/','src="').replaceAll('href="/','href="').replace('<script src="glass.js" defer></script>','<script src="mock.js" defer></script><script src="glass.js" defer></script>');
await writeFile('demo/wearable/glass.html',html);await copyFile('demo/wearable-mock.js','demo/wearable/mock.js');
