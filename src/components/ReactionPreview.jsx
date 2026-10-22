import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { QuestionArt } from './QuestionArt.jsx';
import { questionReactions } from '../data/question-reactions.js';
import { SCALE_LABELS as labels, reactionIndex } from '../data/answer-scale.js';
import { questionArt } from '../question-art.js';

// Feedback after confirming an answer; closing it continues to the next scene.
export function ReactionPreview({ questionId, value, onClose }) {
  const group = reactionIndex(value);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const closeButton = useRef(null);
  const timer = useRef(null);
  const menuOpen = useRef(false);
  const backdropPressed = useRef(false);
  const pause = () => { window.clearTimeout(timer.current); setPaused(true); };
  const resume = () => { if (!menuOpen.current) setPaused(false); };
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (paused) return;
    timer.current = window.setTimeout(onClose, ready ? 4000 : 10000);
    return () => window.clearTimeout(timer.current);
  }, [ready, paused, onClose]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return createPortal(<div className="reaction-preview" role="region" aria-label="所选反应预览"
    onPointerDown={event => { backdropPressed.current = event.target === event.currentTarget && event.button === 0; }}
    onPointerUpCapture={resume}
    onPointerCancel={() => { backdropPressed.current = false; }}
    onClick={event => { if (backdropPressed.current && event.target === event.currentTarget) onClose(); backdropPressed.current = false; }}>
    <div className="reaction-preview-card" onPointerDownCapture={pause}
      onPointerCancel={() => { menuOpen.current = true; pause(); }}
      onContextMenu={() => { menuOpen.current = true; pause(); }}>
      <div className="reaction-preview-heading"><span>{labels[group]}</span><button ref={closeButton} type="button" aria-label="关闭选择预览" onClick={onClose}><X size={20}/></button></div>
      <QuestionArt id={questionId} kind={`scale-${group}`} alt={`你的反应：${questionReactions[questionId][group].caption}`} priority onReady={() => setReady(true)}/>
      <div className="reaction-preview-actions"><span>长按图片可保存</span><a href={questionArt(questionId, `scale-${group}`)} download={`NBTI-${questionId}-scale-${group}.webp`}
        onClick={() => { menuOpen.current = true; pause(); }}><Download size={16}/>保存图片</a></div>
    </div>
  </div>, document.body);
}
