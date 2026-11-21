import {readFile,access,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
const html=await readFile(path.join(dist,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
for(const ref of refs){if(ref.startsWith('#')){assert(ref==='#'||ids.includes(ref.slice(1)),`Missing section: ${ref}`);}else if(!ref.startsWith('http')&&!ref.startsWith('/_vercel/'))await access(path.join(dist,ref));}
const discord=refs.filter(r=>r.includes('discord.gg/'));
assert(discord.length>=3&&discord.every(r=>r==='https://discord.gg/VzHWpB7uG'),'Discord invite mismatch');
for(const [days,price]of [['1','5'],['3','7.50'],['30','10']])assert(html.includes(`data-days="${days}" data-price="${price}"`),'Pricing mismatch');
assert(!html.includes('data-days="7"'),'Outdated 7-day pricing');
assert(html.includes('obsidian-logo-landscape.webp')&&html.includes('loader-v4-1-2.png'),'Missing latest artwork/loader');
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scan(file);else{assert(!/\.(exe|dll|env|csv)$/i.test(entry.name),'Private or executable file in public assets');if(/\.(html|js|css)$/i.test(entry.name)){const s=await readFile(file,'utf8');assert(!/ALQ1-[A-F0-9]{4}-/.test(s),'License key in public source');}}}}
await scan(dist);
console.log('PASS: assets, anchors, unique IDs, Discord links, 1/3/30-day prices, latest artwork, loader and public-file checks.');
console.log('Static production output ready: dist/');
