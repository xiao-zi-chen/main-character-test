"""Prepare resumable jobs for the imagegen skill CLI; never calls a paid API."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'output/imagegen/chatanywhere-image25'
PLAN = ROOT / 'content/question-art-image25-prompts.json'
KINDS = ['scene', 'left', 'right', *[f'scale-{i}' for i in range(5)]]
MODEL = 'gpt-image-2.5-flare'
CONSTRAINTS = ('\nHARD REQUIREMENT: Absolutely no written text anywhere in the image: '
    'no Chinese characters, letters, numbers, subtitles, captions, signage, labels, logos or watermarks. '
    'Books contain only wordless pictures; all screens show only photographs or pictograms. '
    'Show the physical action clearly with natural anatomy and lifelike facial expressions. '
    'A single cohesive photographic scene, never a collage. Landscape composition.')
PILOTS = {('1.1', 'scene'): 1, ('6.3', 'scale-4'): 2, ('9.1', 'scale-4'): 3}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    raw = OUTPUT / 'raw'
    raw.mkdir(exist_ok=True)
    jobs_dir = ROOT / '.work/image25-jobs'
    jobs_dir.mkdir(parents=True, exist_ok=True)
    if PLAN.exists():
        plan = json.loads(PLAN.read_text(encoding='utf-8'))
    else:
        plan = json.loads((ROOT / 'content/question-art-production.json').read_text(encoding='utf-8'))
        plan['previousRevision'] = plan['revision']
        plan['revision'] = '2026-10-19-chatanywhere-image25-flare-v1'
        plan['model'] = MODEL
        plan['provider'] = 'ChatAnywhere'
        plan['request'] = {'size': '1536x1024', 'quality': 'medium', 'n': 1, 'output_format': 'png'}
        plan['generationMethod'] = 'imagegen skill CLI; one independent request per asset'
        plan['seedNote'] = 'Seeds are null: this API workflow does not request a reproducible seed.'
        plan['identityNote'] = 'Identity is guided by matching descriptions, without reference-image conditioning.'
        for qi, question in enumerate(plan['questions']):
            for ki, kind in enumerate(KINDS):
                spec = question['assets'][kind]
                spec['seed'] = None
                spec['prompt'] += CONSTRAINTS
                spec['keyAlias'] = f"api{PILOTS.get((question['id'], kind), (qi * 8 + ki) % 3 + 1)}"
                spec['localJobId'] = f"image25/{question['id']}/{kind}"
                spec['promptSha256'] = hashlib.sha256(spec['prompt'].encode()).hexdigest()
            question['generationPrompt'] = '\n\n'.join(a['prompt'] for a in question['assets'].values())
        PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    assert len(plan['questions']) == 40
    jobs = {f'api{i}': [] for i in range(1, 4)}
    ready = 0
    for question in plan['questions']:
        slug = question['id'].replace('.', '-')
        assert set(question['assets']) == set(KINDS)
        for kind in KINDS:
            spec = question['assets'][kind]
            filename = f'{slug}__{kind}.png'
            pilot = OUTPUT / slug / f'{kind}.png'
            if pilot.exists() and not (raw / filename).exists():
                assert (pilot.with_suffix('.prompt.txt')).read_text(encoding='utf-8') == spec['prompt']
                shutil.copy2(pilot, raw / filename)
            if (raw / filename).exists():
                from PIL import Image
                with Image.open(raw / filename) as image:
                    image.verify()
                ready += 1
                continue
            jobs[spec['keyAlias']].append({'prompt': spec['prompt'], 'out': filename})
    for alias, batch in jobs.items():
        (jobs_dir / f'{alias}.jsonl').write_text(''.join(json.dumps(j, ensure_ascii=False) + '\n' for j in batch), encoding='utf-8')
    print(json.dumps({'ready': ready, 'remaining': {k: len(v) for k, v in jobs.items()}, 'model': MODEL}))


if __name__ == '__main__':
    main()
