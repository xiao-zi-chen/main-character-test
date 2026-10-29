import React, { useEffect, useRef, useState } from 'react';
import { Share2, Copy, ArrowUpRight } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { relationships } from '../data/relationships.js';
import { getMessagingApp } from '../browser-environment.js';
import './share-dialog.css';

export function ShareDialog({ role, partner, onClose }) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `/role/${partner?.id ?? role.id}`;
  const invitation = partner
    ? `「${role.name}」×「${partner.name}」\n${relationships[role.id].chemistry}\n这段故事里的「${partner.name}」让我想到了你。来看看 TA 的剧本，要不要一起对号入座？`
    : `我的主角人设是「${role.name}」：${relationships[role.id].identity}\n来看看我的剧本，你会是哪一种主角？`;
  const text = `${invitation}\n${url.href}`;
  const messagingApp = getMessagingApp();
  const nativeShare = typeof navigator.share === 'function';
  const [message, setMessage] = useState('');
  const [fallbackOpen, setFallbackOpen] = useState(!nativeShare);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const sharing = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      if (mounted.current) setMessage('剧本邀请已复制，可以粘贴给朋友。');
    } catch {
      if (!mounted.current) return;
      input.current?.focus();
      input.current?.select();
      setMessage('未能自动复制，已选中邀请内容，可以手动复制。');
    }
  };

  const share = async data => {
    if (sharing.current) return;
    if (!nativeShare) {
      setFallbackOpen(true);
      setMessage('当前浏览器没有系统分享入口，可以使用下方链接与文案。');
      return;
    }
    sharing.current = true;
    setBusy(true);
    setMessage('');
    try {
      // Keep native sharing inside the click handler's user activation.
      await navigator.share(data);
    } catch (error) {
      if (mounted.current && error?.name !== 'AbortError') {
        setFallbackOpen(true);
        setMessage('暂时无法打开系统分享，可以使用下方链接与文案。');
      }
    } finally {
      sharing.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const title = partner ? '分享同片搭档' : '分享剧本';
  if (messagingApp) return <Modal title={title} onClose={onClose} className="small-modal script-share-modal wechat-only-share-modal">
    <div className="wechat-share-guide" role="note" aria-label={messagingApp === 'qq' ? 'QQ 分享操作' : '微信分享操作'}>
      <ArrowUpRight className="wechat-share-arrow" size={36} aria-hidden="true"/>
      <strong>{messagingApp === 'qq' ? '点击 QQ 右上角「···」' : '点击微信右上角「···」'}</strong>
      <p>{messagingApp === 'qq' ? '选择「分享」或「发送给好友」，再选择要分享的朋友。' : '选择「发送给朋友」；菜单里有「分享到朋友圈」时，也可以使用。'}</p>
    </div>
  </Modal>;

  const defaultMessage = nativeShare
    ? '打开系统分享面板，选择应用或联系人。'
    : '当前浏览器没有系统分享入口，可以使用下方链接与文案。';

  return <Modal title={title} onClose={onClose} className="small-modal script-share-modal">
    <Share2 className="modal-symbol" size={28}/>
    <h2>{partner ? '这部短片里的另一个主角，会是 TA 吗？' : '把你的主角剧本，分享出去。'}</h2>
    <p className="share-role-name">{partner ? `${role.name} × ${partner.name}` : role.name}</p>
    <div className="share-destinations">
      <button className="button button-lime" disabled={busy} onClick={() => share({ title: partner ? `${role.name} × ${partner.name} · 同片搭档` : `${role.name} · 我的主角剧本`, text: invitation, url: url.href })}><Share2 size={18}/>分享给朋友</button>
    </div>
    <p className="share-status" role="status">{message || defaultMessage}</p>
    <details className="share-fallback" open={fallbackOpen} onToggle={event => setFallbackOpen(event.currentTarget.open)}>
      <summary>复制链接与文案</summary>
      <textarea ref={input} className="share-input share-invitation" aria-label="角色分享邀请" value={text} readOnly onFocus={event => event.target.select()}/>
      <button className="text-button" onClick={copy}><Copy size={16}/>复制剧本邀请</button>
    </details>
  </Modal>;
}
