"""Import supplied PNG/WebP artwork without changing decoded pixels or scoring.

Run from any directory: python scripts/import_workbook_art.py
Requires Pillow and openpyxl. Original input files are never modified.
"""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import shutil

import openpyxl
from PIL import Image

SOURCE = pathlib.Path(__file__).resolve().parents[1]
PROJECT = SOURCE.parent
WORKBOOK = PROJECT / 'prompt.xlsx'
INPUT = PROJECT / 'alter_images'
KINDS = ['scene', 'left', 'right', *[f'scale-{n}' for n in range(5)]]
# Order follows A -> B, not the high-scoring direction of the dimension.
ORDERS = {'8.1': [5, 4, 3, 2, 1], '7.4': [1, 5, 4, 3, 2]}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def read_rows():
    book = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)
    sheet = book['完整题库']
    rows = {}
    # The workbook has formatted cells through XFD; only A:I contain input.
    for number, row in enumerate(sheet.iter_rows(min_row=2, max_row=41, max_col=9, values_only=True), 2):
        match = re.fullmatch(r'\s*((?:10|[1-9])\.[1-4])\s*[｜|]\s*(.+)', str(row[1]), re.DOTALL)
        assert match, f'Invalid question number at row {number}'
        qid, prompt = match.groups()
        assert qid not in rows
        assert all(isinstance(value, str) and value.strip() for value in row[2:9]), qid
        rows[qid] = {'sourceRow': number, 'sourcePrompt': prompt.strip(),
                     'sourceOptions': [value.strip() for value in row[2:4]],
                     'prompts': [value.strip() for value in row[4:9]]}
    book.close()
    catalog = json.loads((PROJECT / 'data/questions.json').read_text(encoding='utf-8'))
    assert len(rows) == 40 and set(rows) == {q['id'] for q in catalog['questions']}
    return rows


def read_images(rows):
    supplied = {path for path in INPUT.rglob('*') if path.suffix.lower() in {'.png', '.webp'}}
    images = {}
    for qid in rows:
        for level in range(1, 6):
            matches = [INPUT / qid / f'{qid}_{level}{extension}' for extension in ['.png', '.webp']
                       if INPUT / qid / f'{qid}_{level}{extension}' in supplied]
            assert len(matches) == 1, f'Expected one PNG or WebP: {qid}_{level}'
            images[qid, level] = matches[0]
    assert supplied == set(images.values()), 'Additional or noncanonical source images'
    assert not INPUT.is_symlink() and all(not path.is_symlink() and not path.parent.is_symlink() for path in supplied)
    return images


def read_reports(rows, images, source_hashes):
    """Check supplied conversion/generation provenance against actual inputs."""
    reports = []
    conversion = INPUT / 'webp_conversion_report.json'
    if conversion.exists():
        report = json.loads(conversion.read_text(encoding='utf-8'))
        entries = report['images']
        expected = {path.relative_to(INPUT).as_posix() for path in images.values() if path.suffix == '.webp'}
        assert report['format'] == 'WEBP' and report['count'] == len(expected)
        assert len(entries) == len(expected) and {entry['file'] for entry in entries} == expected
        for entry in entries:
            path = INPUT / entry['file']
            assert entry['sha256'] == source_hashes[path.relative_to(PROJECT).as_posix()], path
            assert entry['bytes'] == path.stat().st_size and entry['size'] == [1536, 1024], path
            assert entry['format'] == 'WEBP' and entry['resized'] is False, path
        assert report['total_webp_bytes'] == sum(entry['bytes'] for entry in entries)
        reports.append({'file': conversion.relative_to(PROJECT).as_posix(),
                        'sha256': digest(conversion.read_bytes()), 'verifiedImageCount': len(entries)})

    def generation_entries(value):
        if isinstance(value, dict):
            if 'out' in value:
                yield value
            for child in value.values():
                yield from generation_entries(child)
        elif isinstance(value, list):
            for child in value:
                yield from generation_entries(child)

    for path in sorted(INPUT.glob('*generation_manifest.json')):
        entries = list(generation_entries(json.loads(path.read_text(encoding='utf-8'))))
        for entry in entries:
            source = INPUT / entry['out']
            assert source in images.values(), f'Unknown generation source: {source}'
            qid = source.parent.name
            level = int(source.stem.split('_')[1])
            assert entry['sha256'] == source_hashes[source.relative_to(PROJECT).as_posix()], source
            assert entry['bytes'] == source.stat().st_size, source
            assert entry['original_prompt'].strip() == rows[qid]['prompts'][level - 1], source
        reports.append({'file': path.relative_to(PROJECT).as_posix(),
                        'sha256': digest(path.read_bytes()), 'verifiedImageCount': len(entries)})
    return reports


