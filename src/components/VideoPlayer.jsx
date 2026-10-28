import React, { useEffect, useRef, useState } from 'react';
import { mediaPath } from '../data/roles.js';
import { RoleCardArtwork } from './RoleCardArtwork.jsx';

export function VideoPlayer({ role, media, autoplay = false }) {
  const ref = useRef(null);
  const ended = useRef(false);
  const [message, setMessage] = useState('');
  const [hasPlayed, setHasPlayed] = useState(false);
  const src = mediaPath(role, 'mp4', media?.videoRevision ?? media?.revision);

  function play() {
    if (ended.current) return;
    const video = ref.current;
    if (video.error) video.load();
    video.play().catch(() => setMessage('轻触画面播放短片'));
  }

  useEffect(() => {
    const video = ref.current;
    ended.current = false;
    setMessage('');
    setHasPlayed(false);
    const pauseOther = event => { if (event.detail !== video) video.pause(); };
    const pauseHidden = () => { if (document.hidden) video.pause(); };
    // WeChat may grant sound playback when its bridge becomes ready.
    const bridgeReady = () => { if (autoplay && video.paused) play(); };
    document.addEventListener('casting:video-play', pauseOther);
    document.addEventListener('visibilitychange', pauseHidden);
    document.addEventListener('WeixinJSBridgeReady', bridgeReady);
    if (autoplay) play();
    return () => {
      video.pause();
      document.removeEventListener('casting:video-play', pauseOther);
      document.removeEventListener('visibilitychange', pauseHidden);
      document.removeEventListener('WeixinJSBridgeReady', bridgeReady);
    };
  }, [src, autoplay]);

  return <div className="video-player">
    <video ref={ref} src={src} playsInline
      webkit-playsinline="true" x5-playsinline="true" x5-video-player-type="h5-page"
      preload="auto" disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback"
      aria-label={`${role.name}的短片，轻触画面播放`} tabIndex={0}
      onClick={play} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); play(); } }}
      onPlay={event => document.dispatchEvent(new CustomEvent('casting:video-play', { detail:event.currentTarget }))}
      onPlaying={() => { setMessage(''); setHasPlayed(true); }}
      onError={() => setMessage('短片加载失败，轻触画面重试')}
      onEnded={event => {
        ended.current = true;
        const video = event.currentTarget;
        video.pause();
        // Keep a decoded frame on browsers that clear the video at its duration.
        if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.duration - 0.04);
      }}/>
    {!hasPlayed && <div className="video-card-poster" aria-hidden="true"><RoleCardArtwork role={role} media={media}/></div>}
    <span className="sr-only" role="status">{message}</span>
  </div>;
}
