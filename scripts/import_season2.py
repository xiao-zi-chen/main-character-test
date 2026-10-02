"""Import the completed second-season pack without altering its videos/audio."""
from pathlib import Path
import argparse, hashlib, json, re, shutil, subprocess
from PIL import Image, ImageOps

parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True,type=Path)
args=parser.parse_args()
site=Path(__file__).resolve().parents[1]
source=args.source.resolve()
media=site/'public/media'
roles=json.loads((source/'新角色人设与Prompt.json').read_text(encoding='utf-8'))
assert len(roles)==10 and len({r['id'] for r in roles})==10
manifest=json.loads((media/'manifest.json').read_text(encoding='utf-8'))
checks=[]
for role in roles:
    key=role['id'];assert re.fullmatch('[a-z0-9-]+',key)
    meta=json.loads((source/'metadata'/f'{key}.json').read_text(encoding='utf-8'))
    movie=source/f'{key}.mp4'
    digest=hashlib.sha256(movie.read_bytes()).hexdigest()
    assert digest==meta['sha256'],key
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(movie)],encoding='utf-8'))
    video=next(s for s in probe['streams'] if s['codec_type']=='video')
    assert (video['width'],video['height'],video['codec_name'],video['pix_fmt'])==(720,1280,'h264','yuv420p')
    assert float(probe['format']['duration'])==15 and any(s['codec_type']=='audio' for s in probe['streams'])
    audio=subprocess.check_output(['ffmpeg','-v','error','-i',str(movie),'-map','0:a:0','-c:a','copy','-f','adts','pipe:1'])
    audio_hash=hashlib.sha256(audio).hexdigest()
    assert audio_hash==meta['native_audio_bitstream_sha256'] and meta['external_tts'] is False,key
    with Image.open(source/f'{key}_portrait.png') as image: assert image.size==(720,1280)
    checks.append((role,meta,digest,audio_hash))

for role,meta,digest,audio_hash in checks:
    key=role['id']
    for suffix in ['.mp4','.jpg','_portrait.png','_avatar.png','_card.png','.srt']:
        shutil.copy2(source/f'{key}{suffix}',media/f'{key}{suffix}')
    # These endings focus on the person answering the lead, not the lead.
    # Use the verified second-shot frame for the actual protagonist portrait.
    portrait_time=4.5 if key in {'villain-calmer','immortal-support','spotlight-extra','cosmic-director'} else meta['portrait_time']
    if portrait_time==4.5:
        subprocess.run(['ffmpeg','-y','-v','error','-ss','4.5','-i',str(source/f'{key}.mp4'),'-frames:v','1','-update','1',str(media/f'{key}_portrait.png')],check=True)
        with Image.open(media/f'{key}_portrait.png') as image:
            image.convert('RGB').save(media/f'{key}.jpg',quality=94)
            ImageOps.fit(image.crop((0,0,720,900)),(512,512),Image.Resampling.LANCZOS,centering=(.5,.25)).save(media/f'{key}_avatar.png')
    with Image.open(media/f'{key}_portrait.png') as image:
        # The gallery receives a full-frame WebP, not the pack's cropped variant.
        image.convert('RGB').save(media/f'{key}_poster.webp',quality=92)
    shutil.copy2(source/f'{key}_MiniMax原声.m4a',media/f'{key}_voice.m4a')
    revision=hashlib.sha256((media/f'{key}.mp4').read_bytes()+(media/f'{key}_portrait.png').read_bytes()).hexdigest()[:12]
    manifest[key]={'status':'final','duration':15,'width':720,'height':1280,'hasAudio':True,'embeddedTitle':True,
      'portrait':f'{key}_portrait.png','poster':f'{key}_poster.webp','avatar':f'{key}_avatar.png',
      'subtitles':f'{key}.srt','voice':f'{key}_voice.m4a','nativeDialogue':True,
      'posterTime':portrait_time,'revision':revision,'sha256':digest,'nativeAudioSha256':audio_hash}
    print(f"Imported {role['number']}: {role['name']} · 15s · native dialogue verified",flush=True)

front=[{k:v for k,v in role.items() if k!='generation_prompt'} for role in roles]
(site/'src/data/roles-season2.js').write_text('export const season2Roles = '+json.dumps(front,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(media/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
report={'totalRoles':len(manifest),'newRoles':[{'id':r['id'],'name':r['name'],'hidden':bool(r.get('hidden')),'sha256':digest,'nativeAudioSha256':audio_hash} for r,m,digest,audio_hash in checks]}
(site/'docs/第二季媒体校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
