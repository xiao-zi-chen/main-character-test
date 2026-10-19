import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { questionArt } from '../question-art.js';
import { questionArtCues } from '../data/question-art-cues.js';
import { questionReactions } from '../data/question-reactions.js';

export function QuestionArt({ id, kind = 'scene', alt, priority = false }) {
  const source = questionArt(id, kind);
  const [failedSource, setFailedSource] = useState(null);
  const failed = failedSource === source;
  const cue = kind.startsWith('scale-') ? questionReactions[id]?.[Number(kind.slice(6))] : questionArtCues[id]?.[kind === 'left' ? 0 : kind === 'right' ? 1 : -1];
  return <span className={`question-art ${failed ? 'art-unavailable' : ''}`} data-kind={kind}>
    {failed
      ? <span className="question-art-fallback" role="img" aria-label={alt}><ImageOff size={22}/><span>画面暂未加载</span></span>
      : <img key={source} src={source} alt={alt} width="1152" height="640" decoding="async" fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailedSource(source)}/>}
    {cue && <span className="question-art-cue" aria-hidden="true"><span>{cue.symbol}</span><span>{cue.face}</span></span>}
  </span>;
}