def main():
    rows = read_rows()
    images = read_images(rows)
    source_hashes = {str(path.relative_to(PROJECT)).replace('\\', '/'): digest(path.read_bytes())
                     for path in sorted(images.values())}
    assert len(set(source_hashes.values())) == 200, 'Duplicate supplied images'
    reports = read_reports(rows, images, source_hashes)
    workbook_hash = digest(WORKBOOK.read_bytes())
    revision_hash = digest(json.dumps({'workbook': workbook_hash, 'images': source_hashes, 'orders': ORDERS}, sort_keys=True).encode())[:12]
    revision = '2026-10-27-workbook-images-' + revision_hash
    tag = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    stage = PROJECT / '.local' / 'question-art-imports' / tag
    stage.mkdir(parents=True)
    converted = stage / 'converted'
    converted.mkdir()

    def convert(item):
        qid, level = item
        source_path = images[qid, level]
        data = source_path.read_bytes()
        with Image.open(source_path) as original:
            original.load()
            source_format = original.format
            assert source_format == {'.png': 'PNG', '.webp': 'WEBP'}[source_path.suffix], source_path
            assert original.size == (1536, 1024) and not getattr(original, 'is_animated', False), source_path
            mode = 'RGBA' if original.mode == 'RGBA' or 'transparency' in original.info else 'RGB'
            pixels = original.convert(mode)
            target = converted / f'{qid}_{level}.webp'
            if source_format == 'WEBP':
                # Preserve supplied WebP bytes, including its existing compression.
                shutil.copy2(source_path, target)
            else:
                pixels.save(target, 'WEBP', lossless=True, exact=True, method=4)
            with Image.open(target) as output:
                output.load()
                assert output.size == pixels.size and output.convert(mode).tobytes() == pixels.tobytes(), f'Pixels changed: {source_path}'
        output_data = target.read_bytes()
        assert source_format != 'WEBP' or output_data == data, f'WebP bytes changed: {source_path}'
        prompt = rows[qid]['prompts'][level - 1]
        return (qid, level), {'size': [1536, 1024], 'bytes': len(output_data), 'sha256': digest(output_data),
                             'sourceFile': source_path.relative_to(PROJECT).as_posix(), 'sourceLevel': level,
                             'sourceFormat': source_format,
                             'importMethod': 'byte-copy' if source_format == 'WEBP' else 'lossless-conversion',
                             'sourceSha256': digest(data), 'prompt': prompt, 'promptSha256': digest(prompt.encode('utf-8'))}

    records = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
        for count, (key, record) in enumerate(workers.map(convert, [(qid, level) for qid in rows for level in range(1, 6)]), 1):
            records[key] = record
            if count % 40 == 0:
                print(f'Imported and verified source pixels: {count}/200', flush=True)
    assert len({record['sha256'] for record in records.values()}) == 200
    manifest = {'revision': revision, 'importType': 'workbook-images', 'imageCount': 320, 'uniqueImageCount': 200,
                'generationMethod': 'User-supplied artwork; WebP bytes copied unchanged, PNG converted losslessly; decoded pixels verified',
                'sourceImageFormats': sorted({record['sourceFormat'] for record in records.values()}),
                'sourceReports': reports,
                'sourceWorkbook': {'file': 'prompt.xlsx', 'sheet': '完整题库', 'sha256': workbook_hash}, 'questions': {}}
    output = stage / 'question-art'
    output.mkdir()
    for qid, row in rows.items():
        order = ORDERS.get(qid, [1, 2, 3, 4, 5])
        levels = {'scene': 3, 'left': order[0], 'right': order[-1], **{f'scale-{index}': level for index, level in enumerate(order)}}
        slug = qid.replace('.', '-')
        (output / slug).mkdir()
        assets = {}
        for kind in KINDS:
            level = levels[kind]
            filename = f'{slug}/{kind}.webp'
            shutil.copy2(converted / f'{qid}_{level}.webp', output / filename)
            assets[kind] = {'file': filename, **records[qid, level]}
        manifest['questions'][qid] = {key: value for key, value in row.items() if key != 'prompts'}
        manifest['questions'][qid].update({'scaleSourceLevels': order, 'sceneSourceLevel': 3, 'assets': assets})
    save_json(output / 'manifest.json', manifest)

    # Validate input stability, then back up all replaced source assets and copy.
    assert digest(WORKBOOK.read_bytes()) == workbook_hash
    assert all(digest((PROJECT / name).read_bytes()) == hash_value for name, hash_value in source_hashes.items())
    assert all(digest((PROJECT / report['file']).read_bytes()) == report['sha256'] for report in reports)
    backup = stage / 'before'
    backup.mkdir()
    public = SOURCE / 'public/question-art'
    shutil.copytree(public, backup / 'question-art')
    copy_file = SOURCE / 'src/data/question-copy.js'
    shutil.copy2(copy_file, backup / 'question-copy.js')
    reactions_file = SOURCE / 'src/data/question-reactions.js'
    shutil.copy2(reactions_file, backup / 'question-reactions.js')
    shutil.copy2(PROJECT / 'data/questions.json', backup / 'questions.json')
    for entry in manifest['questions'].values():
        for asset in entry['assets'].values():
            shutil.copy2(output / asset['file'], public / asset['file'])
    shutil.copy2(output / 'manifest.json', public / 'manifest.json')
    copy = {qid: {'prompt': row['sourcePrompt'], 'options': row['sourceOptions']} for qid, row in rows.items()}
    copy_text = ('// Imported from prompt.xlsx by scripts/import_workbook_art.py. IDs and scoring direction are unchanged.\n'
                 + 'export const questionCopy = ' + json.dumps(copy, ensure_ascii=False, indent=2) + ';\n')
    copy_changed = copy_file.read_text(encoding='utf-8') != copy_text
    if copy_changed:
        copy_file.write_text(copy_text, encoding='utf-8')
    labels = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧']
    faces = ['(•̀ᴗ•́)و', '(・ᴗ・)', '( ˙꒳˙ )', '(・_・)', '(•̀_•́)']
    symbols = ['←', '←', '↔', '→', '→']
    reactions = {qid: [{'caption': labels[index] + '：' + entry['assets'][f'scale-{index}']['prompt'],
                        'face': faces[index], 'symbol': symbols[index]} for index in range(5)]
                 for qid, entry in manifest['questions'].items()}
    reactions_text = ('// Accessible descriptions follow the imported image order from prompt.xlsx.\n'
                      + 'export const questionReactions = ' + json.dumps(reactions, ensure_ascii=False, indent=2) + ';\n')
    if reactions_file.read_text(encoding='utf-8') != reactions_text:
        reactions_file.write_text(reactions_text, encoding='utf-8')
    summary = {'revision': revision, 'sourceImages': 200, 'publicImages': 320, 'pixelChecksPassed': 200,
               'sourceBytes': sum((PROJECT / name).stat().st_size for name in source_hashes),
               'uniqueWebpBytes': sum(record['bytes'] for record in records.values()),
               'sourceFormats': manifest['sourceImageFormats'],
               'byteIdenticalWebpCopies': sum(record['sourceFormat'] == 'WEBP' for record in records.values()),
               'verifiedSourceReports': len(reports), 'questionCopyChanged': copy_changed,
               'orderOverrides': ORDERS, 'backup': str(backup), 'cloudChanged': False}
    save_json(stage / 'import-result.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
