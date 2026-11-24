import {readFile,access,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
const html=await readFile(path.join(dist,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
const refs=[...html.matchAll(/(?:src|href|data-image)="([^"]+)"/g)].map(m=>m[1]);
for(const ref of refs){if(ref.startsWith('#')){assert(ref==='#'||ids.includes(ref.slice(1)),`Missing section: ${ref}`);}else if(!ref.startsWith('http'))await access(path.join(dist,ref));}
const discord=refs.filter(r=>r.includes('discord.gg/'));
assert(discord.length>=3&&discord.every(r=>r==='https://discord.gg/VzHWpB7uG'),'Discord invite mismatch');
const plans=[...html.matchAll(/data-days="(\d+)" data-price="([\d.]+)"/g)].map(match=>match.slice(1));
assert.deepEqual(plans,[['1','5'],['3','7.50'],['7','10'],['30','15']],'Pricing mismatch');
assert(html.includes('obsidian-logo-landscape.webp')&&html.includes('release-5-1-2/loader.webp'),'Missing latest artwork/loader');
const menuTabs=[...html.matchAll(/data-tab="([a-z]+)"/g)].map(match=>match[1]);
assert.deepEqual(menuTabs,['aim','esp','hud','gameplay','lobby','presets'],'Missing or out-of-order menu tabs');
for(const tab of menuTabs)await access(path.join(dist,'assets','release-5-1-2',tab+'.webp'));
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scan(file);else{assert(!/\.(exe|dll|env|csv)$/i.test(entry.name),'Private or executable file in public assets');if(/\.(html|js|css)$/i.test(entry.name)){const s=await readFile(file,'utf8');assert(!/ALQ1-[A-F0-9]{4}-/.test(s),'License key in public source');}}}}
await scan(dist);
const admin=await readFile(path.join(dist,'admin','index.html'),'utf8');
const adminIds=[...admin.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(adminIds.length,new Set(adminIds).size,'Duplicate admin HTML IDs');
for(const ref of [...admin.matchAll(/(?:src|href|data-image)="([^"]+\.(?:css|js))"/g)].map(match=>match[1])){
  assert(ref.startsWith('/admin/'),`Admin assets must load from either admin URL: ${ref}`);
  await access(path.join(dist,ref));
}
const vercel=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
assert(vercel.redirects?.some(rule=>rule.source==='/admin'&&rule.destination==='/admin/'),
  'Vercel must redirect /admin to /admin/');
console.log('PASS: public and admin assets, anchors, unique IDs, Discord links, prices, artwork, loader and admin routing.');
console.log('Static production output ready: dist/');
