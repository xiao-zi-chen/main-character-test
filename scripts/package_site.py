"""Package a completed Vite build with portable ZIP paths and media hashes."""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, zipfile

site=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--build',type=Path,default=site/'dist')
parser.add_argument('--output',type=Path,default=site/'交付/主角请就位-第二季20角色完整版.zip')
args=parser.parse_args()
build=args.build.resolve();target=args.output.resolve()
roles=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {roles} from './src/data/roles.js';process.stdout.write(JSON.stringify(roles.map(r=>({id:r.id,hidden:!!r.hidden}))))"],cwd=site,encoding='utf-8'))
manifest=json.loads((build/'media/manifest.json').read_text(encoding='utf-8'))
assert len(roles)==20 and sum(r['hidden'] for r in roles)==2
for role in roles:
    entry=manifest[role['id']]
    assert entry['status']=='final'
    assert hashlib.sha256((build/'media'/f"{role['id']}.mp4").read_bytes()).hexdigest()==entry['sha256']
    for kind in ['portrait','poster','avatar','voice','subtitles']:
        if kind in entry: assert (build/'media'/entry[kind]).is_file()
target.parent.mkdir(parents=True,exist_ok=True)
staged=target.with_name(target.stem+'.staging.zip')
files=[build/'index.html',build/'favicon.svg']
for directory in ['assets','media','worlds']:files.extend(sorted(p for p in (build/directory).rglob('*') if p.is_file()))
with zipfile.ZipFile(staged,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for file in files: archive.write(file,file.relative_to(build).as_posix())
    archive.write(site/'docs/部署说明.txt','DEPLOY.txt')
with zipfile.ZipFile(staged) as archive:
    assert archive.testzip() is None
    names=set(archive.namelist());assert 'index.html' in names
    assert all('\\' not in name and not name.startswith('/') and '..' not in Path(name).parts for name in names)
    for relative in re.findall(r'(?:src|href)="\./([^"?#]+)"',archive.read('index.html').decode('utf-8')):assert relative in names
    for role in roles:
        assert hashlib.sha256(archive.read(f"media/{role['id']}.mp4")).hexdigest()==manifest[role['id']]['sha256']
staged.replace(target)
print(json.dumps({'path':str(target),'sizeMiB':round(target.stat().st_size/1048576,2),'roles':len(roles),'hidden':sum(r['hidden'] for r in roles),'files':len(names)},ensure_ascii=False))
