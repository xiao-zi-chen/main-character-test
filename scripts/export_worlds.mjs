import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roles } from '../src/data/roles.js';
import { worldSvg } from '../src/visuals/world-art.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'public/worlds');
await mkdir(output,{recursive:true});
for(const role of roles) await writeFile(resolve(output,`${role.id}.svg`),worldSvg(role));
console.log(`Exported ${roles.length} original illustrated worlds.`);

if (process.argv.includes('--raster')) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
  const rasterOutput=resolve(root,'.work/world-renders');
  await mkdir(rasterOutput,{recursive:true});
  try {
    for (const role of roles) {
      const source=Buffer.from(worldSvg(role)).toString('base64');
      await page.setContent(`<body style="margin:0;background:#090e18"><img alt="" src="data:image/svg+xml;base64,${source}" style="width:720px;height:1280px;object-fit:cover;display:block"></body>`);
      await page.locator('img').evaluate(img=>img.decode());
      const encoded=await page.locator('img').evaluate(img=>{
        const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
        const scale=Math.max(720/img.naturalWidth,1280/img.naturalHeight);
        canvas.getContext('2d').drawImage(img,(720-img.naturalWidth*scale)/2,(1280-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await writeFile(resolve(rasterOutput,`${role.id}.png`),Buffer.from(encoded,'base64'));
    }
  } finally { await browser.close(); }
  console.log('Rasterized 10 world illustrations for storyboard rendering.');
}
