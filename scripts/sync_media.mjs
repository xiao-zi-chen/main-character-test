import { readFile, writeFile, access, copyFile, mkdir, mkdtemp, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roles } from '../src/data/roles.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const media = resolve(root, 'public/media');
const argv = process.argv.slice(2);
function argument(flag) {
  const index=argv.indexOf(flag);
  if(index<0) return undefined;
  if(!argv[index+1] || argv[index+1].startsWith('--')) throw new Error(`${flag} 缺少参数`);
  return argv[index+1];
}
const finalTarget=argument('--final');
const sourceArgument=argument('--from');
const source=sourceArgument?resolve(root,sourceArgument):media;
const explicitPosterTime=argument('--poster-time');
if(finalTarget && finalTarget!=='all' && !roles.some(role=>role.id===finalTarget)) throw new Error('未知角色。使用 --final all 或 --final myth-keeper。');
if(explicitPosterTime!==undefined && (!Number.isFinite(Number(explicitPosterTime)) || Number(explicitPosterTime)<0)) throw new Error('--poster-time 需要有效的非负秒数');

let manifest={};
try { manifest=JSON.parse(await readFile(join(media,'manifest.json'),'utf8')); } catch {}
await mkdir(join(root,'.work'),{recursive:true});
const staging=await mkdtemp(join(root,'.work/media-import-'));
const pending=[];
const errors=[];

// Prepare and verify the entire requested batch before touching live media.
for(const role of roles) {
  if(finalTarget && finalTarget!=='all' && finalTarget!==role.id) continue;
  try {
    const filename=`${role.id}.mp4`;
    const stagedVideo=join(staging,filename);
    await copyFile(join(source,filename),stagedVideo);
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',stagedVideo],{encoding:'utf8'}));
    const video=probe.streams.find(stream=>stream.codec_type==='video');
    const duration=Number(probe.format.duration);
    if(!video || Math.abs(video.width/video.height-9/16)>.025) throw new Error('需要 9:16 竖屏视频');
    if(!Number.isFinite(duration) || duration<=0) throw new Error('无法读取有效视频时长');
    if(video.codec_name!=='h264' || video.pix_fmt!=='yuv420p') throw new Error('请使用 H.264 / yuv420p 编码');
    let sourceMetadata;
    try { sourceMetadata=JSON.parse(await readFile(join(source,'metadata',`${role.id}.json`),'utf8')); } catch {}
    if(sourceMetadata?.preset && sourceMetadata.preset!==role.id) throw new Error('来源元数据中的角色与文件名不匹配');
    const previous=manifest[role.id]??{};
    const embeddedTitle=sourceArgument?sourceMetadata?.end_style==='card':Boolean(previous.embeddedTitle);
    const suggestedTime=embeddedTitle?duration-3:duration*.6;
    const posterTime=Math.min(Math.max(0,Number(explicitPosterTime??previous.posterTime??suggestedTime)),Math.max(0,duration-.1));
    const stagedPoster=join(staging,`${role.id}.jpg`);
    execFileSync('ffmpeg',['-y','-v','error','-ss',String(posterTime),'-i',stagedVideo,'-frames:v','1','-update','1','-q:v','2',stagedPoster]);
    const videoBytes=await readFile(stagedVideo);
    const posterBytes=await readFile(stagedPoster);
    const sha256=createHash('sha256').update(videoBytes).digest('hex');
    const revision=createHash('sha256').update(videoBytes).update(posterBytes).digest('hex').slice(0,12);
    const entry={...previous,status:finalTarget||sourceArgument?'final':previous.status??'storyboard',duration,width:video.width,height:video.height,hasAudio:probe.streams.some(s=>s.codec_type==='audio'),embeddedTitle,posterTime,revision,sha256};
    pending.push({role,entry,stagedVideo,stagedPoster});
  } catch(error) { errors.push(`${role.id}: ${error.message}`); }
}
if(errors.length) {
  console.error(errors.join('\n'));
  console.error('检查未通过，网站素材和 manifest 均未替换。');
  process.exit(1);
}

const backup=join(staging,'previous');
await mkdir(backup,{recursive:true});
const existing=[];
for(const name of ['manifest.json',...pending.flatMap(({role})=>[`${role.id}.mp4`,`${role.id}.jpg`])]) {
  try { await access(join(media,name)); } catch { continue; }
  await copyFile(join(media,name),join(backup,name));existing.push(name);
}
try {
  for(const {role,entry,stagedVideo,stagedPoster} of pending) {
    // Preserve the supplied film byte-for-byte: no trimming or recompression.
    await copyFile(stagedVideo,join(media,`${role.id}.mp4`));
    await copyFile(stagedPoster,join(media,`${role.id}.jpg`));
    manifest[role.id]=entry;
  }
  const manifestTemp=join(media,`.manifest-${Date.now()}.json`);
  await writeFile(manifestTemp,JSON.stringify(manifest,null,2));
  await rename(manifestTemp,join(media,'manifest.json'));
} catch(error) {
  for(const name of existing) await copyFile(join(backup,name),join(media,name));
  throw error;
}
await writeFile(join(staging,'import-report.json'),JSON.stringify({source,backup,videos:pending.map(({role,entry})=>({id:role.id,name:role.name,...entry}))},null,2));
await copyFile(join(root,'视频生成Prompt.md'),join(root,'public/视频生成Prompt.md'));
for(const {role,entry} of pending) console.log(`✓ ${role.name} · ${entry.duration.toFixed(2)}s · ${entry.status} · 封面 ${entry.posterTime}s${entry.embeddedTitle?' · 自带片尾角色卡':''}`);
console.log(`旧素材与导入校验记录：${staging}`);
