"""Run on the generation server to repair reviewed subtitle regions with LaMa."""
import argparse,hashlib,importlib,json,os
from pathlib import Path
from PIL import Image,ImageDraw
from simple_lama_inpainting import SimpleLama

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--jobs',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
jobs=json.loads(args.jobs.read_text(encoding='utf-8'))['images']
module=importlib.import_module(SimpleLama.__module__)
print('Loading subtitle repair model',flush=True)
checkpoint=Path(module.download_model(module.LAMA_MODEL_URL))
os.environ['LAMA_MODEL']=str(checkpoint)
model_hash=hashlib.sha256(checkpoint.read_bytes()).hexdigest()
model=SimpleLama()
for index,(key,job) in enumerate(jobs.items()):
    source=Path('/root/autodl-tmp/minimax-h3/outputs')/job['sourceVersion']/job['file']
    data=source.read_bytes();assert hashlib.sha256(data).hexdigest()==job['sourceSha256']
    target=args.output/job['file'];target.parent.mkdir(parents=True,exist_ok=True)
    complete=target.with_suffix('.json')
    if complete.exists():
        previous=json.loads(complete.read_text())
        if previous['sourceSha256']==job['sourceSha256'] and previous['regions']==job['regions']:
            print('SKIP',key,flush=True);continue
    with Image.open(source) as image:
        image=image.convert('RGB');mask=Image.new('L',image.size,0);draw=ImageDraw.Draw(mask)
        for x0,y0,x1,y1 in job['regions']:
            draw.rectangle([max(0,x0-4),max(0,y0-4),min(image.width-1,x1+4),min(image.height-1,y1+4)],fill=255)
        mask.save(target.with_suffix('.mask.png'))
        cleaned=model(image,mask)
        cleaned.save(target,quality=92,method=6)
        size=list(cleaned.size)
    output=target.read_bytes()
    record={**job,'method':'LaMa subtitle-region inpainting','modelSha256':model_hash,'sha256':hashlib.sha256(output).hexdigest(),'bytes':len(output),'size':size}
    complete.write_text(json.dumps(record,indent=2),encoding='utf-8')
    print(f'DONE {index+1}/{len(jobs)} {key}',flush=True)
print('ALL SUBTITLE REPAIRS COMPLETE',flush=True)
