"""Generate coherent three-panel question artwork with the server's local MiniMax H3.

Run on the existing MiniMax server, using its venv and workflow module. No API keys.
Outputs are resumable; an existing completed question is never regenerated implicitly.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import requests
from PIL import Image


def generate(args):
    sys.path.insert(0, str(args.runtime))
    from workflow import build_graph

    jobs = json.loads(args.prompts.read_text(encoding='utf-8'))['questions']
    args.output.mkdir(parents=True, exist_ok=True)
    for job in jobs:
        if args.only and job['id'] not in args.only:
            continue
        slug = job['id'].replace('.', '-')
        folder = args.output / slug
        folder.mkdir(exist_ok=True)
        if (folder / 'complete.json').exists():
            print(f"SKIP {job['id']}", flush=True)
            continue
        started = time.time()
        graph = build_graph(dict(id=f'question-art/{slug}', profile='balanced',
                                 mode='text', prompt=job['generationPrompt'],
                                 seed=job['seed'], duration=5, end_style='none'))
        # H3's minimum five-frame latent produces a static storyboard. Only its
        # first frame is exported, without synthesizing or saving unused audio.
        graph['5']['inputs'].update(width=1152, height=1728, length=5)
        for node in ['4', '12', '13', '14']:
            del graph[node]
        graph['18'] = {'class_type': 'ImageFromBatch', 'inputs': {
            'image': ['11', 0], 'batch_index': 0, 'length': 1}}
        graph['19'] = {'class_type': 'SaveImage', 'inputs': {
            'images': ['18', 0], 'filename_prefix': f'question-art/{slug}'}}
        (folder / 'workflow.json').write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding='utf-8')
        response = requests.post(args.api + '/prompt', json={'prompt': graph}, timeout=60)
        response.raise_for_status()
        submitted = response.json()
        if submitted.get('node_errors'):
            raise RuntimeError(submitted['node_errors'])
        prompt_id = submitted['prompt_id']
        print(f"START {job['id']} {prompt_id}", flush=True)
        deadline = time.monotonic() + 1800
        while time.monotonic() < deadline:
            history_response = requests.get(args.api + '/history/' + prompt_id, timeout=30)
            history_response.raise_for_status()
            history = history_response.json().get(prompt_id)
            if history:
                if history.get('status', {}).get('status_str') == 'error':
                    raise RuntimeError(json.dumps(history['status']))
                images = history.get('outputs', {}).get('19', {}).get('images')
                if images:
                    record = images[0]
                    image_response = requests.get(args.api + '/view', params=record, timeout=90)
                    image_response.raise_for_status()
                    sheet = folder / 'storyboard.png'
                    sheet.write_bytes(image_response.content)
                    with Image.open(sheet) as source:
                        width, height = source.size
                        for index, name in enumerate(['scene', 'left', 'right']):
                            # The generated sheet has three equal horizontal
                            # panels. Trim the narrow panel separators.
                            top, bottom = round(index * height / 3), round((index + 1) * height / 3)
                            image = source.crop((8, top + 10, width - 8, bottom - 10)).convert('RGB')
                            image.save(folder / f'{name}.webp', quality=89, method=6)
                    metadata = dict(id=job['id'], seed=job['seed'], promptId=prompt_id,
                                    model='MiniMax H3 fl2va int8 + 8-step LoRA',
                                    seconds=round(time.time() - started, 1), sourceSize=[width, height],
                                    artDirection=job.get('artDirection'))
                    (folder / 'complete.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
                    print(f"DONE {job['id']} {metadata['seconds']}s", flush=True)
                    break
            time.sleep(3)
        else:
            raise TimeoutError(f'Generation timed out: {prompt_id}; check ComfyUI before resubmitting')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, default=Path('/root/autodl-tmp/minimax-h3'))
    parser.add_argument('--api', default='http://127.0.0.1:8188')
    parser.add_argument('--prompts', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--only', nargs='*')
    generate(parser.parse_args())
