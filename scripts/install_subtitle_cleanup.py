"""Install verified LaMa subtitle repairs and retain the original MiniMax generation metadata."""
import hashlib,json,os,shutil
from pathlib import Path
import paramiko
from PIL import Image
from sync_question_five import ROOT,PinnedHost

public=ROOT/'public/question-art'
manifest=json.loads((public/'manifest.json').read_text(encoding='utf-8'))
cleanup=json.loads((ROOT/'content/question-art-realistic-cleanup.json').read_text(encoding='utf-8'))
stage=ROOT/'.work/question-art-v12-subtitle-clean';stage.mkdir(exist_ok=True)
remote='/root/autodl-tmp/minimax-h3/outputs/question-art-v12-subtitle-clean'
client=paramiko.SSHClient();client.set_missing_host_key_policy(PinnedHost())
client.connect('connect.nma1.seetacloud.com',port=49880,username='root',password=os.environ['ART_SSH_PASSWORD'],timeout=25)
ready=[]
try:
    with client.open_sftp() as sftp:
        for key,job in cleanup['images'].items():
            qid,kind=key.split('/');asset=manifest['questions'][qid]['assets'][kind]
            assert asset['sha256']==job['sourceSha256'] or asset.get('postprocess',{}).get('sourceSha256')==job['sourceSha256']
            with sftp.open(remote+'/'+job['file'].replace('.webp','.json')) as stream:record=json.load(stream)
            assert record['sourceSha256']==job['sourceSha256'] and record['regions']==job['regions']
            target=stage/job['file'];target.parent.mkdir(parents=True,exist_ok=True)
            sftp.get(remote+'/'+job['file'],str(target));data=target.read_bytes()
            assert hashlib.sha256(data).hexdigest()==record['sha256'] and len(data)==record['bytes']
            with Image.open(target) as image:
                assert image.format=='WEBP' and list(image.size)==asset['size']==record['size']
                image.load()
            ready.append((asset,record,target,job))
finally:client.close()
for asset,record,target,job in ready:
    original=public/job['file'];backup=ROOT/'.work/realistic-before-cleanup'/job['file']
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists():shutil.copy2(original,backup)
    shutil.copy2(target,original)
    asset['postprocess']={k:record[k] for k in ['method','sourceSha256','regions','modelSha256']}
    asset['sha256']=record['sha256'];asset['bytes']=record['bytes']
revision=hashlib.sha256(json.dumps(cleanup,sort_keys=True).encode()).hexdigest()[:8]
manifest['revision']=manifest['revision'].split('-clean-')[0]+'-clean-'+revision
(public/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
production_path=ROOT/'content/question-art-production.json'
production=json.loads(production_path.read_text(encoding='utf-8'));production['revision']=manifest['revision']
production_path.write_text(json.dumps(production,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Installed {len(ready)} verified subtitle repairs; image dimensions retained and source metadata preserved.')
