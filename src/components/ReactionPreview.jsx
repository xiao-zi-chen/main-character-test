import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { QuestionArt } from './QuestionArt.jsx';
import { questionReactions } from '../data/question-reactions.js';

const labels = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'];

// Brief visual feedback without stealing focus from the five-step slider.
export function ReactionPreview({ questionId, value, onClose }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(onClose, ready ? 1800 : 6000);
    return () => window.clearTimeout(timer);
  }, [ready, onClose]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return createPortal(<div className="reaction-preview" role="region" aria-label="所选反应预览">
    <div className="reaction-preview-card">
      <div className="reaction-preview-heading"><span>{labels[value]}</span><button type="button" aria-label="关闭选择预览" onClick={onClose}><X size={20}/></button></div>
      <QuestionArt id={questionId} kind={`scale-${value}`} alt={`你的反应：${questionReactions[questionId][value].caption}`} priority onReady={() => setReady(true)}/>
    </div>
  </div>, document.body);
}
