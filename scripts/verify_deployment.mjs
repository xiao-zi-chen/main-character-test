import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { roles } from '../src/data/roles.js';

const manifest=JSON.parse(await readFile(new URL('../dist/media/manifest.json',import.meta.url),'utf8'));
if(roles.length!==20) throw new Error('Expected twenty character results');
for(const role of roles) {
  const media=manifest[role.id];
  if(media?.status!=='final') throw new Error(`Missing final video: ${role.id}`);
  const video=await readFile(new URL(`../dist/media/${role.id}.mp4`,import.meta.url));
  if(createHash('sha256').update(video).digest('hex')!==media.sha256) throw new Error(`Video hash mismatch: ${role.id}`);
  for(const type of ['portrait','poster','avatar','voice','subtitles']) {
    if(media[type]) await access(new URL(`../dist/media/${media[type]}`,import.meta.url));
  }
}
await access(new URL('../dist/index.html',import.meta.url));
console.log('Verified built entry point and all twenty complete media sets.');
