import React, { useEffect, useRef, useState } from 'react';
import { Share2, Copy, Download, MessageCircle, CircleDot } from 'lucide-react';
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
  const [card, setCard] = useState(null);
  const [message, setMessage] = useState('');
  const [showCard, setShowCard] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const wechat = /MicroMessenger/i.test(navigator.userAgent);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    fetch(cardUrl, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Card unavailable');
      return response.blob();
    }).then(async blob => {
      const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
      if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => signature[i] === byte)) throw new Error('Invalid PNG card');
      if (controller.signal.aborted) return;
      const file = new File([blob], `${role.name}-主角剧本.png`, { type: 'image/png' });
      objectUrl = URL.createObjectURL(blob);
      setCard({ file, url: objectUrl });
    }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [cardUrl, role.name]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('剧本邀请已复制，可以粘贴给朋友。');
    } catch {
      input.current?.focus(); input.current?.select();
      setMessage('请长按或选中下方邀请，手动复制。');
    }
  };
  const share = async (withImage = false) => {
    if (busy) return;
    if (typeof navigator.share !== 'function') {
      setShowCard(withImage);
      setMessage(withImage ? '长按下方角色卡保存，再打开微信发布朋友圈；邀请文案也可以复制。' : '复制下方剧本邀请，粘贴到微信、QQ 或其他聊天中。');
      return;
    }
    const data = { title: partner ? `${role.name} × ${partner.name} · 同片搭档` : `${role.name} · 我的主角剧本`, text: invitation, url: url.href };
    if (withImage) {
      if (!card || !navigator.canShare?.({ files: [card.file] })) {
        setShowCard(true);
        setMessage('请保存下方角色卡，再打开微信发布朋友圈。');
        return;
      }
      data.files = [card.file];
    }
    setBusy(true);
    try { await navigator.share(data); }
    catch (error) {
      if (error.name !== 'AbortError') {
        setShowCard(withImage);
        setMessage('暂时无法打开系统分享，请复制邀请或保存角色卡后分享。');
      }
    } finally { setBusy(false); }
  };
  return <Modal title={partner ? '分享同片搭档' : '分享剧本'} onClose={onClose} className="small-modal script-share-modal">
    <Share2 className="modal-symbol" size={28}/><h2>{partner ? '这部短片里的另一个主角，会是 TA 吗？' : '把你的主角剧本，分享出去。'}</h2>
    <p className="share-role-name">{partner ? `${role.name} × ${partner.name}` : role.name}</p>
    <div className="share-destinations">
      <button className="button button-lime" disabled={busy} onClick={() => share(false)}><Share2 size={18}/>更多分享方式</button>
      <button className="button button-outline" onClick={copy}><Copy size={18}/>复制剧本邀请</button>
      <button className="button button-outline" onClick={() => { setShowCard(true); setMessage(wechat ? '点击微信右上角「···」可尝试发送给朋友；也可以保存角色卡或复制邀请发送。' : '复制剧本邀请发给微信好友，或保存下方角色卡发送。'); }}><MessageCircle size={18}/>微信好友</button>
      <button className="button button-outline" disabled={busy} onClick={() => { setShowCard(true); setMessage(wechat ? '长按保存角色卡，打开朋友圈选择图片发布。右上角「···」如有「分享到朋友圈」，也可使用该入口。' : '保存角色卡，在朋友圈选择图片发布；也可用下方按钮尝试分享图片。'); }}><CircleDot size={18}/>朋友圈</button>
    </div>
    <p className="share-status" role="status">{message || '选择一种方式，让朋友来看看你的剧本。'}</p>
    <textarea ref={input} className="share-input share-invitation" aria-label="角色分享邀请" value={text} readOnly onFocus={event => event.target.select()}/>
    {showCard && <div className="share-card-preview">
      <p>长按图片保存到相册，配上邀请文案就能发朋友圈。</p>
      {imageFailed ? <p role="alert">角色卡暂未加载成功。<button className="text-button" onClick={() => setImageFailed(false)}>重试图片</button>也可以先复制剧本邀请。</p> : <img src={card?.url || cardUrl} alt={`${role.name}的朋友圈分享卡`} onError={() => setImageFailed(true)}/>}
      <div className="share-card-actions">{card && <a className="button button-lime" href={card.url} download={`${role.name}-主角剧本.png`}><Download size={18}/>保存分享卡</a>}<button className="button button-outline" disabled={busy} onClick={() => share(true)}><Share2 size={18}/>分享图片</button></div>
    </div>}
  </Modal>;
}
