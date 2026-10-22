import React, { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  const backdropPressed = useRef(false);
  const outside = event => {
    // The full-screen video element includes object-fit letterboxing. Treat
    // those black margins as the backdrop while keeping the film tappable.
    if (event.currentTarget.classList.contains('video-modal') && event.target.tagName === 'VIDEO') {
      const video = event.target;
      const bounds = video.getBoundingClientRect();
      const width = video.videoWidth || 9;
      const height = video.videoHeight || 16;
      const scale = Math.min(bounds.width / width, bounds.height / height);
      const left = bounds.left + (bounds.width - width * scale) / 2;
      const top = bounds.top + (bounds.height - height * scale) / 2;
      return event.clientX < left || event.clientX > left + width * scale || event.clientY < top || event.clientY > top + height * scale;
    }
    if (event.target !== event.currentTarget) return false;
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={ref} className={`modal ${className}`} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onPointerDown={event => { backdropPressed.current = event.button === 0 && outside(event); }}
    onPointerCancel={() => { backdropPressed.current = false; }}
    onClick={event => {
      if (backdropPressed.current && outside(event)) onClose();
      backdropPressed.current = false;
    }}>
    <button className="modal-close icon-button" aria-label="关闭弹窗" title="关闭弹窗" onClick={onClose}><X size={22}/></button>
    {children}
  </dialog>;
}
