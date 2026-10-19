"""Assemble and verify every realistic base image and reviewed replacement before publishing locally."""
import hashlib,json,os,shutil
from pathlib import Path
import paramiko
from PIL import Image
from sync_question_five import ROOT,PinnedHost,KINDS

production=json.loads((ROOT/'content/question-art-realistic-prompts.json').read_text(encoding='utf-8'))
fixes=json.loads((ROOT/'content/question-art-realistic-refinements.json').read_text(encoding='utf-8'))
assert len(production['questions'])==40
base=ROOT/'.work/question-art-v10-realistic'
merged=ROOT/'.work/question-art-realistic-final';merged.mkdir(parents=True,exist_ok=True)
remote='/root/autodl-tmp/minimax-h3/outputs/question-art-v11-realistic-refined'
client=paramiko.SSHClient();client.set_missing_host_key_policy(PinnedHost())
client.connect('connect.nma1.seetacloud.com',port=49880,username='root',password=os.environ['ART_SSH_PASSWORD'],timeout=25)
manifest={'revision':'2026-10-19-minimax-realistic-v11-r1','model':'MiniMax H3 fl2va int8 + 8-step LoRA','imageCount':320,'questions':{}}
hashes=set();refined_count=0
try:
    with client.open_sftp() as sftp:
        for question in production['questions']:
            qid=question['id'];slug=qid.replace('.','-');folder=merged/slug;folder.mkdir(exist_ok=True)
            assets={}
            for kind in KINDS:
                spec=question['assets'][kind];target=folder/f'{kind}.webp'
                expected_prompt=hashlib.sha256(spec['prompt'].encode('utf-8')).hexdigest()
                if kind in fixes.get(qid,{}):
                    with sftp.open(f'{remote}/{slug}/{kind}.json') as stream:record=json.load(stream)
                    with sftp.open(f'{remote}/{slug}/{kind}.workflow.json') as stream:graph=json.load(stream)
                    assert graph['5']['inputs']['prompt']==spec['prompt'],f'Stale refinement: {qid}/{kind}'
                    assert graph['6']['inputs']['noise_seed']==spec['seed']
                    sftp.get(f'{remote}/{slug}/{kind}.webp',str(target));refined_count+=1
                else:
                    record=json.loads((base/slug/f'{kind}.json').read_text(encoding='utf-8'))
                    shutil.copy2(base/slug/f'{kind}.webp',target)
                assert record['file']==f'{slug}/{kind}.webp'
                assert record['promptSha256']==expected_prompt and record['seed']==spec['seed'],f'Prompt provenance mismatch: {qid}/{kind}'
                data=target.read_bytes();digest=hashlib.sha256(data).hexdigest()
                assert digest==record['sha256'] and len(data)==record['bytes'] and digest not in hashes
                hashes.add(digest)
                with Image.open(target) as image:
                    assert image.format=='WEBP' and list(image.size)==record['size']
                    image.load()
                (folder/f'{kind}.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
                assets[kind]=record
            versions=sorted({a['sourceVersion'] for a in assets.values()})
            manifest['questions'][qid]={'artDirection':question['artDirection'],'sourceVersion':' + '.join(versions),'assets':assets}
finally:client.close()
assert len(hashes)==320
public=ROOT/'public/question-art';backup=ROOT/'.work/backup-before-realistic'
if not backup.exists():shutil.copytree(public,backup)
for name in ['question-art-production.json','question-art-selection.json','question-art-directions.json']:
    if not (backup/name).exists():shutil.copy2(ROOT/'content'/name,backup/name)
for question in production['questions']:
    slug=question['id'].replace('.','-')
    for kind in KINDS:shutil.copy2(merged/slug/f'{kind}.webp',public/slug/f'{kind}.webp')
(public/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
production['revision']=manifest['revision']
(ROOT/'content/question-art-production.json').write_text(json.dumps(production,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'content/question-art-directions.json').write_text(json.dumps({q['id']:q['artDirection'] for q in production['questions']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'content/question-art-selection.json').write_text(json.dumps({qid:e['sourceVersion'] for qid,e in manifest['questions'].items()},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Installed all 320 verified realistic images, including {refined_count} reviewed replacements.')
