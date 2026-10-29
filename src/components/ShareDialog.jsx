import React, { useEffect, useRef, useState } from 'react';
import { Share2, Copy, Download, ArrowUpRight } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { mediaAsset } from '../media.js';
import { relationships } from '../data/relationships.js';
import './share-dialog.css';

export function ShareDialog({ role, partner, media, onClose }) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `/role/${partner?.id ?? role.id}`;
  const invitation = partner
    ? `「${role.name}」×「${partner.name}」\n${relationships[role.id].chemistry}\n这段故事里的「${partner.name}」让我想到了你。来看看 TA 的剧本，要不要一起对号入座？`
    : `我的主角人设是「${role.name}」：${relationships[role.id].identity}\n来看看我的剧本，你会是哪一种主角？`;
  const text = `${invitation}\n${url.href}`;
  const cardUrl = mediaAsset(role, media, 'card');
  const wechat = /MicroMessenger/i.test(navigator.userAgent);
  const nativeShare = typeof navigator.share === 'function';
  const [preparedCard, setPreparedCard] = useState(null);
  const card = preparedCard?.source === cardUrl ? preparedCard : null;
  const [message, setMessage] = useState('');
  const [showCard, setShowCard] = useState(false);
  const [showGuide, setShowGuide] = useState(wechat);
  const [fallbackOpen, setFallbackOpen] = useState(!wechat && !nativeShare);
  const [imageFailed, setImageFailed] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardAttempt, setCardAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const guide = useRef(null);
  const cardSection = useRef(null);
  const sharing = useRef(false);
  const mounted = useRef(false);
  const downloadedUrl = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Opening the share dialog must not download a multi-megabyte role card.
  // Prepare it only after the visitor chooses the image-saving option.
  useEffect(() => {
    if (!showCard) return;
    const controller = new AbortController();
    let active = true;
    let objectUrl;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setPreparedCard(null);
    setCardError('');
    setCardLoading(true);
    setImageFailed(false);
    (async () => {
      try {
        const response = await fetch(cardUrl, { mode: 'cors', credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('Card unavailable');
        const blob = await response.blob();
        const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => signature[i] === byte)) throw new Error('Invalid PNG card');
        if (!active) return;
        if (controller.signal.aborted) throw new Error('Card preparation timed out');
        const file = new File([blob], `${role.name}-主角剧本.png`, { type: 'image/png' });
        objectUrl = URL.createObjectURL(file);
        setPreparedCard({ file, url: objectUrl, source: cardUrl });
        setImageFailed(false);
      } catch {
        if (active) setCardError('暂时无法准备下载文件，可以重试，或长按下方图片保存。');
      } finally {
        window.clearTimeout(timeout);
        if (active) setCardLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
      if (objectUrl) {
        // Do not invalidate a download if the visitor immediately closes us.
        if (downloadedUrl.current === objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        else URL.revokeObjectURL(objectUrl);
      }
    };
  }, [showCard, cardUrl, role.name, cardAttempt]);

  useEffect(() => {
    if (showCard) cardSection.current?.scrollIntoView({ block: 'nearest' });
  }, [showCard]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      if (mounted.current) setMessage('剧本邀请已复制，可以粘贴给朋友。');
    } catch {
      if (!mounted.current) return;
      input.current?.focus();
      input.current?.select();
      setMessage('请长按或选中下方邀请，手动复制。');
    }
  };

  const share = async (data, withImage = false) => {
    if (sharing.current || wechat) return;
    if (!nativeShare) {
      setFallbackOpen(true);
      setMessage('当前浏览器没有系统分享入口，可以保存角色卡，或使用下方链接与文案。');
      return;
    }
    sharing.current = true;
    setBusy(true);
    setMessage('');
    try {
      // Keep this call inside the click handler, before any awaited fetch.
      await navigator.share(data);
    } catch (error) {
      if (mounted.current && error?.name !== 'AbortError') {
        setFallbackOpen(true);
        if (withImage) setShowCard(true);
        setMessage('暂时无法打开系统分享，可以保存角色卡，或使用下方链接与文案。');
      }
    } finally {
      sharing.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  // Some share targets reject a file combined with text or a URL. Check and
  // send the same files-only payload; the complete card already has its QR.
  const imageShareData = card ? { files: [card.file] } : null;
  let canShareImage = false;
  try {
    canShareImage = !wechat && nativeShare && Boolean(imageShareData && navigator.canShare?.(imageShareData));
  } catch { /* Saving and long-press remain available without file sharing. */ }

  const defaultMessage = wechat
    ? '想分享完整的人设、文字和二维码，可以直接保存角色卡。'
    : nativeShare
      ? '打开系统分享面板，选择应用或联系人。'
      : '当前浏览器没有系统分享入口，可以保存角色卡，或使用下方链接与文案。';

  return <Modal title={partner ? '分享同片搭档' : '分享剧本'} onClose={onClose} className="small-modal script-share-modal">
    <Share2 className="modal-symbol" size={28}/>
    <h2>{partner ? '这部短片里的另一个主角，会是 TA 吗？' : '把你的主角剧本，分享出去。'}</h2>
    <p className="share-role-name">{partner ? `${role.name} × ${partner.name}` : role.name}</p>
    <div className="share-destinations">
      {wechat
        ? <button className="button button-lime" onClick={() => { setShowGuide(true); guide.current?.focus(); guide.current?.scrollIntoView({ block: 'nearest' }); }}><ArrowUpRight size={18}/>微信分享指引</button>
        : <button className="button button-lime" disabled={busy} onClick={() => share({ title: partner ? `${role.name} × ${partner.name} · 同片搭档` : `${role.name} · 我的主角剧本`, text: invitation, url: url.href })}><Share2 size={18}/>分享给朋友</button>}
      <button className="button button-outline" onClick={() => { setShowCard(true); setMessage('长按角色卡保存到相册，再发给朋友或发布到朋友圈。'); }}><Download size={18}/>保存角色卡</button>
    </div>
    {wechat && showGuide && <div className="wechat-share-guide" ref={guide} tabIndex={-1} role="note" aria-label="微信分享指引">
      <ArrowUpRight className="wechat-share-arrow" size={36} aria-hidden="true"/>
      <strong>点击微信右上角「···」</strong>
      <p>选择「发送给朋友」；菜单里有「分享到朋友圈」时，也可以使用。</p>
      <p className="wechat-share-note">菜单转发的是当前网页。想让朋友看到你的完整角色卡，请使用「保存角色卡」。</p>
    </div>}
    <p className="share-status" role="status">{message || defaultMessage}</p>
    {showCard && <section className="share-card-preview" ref={cardSection} aria-label="分享角色卡">
      <h3>让角色卡替你开场</h3>
      <p>图片、人物介绍和二维码都在这张卡里。长按保存，也可以下载后分享。</p>
      {imageFailed && <p role="alert">图片暂未加载成功。<button className="text-button" onClick={() => { setImageFailed(false); setCardAttempt(value => value + 1); }}>重试图片</button></p>}
      <img key={cardAttempt} src={wechat ? cardUrl : card?.url || cardUrl} alt={`${role.name}的朋友圈分享卡`} hidden={imageFailed} onError={() => setImageFailed(true)}/>
      {cardLoading && <p className="share-card-progress" role="status">正在准备角色卡…</p>}
      {cardError && <div className="share-card-error" role="alert"><p>{cardError}</p><button className="text-button" onClick={() => setCardAttempt(value => value + 1)}>重试准备角色卡</button></div>}
      <div className="share-card-actions">
        {card && <a className="button button-lime" href={card.url} download={card.file.name} onClick={() => { downloadedUrl.current = card.url; }}><Download size={18}/>下载角色卡</a>}
        {canShareImage && <button className="button button-outline" disabled={busy} onClick={() => share(imageShareData, true)}><Share2 size={18}/>分享图片</button>}
      </div>
    </section>}
    <details className="share-fallback" open={fallbackOpen} onToggle={event => setFallbackOpen(event.currentTarget.open)}>
      <summary>复制链接与文案</summary>
      <textarea ref={input} className="share-input share-invitation" aria-label="角色分享邀请" value={text} readOnly onFocus={event => event.target.select()}/>
      <button className="text-button" onClick={copy}><Copy size={16}/>复制剧本邀请</button>
    </details>
  </Modal>;
}
