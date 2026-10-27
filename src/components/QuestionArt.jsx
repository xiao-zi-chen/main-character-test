import React, { useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import { questionArt } from '../question-art.js';
import { questionReactions } from '../data/question-reactions.js';
import { Modal } from './Modal.jsx';
import { importType } from '../../public/question-art/manifest.json';

export function QuestionArt({ id, kind = 'scene', alt, priority = false, zoomable = false, onReady }) {
  const source = questionArt(id, kind);
  const [failedSource, setFailedSource] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const failed = failedSource === source;
  const cue = questionReactions[id]?.[kind.startsWith('scale-') ? Number(kind.slice(6)) : kind === 'left' ? 0 : kind === 'right' ? 4 : -1];
  const Container = zoomable ? 'button' : 'span';
  return <><Container className={`question-art ${zoomable ? 'art-zoomable' : ''} ${failed ? 'art-unavailable' : ''}`} data-kind={kind}
    {...(zoomable ? {type:'button', 'aria-label':'放大当前画面', onClick:()=>setExpanded(true)} : {})}>
    {failed
      ? <span className="question-art-fallback" role="img" aria-label={alt}><ImageOff size={22}/><span>画面暂未加载</span></span>
      : <img key={source} src={source} alt={alt} width="1536" height="1024" decoding="async" fetchPriority={priority ? 'high' : 'auto'} onLoad={onReady} onError={() => { setFailedSource(source); onReady?.(); }}/>}
    {cue && importType !== 'workbook-images' && <span className="question-art-cue" aria-hidden="true"><span>{cue.symbol}</span><span>{cue.face}</span></span>}
    {zoomable && <span className="question-art-expand" aria-hidden="true"><Maximize2 size={16}/></span>}
  </Container>{expanded && <Modal title="查看画面" className="image-zoom-modal" onClose={()=>setExpanded(false)}><QuestionArt id={id} kind={kind} alt={alt}/><div className="reaction-preview-actions"><span>长按图片可保存</span><a href={source} download={`NBTI-${id}-${kind}.webp`}>保存图片</a></div></Modal>}</>;
}
