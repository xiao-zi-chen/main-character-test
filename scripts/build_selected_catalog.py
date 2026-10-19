"""Build the spreadsheet's cast and import its existing films and individual portraits.

This imports existing footage; it does not claim to complete requested video edits.
"""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

films = read('content/selected-films.json')['films']
sources = read('content/selected-film-sources.json')
profiles = read('content/selected-character-profiles.json')
assert len(films) == 17
cast_ids = [person['id'] for film in films for person in film['cast']]
assert len(cast_ids) == len(set(cast_ids)) == 28
assert set(cast_ids) == set(profiles)
roles, relationships, manifest, reports = [], {}, {}, []
media = ROOT / 'public/media'
staging = ROOT / '.work/selected-catalog'
staging.mkdir(parents=True, exist_ok=True)

for film in films:
    info = sources[film['id']]
    source = ROOT / info['source']
    if not source.is_file():
        raise FileNotFoundError(source)
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(source)]))
    stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    assert stream['codec_name'] == 'h264'
    filename = f"film-{film['id']}.mp4"
    shutil.copyfile(source, staging / filename)
    digest = hashlib.sha256((staging / filename).read_bytes()).hexdigest()
    for person in film['cast']:
        key = person['id']
        profile = profiles[key]
        shot = profile['portrait']
        frame = staging / f'{key}-source.png'
        subprocess.run(['ffmpeg','-y','-v','error','-ss',str(shot['time']),'-i',str(source),
                        '-frames:v','1','-update','1',str(frame)],check=True)
        portrait_name = f'{key}-selected.webp'
        with Image.open(frame) as image:
            x,y,w,h = shot['crop']
            width,height = image.size
            cropped = image.crop((round(x*width),round(y*height),round((x+w)*width),round((y+h)*height)))
            # Preserve the selected person's crop without stretching or added lettering.
            cropped.thumbnail((900,1280),Image.Resampling.LANCZOS)
            cropped.convert('RGB').save(staging / portrait_name, quality=92, method=6)
        portrait_bytes = (staging / portrait_name).read_bytes()
        partner = next((p['id'] for p in film['cast'] if p['id'] != key),None)
        roles.append(dict(id=key,number=f'{len(roles)+1:02d}',name=person['name'],shortName=person['name'],
                          english=key.replace('-',' ').upper(),category=info['category'],genre=film['title'],
                          color=info['color'],icon=info['icon'],symbol='star',filmId=film['id'],
                          videoId=f"film-{film['id']}",filmTitle=film['title'],
                          castIds=[p['id'] for p in film['cast']],tagline=profile['identity'],
                          quote='',description=profile['familiar']+' '+profile['friction'],
                          story=info['synopsis'],talents=profile['talents'],reminder=profile['reminder'],
                          partner=partner,beats=[],profile=profile['profile'],weights=[1]*10))
        relationships[key] = {name:profile[name] for name in ['identity','familiar','affection','friction']}
        relationships[key].update(bond='同一段故事，两种反应' if len(film['cast'])==2 else '不同剧本，也能互相接住',
                                  chemistry=info['synopsis'] if len(film['cast'])==2 else profile['reminder'],
                                  prompt='身边谁会接住你的这一面？把这份剧本发给 TA。')
        manifest[key] = dict(status='final',video=filename,filmId=film['id'],
                             duration=float(probe['format']['duration']),width=stream['width'],height=stream['height'],
                             hasAudio=any(s['codec_type']=='audio' for s in probe['streams']),
                             portrait=portrait_name,poster=portrait_name,avatar=portrait_name,
                             revision=hashlib.sha256(bytes.fromhex(digest)+portrait_bytes).hexdigest()[:12],
                             sha256=digest,portraitSha256=hashlib.sha256(portrait_bytes).hexdigest(),
                             videoRevision=digest[:12])
    reports.append(dict(filmId=film['id'],source=info['source'],file=filename,sha256=digest,
                        cast=[dict(**p,portrait=profiles[p['id']]['portrait']) for p in film['cast']],
                        requestedEdit=film['notes'],editStatus='pending-generation' if info.get('regenerate') else 'not-requested'))

# Prepare every source and crop before publishing the imported catalog.
for record in reports:
    shutil.copyfile(staging / record['file'],media / record['file'])
for key,entry in manifest.items():
    shutil.copyfile(staging / entry['portrait'],media / entry['portrait'])
(media/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'src/data/roles-selected.js').write_text('// Generated by scripts/build_selected_catalog.py from the selected spreadsheet and profiles.\nexport const selectedRoles = '+json.dumps(roles,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(ROOT/'src/data/relationships.js').write_text('// Generated from content/selected-character-profiles.json.\nexport const relationships = '+json.dumps(relationships,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(ROOT/'content/selected-film-import.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Imported 17 original films and 28 individually selected portraits; four requested edits remain pending generation.')
