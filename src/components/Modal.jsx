import React, { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
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
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <button className="modal-close icon-button" aria-label="关闭弹窗" title="关闭弹窗" onClick={onClose}><X size={22}/></button>
    {children}
  </dialog>;
}
