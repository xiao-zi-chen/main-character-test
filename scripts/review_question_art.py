"""Create contact sheets for visual QA of all eight images per question."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parent.parent
production=json.loads((root/'content/question-art-production.json').read_text(encoding='utf-8'))
stage=root/'public/question-art'
output=root/'docs/assets'
output.mkdir(exist_ok=True)
kinds=['scene','left','right',*[f'scale-{i}' for i in range(5)]]
try:
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf' if Path('C:/Windows/Fonts/arial.ttf').exists() else 'DejaVuSans.ttf',17)
except OSError:
    font=ImageFont.load_default(size=17)
ready=[q for q in production['questions'] if all((stage/q['id'].replace('.','-')/f'{kind}.webp').exists() for kind in kinds)]
for start in range(0,len(ready),5):
    group=ready[start:start+5]
    canvas=Image.new('RGB',(2304,210*len(group)), '#f6f4ed');draw=ImageDraw.Draw(canvas)
    for row,question in enumerate(group):
        for column,kind in enumerate(kinds):
            source=stage/question['id'].replace('.','-')/f'{kind}.webp'
            with Image.open(source) as image:
                image.thumbnail((288,160))
                canvas.paste(image,(column*288,row*210+30))
            draw.text((column*288+8,row*210+6),question['id']+' / '+kind,font=font,fill='#23372d')
    canvas.save(output/f'question-art-overview-{start//5+1}.jpg',quality=92)
print(f'Review sheets contain {len(ready)} complete questions ({len(ready)*8} images).')
