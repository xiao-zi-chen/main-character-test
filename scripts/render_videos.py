"""Render original motion-design storyboards. These are not live-action films.

Requires Pillow and FFmpeg. The ten final production prompts are in
视频生成Prompt.md; replace these clips after generating the live-action films.
"""
import json
import math
import os
import subprocess
import wave
from array import array
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'public' / 'media'
WORK = ROOT / '.work'
W, H, FPS = 540, 960, 24
FONT_DIR = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
FONT_ZH = FONT_DIR / 'msyh.ttc'
FONT_BOLD = FONT_DIR / 'msyhbd.ttc'
FONT_LATIN = FONT_DIR / 'bahnschrift.ttf'
FONTS = {}


def font(size, bold=False, latin=False):
    key = (size, bold, latin)
    if key not in FONTS:
        path = FONT_LATIN if latin else FONT_BOLD if bold else FONT_ZH
        if not path.exists():
            path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        FONTS[key] = ImageFont.truetype(str(path), size)
    return FONTS[key]


def rgb(color):
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def motif(draw, kind, color, t):
    cx, cy = 270, 425
    muted = mix((20, 23, 21), color, .25)
    faint = mix((20, 23, 21), color, .11)
    pulse = 1 + .035 * math.sin(t * 2)
    def line(points, width=3, fill=color):
        draw.line(points, fill=fill, width=width, joint='curve')
    def ellipse(box, width=2, fill=None, outline=color):
        draw.ellipse(box, outline=outline, width=width, fill=fill)
    # Orbital guides hold the ten symbols together as a visual system.
    ellipse((102, 257, 438, 593), outline=faint)
    ellipse((117, 272, 423, 578), outline=faint)
    for j in range(32):
        a = j * math.tau / 32 + t * .03
        x, y = cx + math.cos(a) * 168, cy + math.sin(a) * 168
        draw.ellipse((x-1, y-1, x+1, y+1), fill=muted)
    if kind in ('gate', 'door'):
        draw.rounded_rectangle((185, 308, 355, 550), radius=82 if kind == 'door' else 6, outline=color, width=4)
        draw.rectangle((185, 417, 355, 550), fill=(19, 22, 20), outline=color, width=4)
        line([(208, 549), (208, 355), (332, 355), (332, 549)], 2, muted)
        line([(150, 551), (390, 551)], 4)
        line([(165, 568), (375, 568)], 2, muted)
        if kind == 'gate':
            line([(155, 319), (270, 267), (385, 319)], 5)
            line([(172, 295), (270, 252), (368, 295)], 2, muted)
            for x in (230, 270, 310): ellipse((x-5, 403, x+5, 413), fill=color)
        else:
            for x in (244, 296): ellipse((x-9, 407, x+9, 419), fill=color)
            line([(270, 465), (270, 506)], 3, muted)
    elif kind == 'sun':
        radius = int(70*pulse)
        ellipse((cx-radius, cy-radius, cx+radius, cy+radius), width=4)
        ellipse((cx-51, cy-51, cx+51, cy+51), outline=muted)
        for j in range(12):
            a = j*math.tau/12 + t*.025
            line([(cx+math.cos(a)*89,cy+math.sin(a)*89),(cx+math.cos(a)*126,cy+math.sin(a)*126)],4)
        line([(155, 577), (206, 539), (235, 557), (286, 518), (331, 550), (386, 578)], 3, muted)
    elif kind == 'book':
        line([(270, 347), (171, 321), (171, 502), (270, 535), (369, 502), (369, 321), (270, 347), (270, 535)], 4)
        for offset in (0, 30, 60, 90):
            line([(194, 368+offset), (246, 385+offset)], 2, muted)
            line([(294, 385+offset), (346, 368+offset)], 2, muted)
        line([(306, 292), (325, 274), (341, 290)], 3)
        line([(325, 274), (325, 319)], 3)
    elif kind == 'system':
        for x,y,sx,sy in [(160,315,1,1),(380,315,-1,1),(160,535,1,-1),(380,535,-1,-1)]:
            line([(x,y+sy*28),(x,y),(x+sx*28,y)],4)
        draw.rounded_rectangle((191,346,349,504),radius=18,outline=color,width=3)
        ellipse((224,379,316,471),width=3)
        line([(270,393),(270,440),(288,422)],4)
        for n in range(7):
            draw.rectangle((187+n*25,561,203+n*25,571),fill=color if n<min(7,int(t*2)+1) else muted)
    elif kind == 'chess':
        line([(200, 524), (215, 488), (229, 471), (238, 384), (217, 350), (244, 366), (270, 322), (296, 366), (323, 350), (302, 384), (311, 471), (325, 488), (340, 524), (200, 524)], 4)
        line([(228,391),(312,391)],3,muted)
        line([(207,546),(333,546)],4)
        for x in (205,248,291,334): line([(x,567),(x-45,610)],1,faint)
        for y in (573,591,609): line([(151,y),(380,y)],1,faint)
        ellipse((262,296,278,312),fill=color)
    elif kind == 'thought':
        draw.rounded_rectangle((166,338,361,453),radius=27,outline=color,width=4)
        line([(204,452),(201,480),(240,453)],4)
        draw.rounded_rectangle((230,474,383,539),radius=21,outline=muted,width=3)
        for x in (219,266,313): ellipse((x-6,390,x+6,402),fill=color)
        for j in range(3):
            draw.arc((139-j*19,309-j*19,389+j*19,477+j*19),225,295,fill=muted,width=2)
    elif kind == 'orbit':
        ellipse((178,333,362,517),width=3)
        draw.arc((116,386,424,472),0,360,fill=color,width=4)
        ellipse((239,393,259,413),fill=color)
        ellipse((290,393,310,413),fill=color)
        draw.arc((236,416,312,474),0,180,fill=color,width=4)
        a=t*.7; x=cx+155*math.cos(a); y=cy+46*math.sin(a)
        ellipse((x-10,y-10,x+10,y+10),fill=color)
        line([(356,299),(365,326),(392,335),(365,344),(356,371),(347,344),(320,335),(347,326),(356,299)],2,muted)
    elif kind == 'lotus':
        line([(270,508),(234,432),(270,329),(306,432),(270,508)],4)
        line([(270,508),(195,472),(169,381),(238,415),(270,508),(345,472),(371,381),(302,415)],3)
        draw.arc((178,480,362,561),0,180,fill=color,width=4)
        ellipse((215,277,325,387),outline=muted)
        line([(181,572),(359,572)],2,muted)
    elif kind == 'bowl':
        draw.arc((161,364,379,565),0,180,fill=color,width=4)
        line([(161,465),(379,465)],4)
        line([(225,568),(315,568)],4)
        for j in range(3):
            x=227+j*44
            points=[(x+math.sin(k*.17+t*2+j)*8,423-k) for k in range(90)]
            line(points,3,muted)
        line([(315,442),(359,353)],5)
    # Single slowly orbiting light, without flashes.
    a = t*.3-1.3
    x,y=cx+168*math.cos(a),cy+168*math.sin(a)
    ellipse((x-4,y-4,x+4,y+4),fill=color)


