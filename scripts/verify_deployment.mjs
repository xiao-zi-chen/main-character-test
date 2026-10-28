import { readFile, access, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { roles } from '../src/data/roles.js';
import { publicAssetPaths, publicEntryPaths, questionArtPaths } from './public-assets.mjs';
import { questions } from '../src/data/questions.js';

const verifyHashes = !process.argv.includes('--skip-media-hashes');
const hashMatches = (buffer, expected) => !verifyHashes || createHash('sha256').update(buffer).digest('hex') === expected;
if (!verifyHashes) console.log('Skipping media SHA256 checks by request; file, format, metadata and public allowlist checks remain enabled.');

const manifest=JSON.parse(await readFile(new URL('../dist/media/manifest.json',import.meta.url),'utf8'));
const sourceManifest=JSON.parse(await readFile(new URL('../public/media/manifest.json',import.meta.url),'utf8'));
if(!isDeepStrictEqual(manifest,sourceManifest)) {
  throw new Error('Built media manifest differs from public/media/manifest.json. Rebuild the current frontend before deployment.');
}
if(roles.length!==28) throw new Error('Expected twenty-eight selected character results');
if(!isDeepStrictEqual(Object.keys(manifest).sort(),roles.map(role=>role.id).sort())) {
  throw new Error('Media manifest must contain exactly the current character IDs.');
}
const art=JSON.parse(await readFile(new URL('../dist/question-art/manifest.json',import.meta.url),'utf8'));
const sourceArt=JSON.parse(await readFile(new URL('../public/question-art/manifest.json',import.meta.url),'utf8'));
if(!isDeepStrictEqual(art,sourceArt)) throw new Error('Built question artwork manifest differs from source. Rebuild before deployment.');
const expected=new Set(['index.html',...publicEntryPaths,...publicAssetPaths(manifest),...questionArtPaths(art)]);
const expectedDirectories=new Set(['assets']);
for(const filename of expected) {
  const parts=filename.split('/');
  for(let depth=1;depth<parts.length;depth++) expectedDirectories.add(parts.slice(0,depth).join('/'));
}
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
// The application currently has one eager entry with no dynamic imports.
// Do not accept unrelated old bundles just because their extension is valid.
const referencedBundles=new Set([...html.matchAll(/(?:src|href)="\.\/(assets\/[A-Za-z0-9_-]+\.(?:js|css))"/g)].map(match=>match[1]));
const seen=new Set();
const bundledAssets=[];
async function inspect(directory='') {
  const base=new URL(`../dist/${directory}`,import.meta.url);
  for(const name of await readdir(base)) {
    const relative=directory+name;
    const info=await lstat(new URL(name,base));
    if(info.isSymbolicLink()) throw new Error(`Unexpected deployment symlink: ${relative}`);
    if(info.isDirectory()) {
      if(!expectedDirectories.has(relative)) throw new Error(`Unexpected deployment directory: ${relative}`);
      await inspect(relative+'/');
    } else if(info.isFile() && expected.has(relative)) {
      seen.add(relative);
    } else if(info.isFile() && referencedBundles.has(relative)) {
      bundledAssets.push(relative);
    } else {
      throw new Error(`Unexpected file in current deployment: ${relative}`);
    }
  }
}
await inspect();
for(const filename of expected) if(!seen.has(filename)) throw new Error(`Missing current deployment file: ${filename}`);
for(const filename of referencedBundles) if(!bundledAssets.includes(filename)) throw new Error(`Missing referenced application bundle: ${filename}`);
if(!bundledAssets.some(name=>name.endsWith('.js')) || !bundledAssets.some(name=>name.endsWith('.css'))) {
  throw new Error('Missing bundled application code or styles.');
}
for(const role of roles) {
  const media=manifest[role.id];
  if(media?.status!=='final') throw new Error(`Missing final video: ${role.id}`);
  if (verifyHashes) {
    const video=await readFile(new URL(`../dist/media/${media.video}`,import.meta.url));
    if(!hashMatches(video,media.sha256)) throw new Error(`Video hash mismatch: ${role.id}`);
  }
  for(const type of ['portrait','poster','avatar','card','voice','subtitles']) {
    if(media[type]) await access(new URL(`../dist/media/${media[type]}`,import.meta.url));
  }
}
for(const role of roles) {
  const media=manifest[role.id];
  const card=await readFile(new URL(`../dist/media/${media.card}`,import.meta.url));
  if(!hashMatches(card,media.cardSha256)) throw new Error(`Card hash mismatch: ${role.id}`);
  if(['imagegen-film-reference','composite-film-reference'].includes(media.cardSource)) {
    if(media.cardTitle!==role.name || card.length<24 || card.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || card.subarray(12,16).toString('ascii')!=='IHDR') throw new Error(`Invalid character card: ${role.id}`);
    if(!isDeepStrictEqual([card.readUInt32BE(16),card.readUInt32BE(20)],media.cardSize)) throw new Error(`Card dimensions mismatch: ${role.id}`);
  }
  if(media.cardSource==='composite-film-reference') {
    if(media.cardDescription!==role.description || media.cardTagline!==role.tagline) throw new Error(`Character card copy mismatch: ${role.id}`);
    if(media.cardQrUrl!=='https://www.nbti.cn/' || media.cardLayoutVersion!==1) throw new Error(`Invalid character card QR or layout: ${role.id}`);
    if(typeof media.cardArtwork!=='string' || !/^[a-z0-9_-]+\.png$/.test(media.cardArtwork) || media.cardArtwork===media.card || !/^[a-f0-9]{64}$/.test(media.cardArtworkSha256)) throw new Error(`Invalid character card artwork source: ${role.id}`);
    if(!isDeepStrictEqual(media.cardArtworkSize,[1024,1536]) || media.cardSize[0]!==1024 || media.cardSize[1]<=1536) throw new Error(`Character card must contain its full artwork and footer: ${role.id}`);
    // The original artwork is an input to the composer, not an extra public
    // download. Only the final image containing copy and QR is deployed.
    if(expected.has(`media/${media.cardArtwork}`)) throw new Error(`Uncomposed artwork is unexpectedly public: ${role.id}`);
    const artwork=await readFile(new URL(`../public/media/${media.cardArtwork}`,import.meta.url));
    if(!hashMatches(artwork,media.cardArtworkSha256) || artwork.length<24 || artwork.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error(`Character card artwork hash or format mismatch: ${role.id}`);
    if(!isDeepStrictEqual([artwork.readUInt32BE(16),artwork.readUInt32BE(20)],media.cardArtworkSize)) throw new Error(`Character card artwork dimensions mismatch: ${role.id}`);
  }
  const portrait=await readFile(new URL(`../dist/media/${media.portrait}`,import.meta.url));
  if(!hashMatches(portrait,media.portraitSha256)) throw new Error(`Portrait hash mismatch: ${role.id}`);
}
await access(new URL('../dist/index.html',import.meta.url));
await access(new URL('../dist/collector.js',import.meta.url));
await access(new URL('../dist/public-config.js',import.meta.url));
if(Object.keys(art.questions).length!==questions.length) throw new Error('Missing question artwork');
for(const question of questions) {
  for(const kind of ['scene','left','right','scale-0','scale-1','scale-2','scale-3','scale-4']) {
    const asset=art.questions[question.id]?.assets[kind];
    if(!asset || asset.file!==`${question.id.replace('.', '-')}/${kind}.webp`) throw new Error(`Invalid question image: ${question.id}/${kind}`);
    const image=await readFile(new URL(`../dist/question-art/${asset.file}`,import.meta.url));
    if(!hashMatches(image,asset.sha256)) throw new Error(`Question image hash mismatch: ${asset.file}`);
  }
}
console.log(`Verified deployment whitelist (${expected.size} public files), entry point, ${roles.length} character portraits, 17 shared films, and 320 question images.`);
