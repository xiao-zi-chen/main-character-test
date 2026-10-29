import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { questionReactions } from '../data/question-reactions.js';
import { reactionCaptions } from '../data/reaction-captions.js';
import { reactionIndex } from '../data/answer-scale.js';
import { questionArt } from '../question-art.js';

// An optional, untimed look at the selected scene. Dismissing it never submits.
export function ReactionPreview({ questionId, value, onClose }) {
  const group = reactionIndex(value);
  const caption = reactionCaptions[questionId][group];
  const dialogRef = useRef(null);
  const backdropPressed = useRef(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const trigger = document.querySelector('.question-preview-trigger');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      // Wait until the quiz has also removed its inert attribute.
      queueMicrotask(() => {
        const target = previous !== document.body && previous?.isConnected ? previous : trigger;
        if (target?.isConnected) target.focus({ preventScroll: true });
      });
    };
  }, []);

  return createPortal(<dialog ref={dialogRef} className="reaction-preview" aria-label="所选反应预览" aria-description="点击图片外的空白处或按 Escape 键返回答题。" tabIndex={-1}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      // The scene has no controls. Keep keyboard focus within the lightbox.
      if (event.key === 'Tab') event.preventDefault();
      event.stopPropagation();
    }}
    onPointerDown={event => {
      event.stopPropagation();
      backdropPressed.current = event.button === 0 && event.target === event.currentTarget;
    }}
    onPointerUp={event => event.stopPropagation()}
    onPointerCancel={() => { backdropPressed.current = false; }}
    onClick={event => {
      event.stopPropagation();
      if (backdropPressed.current && event.target === event.currentTarget) onClose();
      backdropPressed.current = false;
    }}>
    <figure className="reaction-preview-scene">
      <img className="reaction-preview-image" src={questionArt(questionId, `scale-${group}`)}
        alt={`你的反应：${questionReactions[questionId][group].caption}`} decoding="async" fetchPriority="high"/>
      <figcaption className="reaction-preview-caption">{caption}</figcaption>
    </figure>
  </dialog>, document.body);
}
