"""Upgrade only storyboard media to the illustrated multiverse edition.

Run node scripts/export_worlds.mjs --raster first. Existing final films are
never rendered over; the previous storyboards are backed up before replacing.
"""
import hashlib
import json
import math
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw
from render_videos import font, soundtrack, rgb

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'public' / 'media'
WORK = ROOT / '.work'
STAGING = WORK / 'cinema-v2'
BACKUP = WORK / 'before-redesign' / 'media'
W, H, FPS = 720, 1280, 24


def scene_frame(role, source, t):
    zoom = 1.075 - t / 5 * .055
    enlarged = source.resize((round(W*zoom), round(H*zoom)), Image.Resampling.BICUBIC)
    x=(enlarged.width-W)//2
    y=(enlarged.height-H)//2
    canvas=enlarged.crop((x,y,x+W,y+H)).convert('RGBA')
    shade=Image.new('RGBA',(W,H))
    draw=ImageDraw.Draw(shade)
    for row in range(660,H):
        opacity=round(min(239,((row-660)/(H-660))**.9*260))
        draw.line((0,row,W,row),fill=(7,13,24,opacity))
    color=rgb(role['color'])
    for i in range(22):
        px=(i*173+71)%W
        py=((i*137+58)-t*(5+i%4))%(H*.75)
        radius=1+(i%3)*.4
        draw.ellipse((px-radius,py-radius,px+radius,py+radius),fill=(*color,70+i%5*21))
    draw.rounded_rectangle((24,24,W-24,H-24),radius=9,outline=(*color,80),width=1)
    draw.text((53,58),'主角请就位',font=font(22),fill=(234,217,190,255))
    draw.text((53,93),'THE MULTIVERSE COLLECTION',font=font(12,latin=True),fill=(*color,170))
    draw.text((607,49),role['number'],font=font(53,latin=True),fill=(*color,215))
    stage=0 if t<1.5 else 1 if t<3.5 else 2
    stage_start=[0,1.5,3.5][stage]
    alpha=round(255*min(1,(t-stage_start)/.2+.15))
    draw.text((54,867),f"ACT 0{stage+1}  /  {['命运开局','剧情反转','主角觉醒'][stage]}",font=font(17),fill=(*color,alpha))
    draw.text((50,913),role['name'],font=font(53,bold=True),fill=(247,237,222,255))
    draw.text((54,988),role['english'],font=font(17,latin=True),fill=(*color,200))
    beat=role['beats'][stage]
    textfont=font(23)
    parts=[beat]
    if draw.textlength(beat,font=textfont)>606:
        split=len(beat)//2
        parts=[beat[:split],beat[split:]]
    for i,part in enumerate(parts): draw.text((54,1041+i*34),part,font=textfont,fill=(181,193,211,alpha))
    draw.line((54,1172,666,1172),fill=(117,135,163,65),width=2)
    draw.line((54,1172,54+612*t/5,1172),fill=(*color,190),width=2)
    draw.text((54,1200),'原创插画动态分镜 · 非真人成片',font=font(13),fill=(118,135,161,230))
    draw.text((613,1197),f'{min(5,int(t)+1):02d}/05',font=font(16,latin=True),fill=(*color,185))
    return Image.alpha_composite(canvas,shade).convert('RGB')


def main():
    STAGING.mkdir(parents=True,exist_ok=True)
    BACKUP.mkdir(parents=True,exist_ok=True)
    manifest_path=MEDIA/'manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    result=subprocess.run(['node','--input-type=module','-e',"import {roles} from './src/data/roles.js'; process.stdout.write(JSON.stringify(roles))"],cwd=ROOT,capture_output=True,encoding='utf-8',check=True)
    roles=json.loads(result.stdout)
    selected=[role for role in roles if manifest.get(role['id'],{}).get('status')=='storyboard']
    original_hashes={role['id']:hashlib.sha256((MEDIA/f"{role['id']}.mp4").read_bytes()).hexdigest() for role in selected}
    for index,role in enumerate(selected):
        source=Image.open(WORK/'world-renders'/f"{role['id']}.png").convert('RGB')
        audio=STAGING/f"{role['id']}.wav"
        soundtrack(audio,index)
        output=STAGING/f"{role['id']}.mp4"
        command=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(audio),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-t','5','-movflags','+faststart',str(output)]
        process=subprocess.Popen(command,stdin=subprocess.PIPE)
        for frame in range(FPS*5): process.stdin.write(scene_frame(role,source,frame/FPS).tobytes())
        process.stdin.close()
        if process.wait()!=0: raise RuntimeError(f"Render failed: {role['id']}")
        scene_frame(role,source,4.6).save(STAGING/f"{role['id']}.jpg",quality=94)
        print(f"Rendered {index+1}/{len(selected)}: {role['id']}",flush=True)
    current=json.loads(manifest_path.read_text(encoding='utf-8'))
    for role in selected:
        name=role['id']
        target=MEDIA/f'{name}.mp4'
        if current[name]['status']!='storyboard' or hashlib.sha256(target.read_bytes()).hexdigest()!=original_hashes[name]:
            raise RuntimeError('Media changed during rendering; staged files were kept, originals were not replaced.')
    for role in selected:
        for extension in ['mp4','jpg']:
            name=f"{role['id']}.{extension}"
            if not (BACKUP/name).exists(): shutil.copy2(MEDIA/name,BACKUP/name)
            shutil.copy2(STAGING/name,MEDIA/name)
        current[role['id']]['edition']='multiverse-v2'
    manifest_path.write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Illustrated storyboards installed. Previous clips are preserved in .work/before-redesign/media.',flush=True)


if __name__=='__main__': main()
