import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { questionArt } from '../question-art.js';

export function QuestionArt({ id, kind = 'scene', alt, priority = false }) {
  const [failed, setFailed] = useState(false);
  return <span className={`question-art ${failed ? 'art-unavailable' : ''}`}>
    {failed
      ? <span className="question-art-fallback" role="img" aria-label={alt}><ImageOff size={22}/><span>画面暂未加载</span></span>
      : <img src={questionArt(id, kind)} alt={alt} width="1136" height="556" decoding="async" fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailed(true)}/>}
  </span>;
}
