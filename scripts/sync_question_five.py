"""Download verified H3 artwork. SSH password comes only from ART_SSH_PASSWORD."""
import argparse, base64, hashlib, json, os, shutil, time
from pathlib import Path
import paramiko
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
KINDS = ['scene','left','right',*[f'scale-{i}' for i in range(5)]]

class PinnedHost(paramiko.MissingHostKeyPolicy):
    def missing_host_key(self, client, hostname, key):
        digest=base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
        if digest!='liZ36vNCsNcNdXeWs4f+g5ZIhPM/ZihP834vxs8Ulqc':
            raise RuntimeError('SSH host fingerprint mismatch')

def sync(args):
    production=json.loads(args.prompts.read_text(encoding='utf-8'))
    batch=Path(args.remote).name
    if not batch.startswith('question-art-') or not all(c.isalnum() or c=='-' for c in batch):
        raise ValueError('Use a named question-art-* remote output directory.')
    stage=ROOT/'.work'/batch; stage.mkdir(parents=True,exist_ok=True)
    public=ROOT/'public/question-art'
    copied=set()
    while True:
        client=paramiko.SSHClient(); client.set_missing_host_key_policy(PinnedHost())
        client.connect(args.host,port=args.port,username='root',password=os.environ['ART_SSH_PASSWORD'],timeout=25)
        try:
            with client.open_sftp() as sftp:
                for question in production['questions']:
                    slug=question['id'].replace('.','-'); folder=stage/slug; folder.mkdir(exist_ok=True)
                    for kind in KINDS:
                        meta=folder/f'{kind}.json'; target=folder/f'{kind}.webp'
                        spec=question['assets'][kind]
                        prompt_hash=hashlib.sha256(spec['prompt'].encode('utf-8')).hexdigest()
                        existing=json.loads(meta.read_text()) if meta.exists() else {}
                        if not target.exists() or existing.get('promptSha256')!=prompt_hash:
                            try:
                                with sftp.open(f'{args.remote}/{slug}/{kind}.json') as stream: record=json.load(stream)
                            except FileNotFoundError: continue
                            if record['file']!=f'{slug}/{kind}.webp': raise ValueError('Unexpected remote path')
                            if record.get('promptSha256') is None:
                                with sftp.open(f'{args.remote}/{slug}/{kind}.workflow.json') as stream: graph=json.load(stream)
                                record['promptSha256']=hashlib.sha256(graph['5']['inputs']['prompt'].encode('utf-8')).hexdigest()
                            if record['promptSha256']!=prompt_hash or record['seed']!=spec['seed']:
                                raise ValueError(f'Stale generated prompt: {slug}/{kind}')
                            temporary=target.with_suffix('.download')
                            sftp.get(f'{args.remote}/{slug}/{kind}.webp',str(temporary))
                            data=temporary.read_bytes()
                            if hashlib.sha256(data).hexdigest()!=record['sha256'] or len(data)!=record['bytes']:
                                raise ValueError(f'Hash mismatch: {target}')
                            with Image.open(temporary) as image:
                                if image.format!='WEBP' or list(image.size)!=record['size']: raise ValueError('Invalid image')
                                image.load()
                            temporary.replace(target); meta.write_text(json.dumps(record,indent=2),encoding='utf-8')
                    if all((folder/f'{kind}.json').exists() for kind in KINDS) and slug not in copied:
                        copied.add(slug); print(f'VERIFIED {question["id"]}: 8 images ({len(copied)}/40 questions)',flush=True)
        finally: client.close()
        if len(copied)==len(production['questions']):
            if args.stage_only:
                print(f'STAGED: {len(copied)*len(KINDS)} verified images in {stage}',flush=True)
                return
            backup=ROOT/'.work'/f'backup-before-{batch}'
            if not backup.exists(): shutil.copytree(public,backup)
            for name in ['question-art-production.json','question-art-selection.json','question-art-directions.json']:
                if not (backup/name).exists(): shutil.copy2(ROOT/'content'/name,backup/name)
            manifest={'revision':production['revision'],'model':'MiniMax H3 fl2va int8 + 8-step LoRA','imageCount':len(copied)*len(KINDS),'questions':{}}
            for question in production['questions']:
                folder=stage/question['id'].replace('.','-')
                for kind in KINDS: shutil.copy2(folder/f'{kind}.webp',public/folder.name/f'{kind}.webp')
                manifest['questions'][question['id']]={'artDirection':question['artDirection'],'sourceVersion':batch,'assets':{kind:json.loads((folder/f'{kind}.json').read_text()) for kind in KINDS}}
            (public/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            (ROOT/'content/question-art-production.json').write_text(json.dumps(production,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            (ROOT/'content/question-art-selection.json').write_text(json.dumps({q['id']:Path(args.remote).name for q in production['questions']},indent=2)+'\n',encoding='utf-8')
            (ROOT/'content/question-art-directions.json').write_text(json.dumps({q['id']:q['artDirection'] for q in production['questions']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print('COMPLETE: 320 verified images, manifest and production prompts installed.',flush=True)
            return
        if not args.watch: return
        time.sleep(20)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default='connect.nma1.seetacloud.com')
    parser.add_argument('--port',type=int,default=49880)
    parser.add_argument('--remote',default='/root/autodl-tmp/minimax-h3/outputs/question-art-v10-realistic')
    parser.add_argument('--prompts',type=Path,default=ROOT/'content/question-art-realistic-prompts.json')
    parser.add_argument('--stage-only',action='store_true',help='Verify into .work without installing production files.')
    parser.add_argument('--watch',action='store_true')
    sync(parser.parse_args())
