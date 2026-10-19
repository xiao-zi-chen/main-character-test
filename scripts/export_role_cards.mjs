// Run against the local Vite development server: node scripts/export_role_cards.mjs
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifestPath = new URL('../public/media/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const browser = await chromium.launch({channel:'msedge', headless:true, args:['--disable-gpu']});
try {
  const page = await browser.newPage();
  await page.goto(process.env.CARD_EXPORT_URL || 'http://127.0.0.1:5281');
  const ids = Object.keys(manifest);
  for (const id of ids) {
    const data = await page.evaluate(async id => {
      const { roleById } = await import('/src/data/roles.js');
      const { createRoleCard } = await import('/src/visuals/share-card.js');
      const manifest = await (await fetch('/media/manifest.json')).json();
      const canvas = await createRoleCard(roleById[id], `/media/${manifest[id].portrait}`);
      return canvas.toDataURL('image/png').split(',')[1];
    }, id);
    const bytes = Buffer.from(data, 'base64');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const filename = `${id}-card-${sha256.slice(0,12)}.png`;
    await writeFile(new URL(`../public/media/${filename}`, import.meta.url), bytes);
    manifest[id].card = filename;
    manifest[id].cardSha256 = sha256;
  }
  await writeFile(manifestPath, JSON.stringify(manifest,null,2)+'\n');
  console.log(`Exported ${ids.length} static PNG cards for native long-press saving.`);
} finally { await browser.close(); }
