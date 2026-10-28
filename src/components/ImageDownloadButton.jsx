import React, { useEffect, useRef, useState } from 'react';
import './image-download-button.css';

// Cross-origin <a download> links may navigate instead of saving. Download a
// CORS-readable image as a local blob while leaving the displayed img intact
// for the browser's native long-press menu.
export function ImageDownloadButton({ source, filename, children, onStart }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(null);
  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);

  const download = async () => {
    if (request.current) return;
    onStart?.();
    setBusy(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(source, { mode: 'cors', credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('Image unavailable');
      const blob = await response.blob();
      if (!blob.size || !blob.type.startsWith('image/')) throw new Error('Invalid image');
      if (request.current !== controller) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      try { link.click(); } finally {
        link.remove();
        // Give mobile browsers time to hand the file to their download UI.
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch {
      if (request.current === controller) setError('图片下载失败，请重试或长按图片保存。');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  };

  return <span className="image-download-action">
    <button className="image-download-button" type="button" disabled={busy} aria-busy={busy} onClick={download}>
      {busy ? '正在准备…' : children || '保存图片'}
    </button>
    {error && <span className="image-download-error" role="alert">{error}</span>}
  </span>;
}
