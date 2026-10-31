import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Copy, Share2 } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { getMessagingApp } from '../browser-environment.js';
import homeCover from '../assets/home-black-hole.png';

export function personalityShareUrl() {
  const url = new URL(window.location.href);
  // Keep this edition's deployed directory; never include personal state or query tokens.
  url.search = '';
  url.hash = '/share';
  return url.href;
}

export function PersonalitySharePage({ complete, onStart, onShare }) {
  return <main id="main-content" className="personality-invitation page-width">
    <a className="text-button" href={complete ? '#/result' : '#/'}><ArrowLeft size={16}/>{complete ? '返回我的人格解析' : '返回首页'}</a>
    <section className="personality-invitation-card" aria-labelledby="invitation-title">
      <img src={homeCover} alt="人格测试的黑洞封面" className="personality-invitation-cover"/>
      <div className="personality-invitation-copy">
        <p className="personality-eyebrow">BLACK MIRROR</p>
        <h1 id="invitation-title">看见你自己</h1>
        <p>同样的情境，你会怎么选？<br/>用 20 个日常选择，看看自己的十种倾向。</p>
        <button className="button button-lime" onClick={onStart}>{complete ? '查看我的人格解析' : '开始人格测试'}<ArrowRight size={18}/></button>
        <button className="button button-outline" onClick={onShare}><Share2 size={18}/>分享给朋友</button>
        <span className="personality-invitation-note">约 2 分钟 · 无需登录</span>
      </div>
    </section>
  </main>;
}

export function PersonalityShareDialog({ onClose }) {
  const url = personalityShareUrl();
  const invitation = '同样的情境，你会怎么选？来做 20 个日常选择，看看真实的自己。';
  const text = `${invitation}\n${url}`;
  const messagingApp = getMessagingApp();
  const nativeShare = typeof navigator.share === 'function';
  const [message, setMessage] = useState('');
  const [fallbackOpen, setFallbackOpen] = useState(!nativeShare);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const sharing = useRef(false);
  const input = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      if (mounted.current) setMessage('测试邀请已复制，可以发给朋友了。');
    } catch {
      if (!mounted.current) return;
      input.current?.focus();
      input.current?.select();
      setMessage('已选中邀请内容，可以长按或手动复制。');
    }
  };
  const share = async () => {
    if (sharing.current) return;
    if (!nativeShare) { setFallbackOpen(true); return; }
    sharing.current = true;
    setBusy(true);
    setMessage('');
    try {
      await navigator.share({ title: '看见你自己 · 人格测试', text: invitation, url });
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
  return <Modal title="分享人格测试" onClose={onClose} className={`small-modal personality-share-modal${messagingApp ? ' personality-message-guide' : ''}`}>
    {messagingApp ? <div className="personality-share-guide" role="note" aria-label={messagingApp === 'qq' ? 'QQ 分享操作' : '微信分享操作'}>
      <ArrowUpRight size={36} aria-hidden="true"/>
      <strong>{messagingApp === 'qq' ? '点击 QQ 右上角「···」' : '点击微信右上角「···」'}</strong>
      <p>{messagingApp === 'qq' ? '选择「分享」或「发送给好友」，再选择要分享的朋友。' : '选择「发送给朋友」；菜单里有「分享到朋友圈」时，也可以使用。'}</p>
    </div> : <>
      <Share2 className="modal-symbol" size={28}/>
      <h2>也想看看，朋友会怎么选？</h2>
      <button className="button button-lime" disabled={busy} onClick={share}><Share2 size={18}/>分享给朋友</button>
      <p className="personality-share-status" role="status">{message || (nativeShare ? '打开系统分享面板，选择应用或联系人。' : '可以复制下方邀请，发给朋友。')}</p>
      <details className="personality-share-fallback" open={fallbackOpen} onToggle={event => setFallbackOpen(event.currentTarget.open)}>
        <summary>复制链接与文案</summary>
        <textarea ref={input} className="share-input" aria-label="人格测试分享邀请" value={text} readOnly onFocus={event => event.target.select()}/>
        <button className="text-button" onClick={copy}><Copy size={16}/>复制测试邀请</button>
      </details>
    </>}
  </Modal>;
}
