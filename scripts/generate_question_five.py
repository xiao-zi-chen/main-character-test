"""Generate eight independent MiniMax H3 illustrations per question, resumably."""
import argparse, json, sys, time, hashlib
from pathlib import Path
import requests
from PIL import Image

def generate(args):
    sys.path.insert(0, str(args.runtime))
    from workflow import build_graph
    production = json.loads(args.prompts.read_text(encoding='utf-8'))
    args.output.mkdir(parents=True, exist_ok=True)
    for question in production['questions']:
        if args.only and question['id'] not in args.only: continue
        slug = question['id'].replace('.', '-')
        folder = args.output / slug
        folder.mkdir(exist_ok=True)
        for kind, spec in question['assets'].items():
            complete = folder / f'{kind}.json'
            if complete.exists():
                previous=json.loads((folder/f'{kind}.workflow.json').read_text(encoding='utf-8'))
                changed=previous['5']['inputs']['prompt']!=spec['prompt'] or previous['6']['inputs']['noise_seed']!=spec['seed']
                if not args.refresh_changed or not changed: continue
                archive=folder/'.history'/str(time.time_ns()); archive.mkdir(parents=True)
                for suffix in ['json','pending.json','workflow.json','png','webp']:
                    existing=folder/f'{kind}.{suffix}'
                    if existing.exists(): existing.rename(archive/existing.name)
            started = time.time()
            pending = folder / f'{kind}.pending.json'
            if pending.exists():
                prompt_id = json.loads(pending.read_text())['promptId']
            else:
                graph = build_graph(dict(id=f'question-five/{slug}/{kind}',profile='balanced',mode='text',prompt=spec['prompt'],seed=spec['seed'],duration=5,end_style='none'))
                graph['5']['inputs'].update(width=1152,height=640,length=5)
                for node in ['4','12','13','14']: del graph[node]
                graph['18'] = {'class_type':'ImageFromBatch','inputs':{'image':['11',0],'batch_index':0,'length':1}}
                graph['19'] = {'class_type':'SaveImage','inputs':{'images':['18',0],'filename_prefix':f'question-five/{slug}/{kind}'}}
                (folder/f'{kind}.workflow.json').write_text(json.dumps(graph,ensure_ascii=False,indent=2),encoding='utf-8')
                response=requests.post(args.api+'/prompt',json={'prompt':graph},timeout=60)
                response.raise_for_status()
                submitted=response.json()
                if submitted.get('node_errors'): raise RuntimeError(submitted['node_errors'])
                prompt_id=submitted['prompt_id']
                pending.write_text(json.dumps({'promptId':prompt_id}))
            print(f'START {question["id"]}/{kind} {prompt_id}',flush=True)
            deadline=time.monotonic()+1800
            while time.monotonic()<deadline:
                response=requests.get(args.api+'/history/'+prompt_id,timeout=30)
                response.raise_for_status()
                history=response.json().get(prompt_id,{})
                if history.get('status',{}).get('status_str')=='error':
                    raise RuntimeError(json.dumps(history['status']))
                images=history.get('outputs',{}).get('19',{}).get('images')
                if images:
                    response=requests.get(args.api+'/view',params=images[0],timeout=90)
                    response.raise_for_status()
                    source=folder/f'{kind}.png'; source.write_bytes(response.content)
                    target=folder/f'{kind}.webp'
                    with Image.open(source) as image:
                        image.convert('RGB').save(target,quality=90,method=6)
                        size=list(image.size)
                    data=target.read_bytes()
                    record=dict(file=f'{slug}/{kind}.webp',size=size,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),seed=spec['seed'],promptId=prompt_id,promptSha256=hashlib.sha256(spec['prompt'].encode('utf-8')).hexdigest(),seconds=round(time.time()-started,2),model='MiniMax H3 fl2va int8 + 8-step LoRA',sourceVersion=args.output.name)
                    complete.write_text(json.dumps(record,indent=2))
                    print(f'DONE {question["id"]}/{kind} {record["seconds"]}s',flush=True)
                    break
                time.sleep(0.6)
            else: raise TimeoutError(f'Pending {prompt_id}; resume this directory without resubmission.')
    print('ALL REQUESTED IMAGES COMPLETE',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime',type=Path,default=Path('/root/autodl-tmp/minimax-h3'))
    parser.add_argument('--api',default='http://127.0.0.1:8188')
    parser.add_argument('--prompts',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--only',nargs='*')
    parser.add_argument('--refresh-changed',action='store_true',help='Archive and regenerate completed images only when their prompt or seed changed.')
    generate(parser.parse_args())
