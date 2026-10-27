// Compose the existing illustration, role copy and homepage QR into one PNG.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { roles } from '../src/data/roles.js';
const mediaDir=new URL('../public/media/',import.meta.url);
const manifestPath=new URL('manifest.json',mediaDir);
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
const backup=new URL(`../../.local/card-compose-oct27/before-${stamp}/`,import.meta.url);
const output=new URL('../../output/complete-character-cards-2026-10-27/',import.meta.url);
await mkdir(backup,{recursive:true});await mkdir(output,{recursive:true});
await copyFile(manifestPath,new URL('manifest.json',backup));
for(const entry of Object.values(manifest)) await copyFile(new URL(entry.card,mediaDir),new URL(entry.card,backup));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
process.env.NBTI_DEV_BACKEND='disabled';
let server,browser;
const cards=[];
try {
  server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0},logLevel:'silent'});
  await server.listen();
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
  const page=await browser.newPage();
  // An empty document avoids loading the application or collection client.
  await page.route(base+'/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Card export</title>'}));
  await page.goto(base+'/');
  for(const role of roles) {
    const entry=manifest[role.id];
    if(!['imagegen-film-reference','composite-film-reference'].includes(entry.cardSource)) throw new Error(`Missing reviewed art: ${role.id}`);
    const artwork=entry.cardSource==='composite-film-reference'?entry.cardArtwork:entry.card;
    const artworkHash=entry.cardSource==='composite-film-reference'?entry.cardArtworkSha256:entry.cardSha256;
    if(sha(await readFile(new URL(artwork,mediaDir)))!==artworkHash) throw new Error(`Artwork hash mismatch: ${role.id}`);
    const result=await page.evaluate(async ({role,artwork})=>{
      const {createRoleCard}=await import('/src/visuals/share-card.js');
      const canvas=await createRoleCard(role,`/media/${artwork}`);
      return {png:canvas.toDataURL('image/png').split(',')[1],layout:canvas.cardLayout};
    },{role,artwork});
    const bytes=Buffer.from(result.png,'base64'), hash=sha(bytes);
    const file=`${role.id}.png`, published=`${role.id}-card-${hash.slice(0,12)}.png`;
    await writeFile(new URL(file,output),bytes);
    await writeFile(new URL(published,mediaDir),bytes);
    Object.assign(entry,{card:published,cardSha256:hash,cardSize:[result.layout.width,result.layout.height],cardTitle:role.name,
      cardSource:'composite-film-reference',cardDescription:role.description,cardTagline:role.tagline,cardQrUrl:'https://www.nbti.cn/',cardLayoutVersion:1,
      cardArtwork:artwork,cardArtworkSha256:artworkHash,cardArtworkSize:[1024,1536]});
    cards.push({id:role.id,title:role.name,file,artworkFile:artwork,published,sha256:hash,layout:result.layout});
    console.log(`Composed ${cards.length}/28: ${role.id}`);
  }
  if(cards.length!==28) throw new Error('Expected all 28 cards');
  await writeFile(new URL('manifest.json',output),JSON.stringify({qrUrl:'https://www.nbti.cn/',cards},null,2)+'\n');
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const items=cards.map(card=>`<article><a href="${card.file}" target="_blank"><img loading="lazy" src="${card.file}" alt="${escape(card.title)}"></a><h2>${escape(card.title)}</h2><a href="${card.file}" download>下载完整角色卡</a></article>`).join('');
  await writeFile(new URL('index.html',output),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NBTI 完整角色卡</title><style>body{background:#101a16;color:#f2e7ce;font:16px/1.6 system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;max-width:1440px;margin:auto}img{width:100%;height:auto;border-radius:8px}h2{font-size:18px}a{color:#d8bc83}h1,p{text-align:center}</style><h1>28 张完整角色卡</h1><p>角色图片 · 角色简介 · 网站二维码</p><main>${items}</main></html>`);
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  await writeFile(new URL('../../.local/card-compose-oct27/export-result.json',import.meta.url),JSON.stringify({count:cards.length,output:fileURLToPath(output),backup:fileURLToPath(backup),cloudChanged:false},null,2)+'\n');
  console.log(`Exported ${cards.length} complete PNG cards.`);
} finally {await browser?.close();await server?.close();}