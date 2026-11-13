import {readFile,writeFile} from 'node:fs/promises';
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const file=new URL('../public/glass.html',import.meta.url),html=await readFile(file,'utf8');
if(!/<span id="glass-version" hidden>v[^<]+<\/span>/.test(html))throw new Error('Wearable version marker not found');
await writeFile(file,html.replace(/(<span id="glass-version" hidden>)v[^<]+(<\/span>)/,`$1v${pkg.version}$2`));
