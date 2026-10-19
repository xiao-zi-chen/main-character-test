"""Validate all 320 reviewed images, back up existing artwork, then install locally."""
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image
from prepare_chatanywhere_art import ROOT, OUTPUT, PLAN, KINDS, MODEL


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    reviews = json.loads((OUTPUT / 'visual-review.json').read_text(encoding='utf-8'))
    assert len(plan['questions']) == 40
    assert all(reviews.get(q['id'], {}).get('status') == 'accepted' for q in plan['questions']), 'Review every question first'
    stage = ROOT / '.work/image25-staging'
    stage.mkdir(parents=True, exist_ok=True)
    manifest = {'revision': plan['revision'], 'model': MODEL, 'provider': 'ChatAnywhere', 'imageCount': 320,
                'generationMethod': plan['generationMethod'], 'questions': {}}
    hashes = set()
    for question in plan['questions']:
        qid = question['id']
        slug = qid.replace('.', '-')
        folder = stage / slug
        folder.mkdir(exist_ok=True)
        assets = {}
        for kind in KINDS:
            spec = question['assets'][kind]
            source = OUTPUT / 'raw' / f'{slug}__{kind}.png'
            source_data = source.read_bytes()
            source_hash = digest(source_data)
            assert source_hash == reviews[qid]['sourceSha256'][kind], f'Review is stale: {qid}/{kind}'
            target = folder / f'{kind}.webp'
            with Image.open(source) as image:
                image.load()
                assert image.format == 'PNG' and image.width >= 1000 and image.height >= 500
                size = list(image.size)
                image.convert('RGB').save(target, quality=94, method=6)
            data = target.read_bytes()
            sha = digest(data)
            assert sha not in hashes, f'Duplicate: {qid}/{kind}'
            hashes.add(sha)
            assets[kind] = {
                'file': f'{slug}/{kind}.webp', 'size': size, 'bytes': len(data), 'sha256': sha,
                'sourceSha256': source_hash, 'seed': None,
                'promptSha256': digest(spec['prompt'].encode('utf-8')),
                'promptId': spec['localJobId'], 'promptIdType': 'local-job-id',
                'providerRequestId': None, 'keyAlias': spec['keyAlias'],
                'model': MODEL, 'sourceVersion': plan['revision'],
                'generatedAt': datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).isoformat(),
            }
        manifest['questions'][qid] = {'artDirection': question['artDirection'], 'sourceVersion': plan['revision'], 'assets': assets}
    assert len(hashes) == 320
    # All validation and conversion complete before changing any currently displayed image.
    public = ROOT / 'public/question-art'
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = ROOT / f'.work/backup-before-image25-{stamp}'
    shutil.copytree(public, backup / 'question-art')
    for name in ['question-art-production.json', 'question-art-directions.json', 'question-art-selection.json']:
        shutil.copy2(ROOT / 'content' / name, backup / name)
    for question in plan['questions']:
        slug = question['id'].replace('.', '-')
        (public / slug).mkdir(exist_ok=True)
        for kind in KINDS:
            shutil.copy2(stage / slug / f'{kind}.webp', public / slug / f'{kind}.webp')
    payloads = {
        ROOT / 'content/question-art-production.json': plan,
        ROOT / 'content/question-art-directions.json': {q['id']: q['artDirection'] for q in plan['questions']},
        ROOT / 'content/question-art-selection.json': {q['id']: plan['revision'] for q in plan['questions']},
        public / 'manifest.json': manifest,
    }
    for target, payload in payloads.items():
        temp = target.with_suffix(target.suffix + '.tmp')
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temp.replace(target)
    print(json.dumps({'installed': len(hashes), 'backup': str(backup), 'model': MODEL}))


if __name__ == '__main__':
    main()
