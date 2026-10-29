import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isAndroidQQ } from '../browser-environment.js';
import { Modal } from './Modal.jsx';
import { VideoPlayer } from './VideoPlayer.jsx';
import './video-dialog.css';

function NativeVideoScreen({ role, media, onClose }) {
  const screen = useRef(null);
  const closeButton = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    const root = document.getElementById('root');
    const inert = root?.getAttribute('inert');
    const hidden = root?.getAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');

    const focusable = () => [...screen.current.querySelectorAll('button:not([disabled]), a[href], video[controls], [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const keydown = event => {
      if (event.key === 'Escape') {
        // Let the browser exit its own full-screen player first.
        if (document.fullscreenElement || screen.current.querySelector('video')?.webkitDisplayingFullscreen) return;
        event.preventDefault();
        close.current();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const keepFocus = event => {
      if (!screen.current.contains(event.target)) closeButton.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', keepFocus);
      document.body.style.overflow = overflow;
      if (root) {
        if (inert === null) root.removeAttribute('inert'); else root.setAttribute('inert', inert);
        if (hidden === null) root.removeAttribute('aria-hidden'); else root.setAttribute('aria-hidden', hidden);
      }
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  // Keep the native Android video surface out of dialog's top layer and any
  // filtered/transformed ancestors. Header and links never cover the video.
  return createPortal(<div ref={screen} className="qq-video-screen" role="dialog" aria-modal="true" aria-label={`${role.name}的短片`}>
    <header className="qq-video-header">
      <span>{role.name}的短片</span>
      <button ref={closeButton} type="button" className="qq-video-close" aria-label="关闭弹窗" title="关闭弹窗" onClick={onClose}><X size={22}/></button>
    </header>
    <VideoPlayer role={role} media={media} autoplay nativeControls/>
  </div>, document.body);
}

export function VideoDialog({ role, media, onClose }) {
  if (isAndroidQQ()) return <NativeVideoScreen role={role} media={media} onClose={onClose}/>;
  return <Modal title={`${role.name}的短片`} onClose={onClose} className="video-modal">
    <VideoPlayer role={role} media={media} autoplay/>
  </Modal>;
}
