import React, { useEffect, useRef, useState } from 'react';
import { mediaPath } from '../data/roles.js';
import { RoleCardArtwork } from './RoleCardArtwork.jsx';

export function VideoPlayer({ role, media, autoplay = false, nativeControls = false }) {
  const ref = useRef(null);
  const ended = useRef(false);
  const playbackSession = useRef(0);
  const [message, setMessage] = useState('');
  const [hasPlayed, setHasPlayed] = useState(false);
  const src = mediaPath(role, 'mp4', media?.videoRevision ?? media?.revision);

  function revealPlayback(video) {
    // Some embedded players advance without delivering a reliable `playing`
    // event. Never leave our opaque cover over a running video.
    if (video === ref.current && !video.paused && video.readyState >= 2) {
      setMessage('');
      setHasPlayed(true);
    }
  }

  function play() {
    const video = ref.current;
    if (!video || ended.current) return;
    const session = playbackSession.current;
    const failed = () => {
      if (session === playbackSession.current && video === ref.current) setMessage('轻触画面播放短片');
    };
    try {
      if (video.error) video.load();
      const request = video.play();
      // Older Android webviews can return void instead of a Promise.
      if (request && typeof request.then === 'function') request.then(() => {
        if (session === playbackSession.current) revealPlayback(video);
      }, failed);
    } catch {
      failed();
    }
  }

  useEffect(() => {
    const video = ref.current;
    playbackSession.current += 1;
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
      playbackSession.current += 1;
      video.pause();
      document.removeEventListener('casting:video-play', pauseOther);
      document.removeEventListener('visibilitychange', pauseHidden);
      document.removeEventListener('WeixinJSBridgeReady', bridgeReady);
    };
  }, [src, autoplay]);

  return <div className="video-player">
    <video ref={ref} src={src} controls={nativeControls} playsInline={nativeControls ? undefined : true}
      webkit-playsinline={nativeControls ? undefined : 'true'} x5-video-player-type={nativeControls ? undefined : 'h5-page'}
      preload="auto" disablePictureInPicture controlsList={nativeControls ? 'nodownload noremoteplayback' : 'nodownload nofullscreen noremoteplayback'}
      aria-label={`${role.name}的短片，轻触画面播放`} tabIndex={0}
      onClick={nativeControls ? undefined : play} onKeyDown={nativeControls ? undefined : event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); play(); } }}
      onPlay={event => document.dispatchEvent(new CustomEvent('casting:video-play', { detail:event.currentTarget }))}
      onPlaying={event => revealPlayback(event.currentTarget)}
      onTimeUpdate={event => {
        if (event.currentTarget.currentTime > 0) revealPlayback(event.currentTarget);
      }}
      onError={() => setMessage('短片加载失败，轻触画面重试')}
      onEnded={event => {
        if (nativeControls) return; // Leave replay/seeking to the native controls.
        ended.current = true;
        const video = event.currentTarget;
        video.pause();
        // Keep a decoded frame on browsers that clear the video at its duration.
        if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.duration - 0.04);
      }}/>
    {!nativeControls && !hasPlayed && <div className="video-card-poster" aria-hidden="true"><RoleCardArtwork role={role} media={media}/></div>}
    {nativeControls ? <div className="native-video-actions">
      {message && <><p role="status">{message}</p><button type="button" onClick={play}>播放短片</button></>}
      <a href={src} onClick={() => ref.current?.pause()}>仍无画面？单独打开短片</a>
    </div> : <span className="sr-only" role="status">{message}</span>}
  </div>;
}