def render(role, t):
    color = rgb(role['color'])
    image = Image.new('RGB', (W,H), (19,22,20))
    draw = ImageDraw.Draw(image)
    for y in range(H):
        amount=max(0,1-abs(y-420)/520)*.075
        draw.line((0,y,W,y),fill=mix((19,22,20),color,amount))
    for x in range(32,W,36): draw.line((x,192,x,621),fill=(28,31,28))
    for y in range(192,623,36): draw.line((32,y,508,y),fill=(28,31,28))
    draw.rounded_rectangle((30,30,510,930),radius=4,outline=mix((20,23,20),color,.25))
    draw.text((55,57),'CASTING ARCHIVE',font=font(16,latin=True),fill=color)
    draw.text((55,88),role['genre'],font=font(14),fill=(162,168,156))
    draw.text((385,48),role['number'],font=font(70,latin=True),fill=color)
    draw.line((55,138,485,138),fill=(64,70,59),width=1)
    draw.text((55,159),'A DIFFERENT LIFE. A DIFFERENT YOU.',font=font(12,latin=True),fill=(129,136,122))
    motif(draw,role['symbol'],color,t)
    draw.text((55,650),role['english'],font=font(16,latin=True),fill=color)
    draw.text((51,680),role['name'],font=font(45,bold=True),fill=(242,242,225))
    beat = role['beats'][0 if t<1.5 else 1 if t<3.5 else 2]
    # Wrap the storyboard line into two balanced lines if necessary.
    if draw.textlength(beat,font=font(19))>424:
        split = min(18,len(beat)//2+2)
        parts=[beat[:split],beat[split:]]
    else: parts=[beat]
    for i,part in enumerate(parts): draw.text((55,754+i*29),part,font=font(19),fill=(178,185,170))
    draw.line((55,851,485,851),fill=(59,65,54),width=2)
    draw.line((55,851,55+430*min(t/5,1),851),fill=color,width=3)
    draw.text((55,875),'动态分镜 · 非真人成片',font=font(13),fill=(142,150,132))
    draw.text((417,873),f'{min(int(t)+1,5):02d} / 05',font=font(13,latin=True),fill=color)
    return image


def soundtrack(path, index):
    rate=22050
    audio=array('h')
    root=110*2**((index%5)/12)
    for i in range(rate*5):
        t=i/rate
        sample=0.0
        for start,ratio in ((.15,1),(1.6,1.5),(3.55,2)):
            dt=t-start
            if 0<dt<1.4:
                envelope=min(1,dt/.06)*math.exp(-dt*3)*min(1,(1.4-dt)/.2)
                sample+=envelope*(math.sin(math.tau*root*ratio*dt)*.12+math.sin(math.tau*root*ratio*2*dt)*.035)
        audio.append(int(sample*24000))
    with wave.open(str(path),'wb') as output:
        output.setnchannels(1);output.setsampwidth(2);output.setframerate(rate);output.writeframes(audio.tobytes())


def main():
    MEDIA.mkdir(parents=True,exist_ok=True);WORK.mkdir(exist_ok=True)
    data=subprocess.run(['node','--input-type=module','-e',"import {roles} from './src/data/roles.js'; process.stdout.write(JSON.stringify(roles))"],cwd=ROOT,capture_output=True,check=True,encoding='utf-8')
    roles=json.loads(data.stdout)
    manifest={}
    for index,role in enumerate(roles):
        target=MEDIA/f"{role['id']}.mp4"
        if target.exists():
            raise RuntimeError(f'{target.name} exists. Renderer never overwrites possible final films.')
        audio=WORK/f"{role['id']}.wav";soundtrack(audio,index)
        command=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-', '-i',str(audio),'-vf','scale=720:1280','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-t','5','-movflags','+faststart',str(target)]
        process=subprocess.Popen(command,stdin=subprocess.PIPE)
        for frame in range(FPS*5): process.stdin.write(render(role,frame/FPS).tobytes())
        process.stdin.close()
        if process.wait()!=0: raise RuntimeError('FFmpeg failed')
        render(role,4.7).resize((720,1280),Image.Resampling.LANCZOS).save(MEDIA/f"{role['id']}.jpg",quality=92)
        manifest[role['id']]={'status':'storyboard','duration':5,'width':720,'height':1280}
        print(f"Rendered {role['number']}/10: {role['id']}",flush=True)
    (MEDIA/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('All ten 5-second motion-design storyboards are ready.',flush=True)


if __name__=='__main__': main()
