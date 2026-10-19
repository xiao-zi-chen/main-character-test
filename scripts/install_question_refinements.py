"""Install the reviewed replacement images after the full base batch is synced."""
import hashlib, json, os, shutil
from pathlib import Path
import paramiko
from PIL import Image
from sync_question_five import PinnedHost, ROOT

public=ROOT/'public/question-art'
manifest=json.loads((public/'manifest.json').read_text(encoding='utf-8'))
if 'minimax-five-v7' not in manifest.get('revision',''):
    raise RuntimeError('This is the historical v7 installer. Use install_realistic_question_art.py for the current realistic set.')
if manifest.get('imageCount')!=320:
    raise RuntimeError('Sync all 320 base images before installing refinements.')
production=json.loads((ROOT/'content/question-art-five-prompts.json').read_text(encoding='utf-8'))
refinements=json.loads((ROOT/'content/question-art-refinements.json').read_text(encoding='utf-8'))
stage=ROOT/'.work/question-art-v8-refined'; stage.mkdir(parents=True,exist_ok=True)
remote='/root/autodl-tmp/minimax-h3/outputs/question-art-v8-refined'
client=paramiko.SSHClient(); client.set_missing_host_key_policy(PinnedHost())
client.connect('connect.nma1.seetacloud.com',port=49880,username='root',password=os.environ['ART_SSH_PASSWORD'],timeout=25)
records=[]
try:
    with client.open_sftp() as sftp:
        for qid,assets in refinements.items():
            slug=qid.replace('.','-'); folder=stage/slug; folder.mkdir(exist_ok=True)
            for kind in assets:
                with sftp.open(f'{remote}/{slug}/{kind}.json') as stream: record=json.load(stream)
                with sftp.open(f'{remote}/{slug}/{kind}.workflow.json') as stream: workflow=json.load(stream)
                spec=next(q['assets'][kind] for q in production['questions'] if q['id']==qid)
                assert workflow['5']['inputs']['prompt']==spec['prompt'],f'Stale refinement prompt: {qid}/{kind}'
                assert workflow['6']['inputs']['noise_seed']==spec['seed']==record['seed']
                assert record['file']==f'{slug}/{kind}.webp'
                destination=folder/f'{kind}.webp'
                sftp.get(f'{remote}/{slug}/{kind}.webp',str(destination))
                data=destination.read_bytes()
                assert hashlib.sha256(data).hexdigest()==record['sha256'] and len(data)==record['bytes']
                with Image.open(destination) as image:
                    assert image.format=='WEBP' and list(image.size)==record['size']
                    image.load()
                (folder/f'{kind}.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
                records.append((qid,kind,record,destination))
finally: client.close()
for qid,kind,record,source in records:
    target=public/record['file']; backup=ROOT/'.work/question-art-pre-refinement'/record['file']
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists(): shutil.copy2(target,backup)
    shutil.copy2(source,target)
    # Contact sheets should show exactly the installed production images.
    shutil.copy2(source,ROOT/'.work/question-art-v7'/record['file'])
    (ROOT/'.work/question-art-v7'/record['file']).with_suffix('.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
    manifest['questions'][qid]['assets'][kind]=record
    manifest['questions'][qid]['artDirection']=next(q['artDirection'] for q in production['questions'] if q['id']==qid)
    manifest['questions'][qid]['sourceVersion']='question-art-v7 + question-art-v8-refined'
manifest['revision']='2026-10-19-minimax-five-v7-r1'
production['revision']=manifest['revision']
(public/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'content/question-art-production.json').write_text(json.dumps(production,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'content/question-art-selection.json').write_text(json.dumps({qid:entry['sourceVersion'] for qid,entry in manifest['questions'].items()},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Installed {len(records)} verified refinements. All other images remain from the complete v7 batch.')
