"""Make contact sheets from completed API outputs, without changing site assets."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from prepare_chatanywhere_art import ROOT, OUTPUT, PLAN, KINDS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='*')
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    review = OUTPUT / 'review'
    review.mkdir(exist_ok=True)
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 19)
    complete = []
    available = 0
    for question in plan['questions']:
        qid = question['id']
        slug = qid.replace('.', '-')
        files = [OUTPUT / 'raw' / f'{slug}__{kind}.png' for kind in KINDS]
        available += sum(file.exists() for file in files)
        if not all(file.exists() for file in files):
            continue
        complete.append(qid)
        if args.only and qid not in args.only:
            continue
        target = review / f'{slug}.jpg'
        if target.exists() and target.stat().st_mtime > max(f.stat().st_mtime for f in files):
            continue
        canvas = Image.new('RGB', (1600, 690), '#f5f3ed')
        draw = ImageDraw.Draw(canvas)
        draw.text((12, 8), f"{qid} {question['prompt']}", font=font, fill='#182b23')
        draw.text((12, 36), '左：' + question['options'][0] + '     右：' + question['options'][1], font=font, fill='#38483d')
        for i, (kind, file) in enumerate(zip(KINDS, files)):
            x, y = (i % 4) * 400, 72 + (i // 4) * 307
            draw.text((x + 8, y), kind, font=font, fill='#23372d')
            with Image.open(file) as source:
                tile = ImageOps.contain(source.convert('RGB'), (396, 264))
                canvas.paste(tile, (x + (400 - tile.width) // 2, y + 30))
        canvas.save(target, quality=93)
    print(json.dumps({'images': available, 'completeQuestions': complete}, ensure_ascii=False))


if __name__ == '__main__':
    main()
