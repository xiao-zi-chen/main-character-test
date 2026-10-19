"""Cache a local OCR pass over source images; detections require visual review."""
import hashlib
import json
import sys
from pathlib import Path
from prepare_chatanywhere_art import ROOT, OUTPUT

sys.path.insert(0, str(ROOT / '.work/image25-ocr'))
from rapidocr_onnxruntime import RapidOCR


def main():
    target = OUTPUT / 'ocr-review.json'
    records = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
    engine = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=2, text_score=0.65)
    for source in sorted((OUTPUT / 'raw').glob('*.png')):
        sha = hashlib.sha256(source.read_bytes()).hexdigest()
        if records.get(source.name, {}).get('sha256') == sha:
            continue
        result, _ = engine(str(source))
        records[source.name] = {'sha256': sha, 'detections': [
            {'box': box, 'text': text, 'confidence': float(score)} for box, text, score in (result or [])
        ]}
        target.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
        if result:
            print(source.name, json.dumps(records[source.name]['detections'], ensure_ascii=False), flush=True)
    print(f'OCR checked {len(records)} images; {sum(bool(r["detections"]) for r in records.values())} flagged.', flush=True)


if __name__ == '__main__':
    main()
