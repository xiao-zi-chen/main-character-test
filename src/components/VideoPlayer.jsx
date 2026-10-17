import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Download, Film } from 'lucide-react';
import { mediaPath } from '../data/roles.js';
import { durationLabel, formatPlaybackTime, mediaAsset } from '../media.js';

export function VideoPlayer({ role, media, autoplay = false }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(Number(media?.duration) || 0);
  const src = mediaPath(role, 'mp4', media?.videoRevision ?? media?.revision);

  useEffect(() => {
    const video = ref.current;
    setFailed(false);
    setPlaying(false);
    setWaiting(false);
    setProgress(0);
    const pauseOther = event => { if (event.detail !== video) video.pause(); };
    const pauseHidden = () => { if (document.hidden) video.pause(); };
    document.addEventListener('casting:video-play', pauseOther);
    document.addEventListener('visibilitychange', pauseHidden);
    // Opening a short film requests sound. If the browser requires another
    // gesture, leave the play button available instead of silently muting it.
    if (autoplay) play();
    return () => {
      video.pause();
      document.removeEventListener('casting:video-play', pauseOther);
      document.removeEventListener('visibilitychange', pauseHidden);
    };
  }, [src, autoplay]);

  function play() {
    ref.current?.play().catch(() => { setPlaying(false); setWaiting(false); });
  }
  function retry() {
    setFailed(false);
    setWaiting(true);
    ref.current.load();
    play();
  }
  return <div className="video-player">
    <video ref={ref} src={src} poster={mediaAsset(role, media)} muted={muted} loop playsInline preload={autoplay ? 'auto' : 'metadata'}
      aria-label={`${role.name}，${durationLabel({duration:seconds})}角色视频`}
      onLoadedMetadata={event => setSeconds(event.currentTarget.duration)}
      onPlay={event => { setPlaying(true); document.dispatchEvent(new CustomEvent('casting:video-play', { detail:event.currentTarget })); }}
      onPause={() => setPlaying(false)} onWaiting={() => setWaiting(true)} onPlaying={() => setWaiting(false)} onCanPlay={() => setWaiting(false)}
      onError={() => { setFailed(true); setPlaying(false); setWaiting(false); }}
      onTimeUpdate={event => { const video = event.currentTarget; setProgress(video.duration > 0 ? video.currentTime / video.duration * 100 : 0); }}/>
    <span className="video-duration">{formatPlaybackTime(seconds)}</span>
    {!playing && !failed && !waiting && <button className="big-play" onClick={play} aria-label="播放视频" title="播放视频"><Play size={28} fill="currentColor"/></button>}
    {waiting && !failed && <div className="video-loading" role="status"><span className="loading-spinner"/>正在加载短片</div>}
    {failed && <div className="video-error" role="status"><Film size={28}/><p>短片暂时没加载出来</p><button className="button button-outline" onClick={retry}><RotateCcw size={16}/>重新加载</button></div>}
    <div className="video-controls">
      <button className="icon-button" aria-label={playing ? '暂停视频' : '播放视频'} title={playing ? '暂停视频' : '播放视频'} onClick={() => playing ? ref.current.pause() : play()} disabled={failed}>{playing ? <Pause size={19}/> : <Play size={19}/>}</button>
      <span className="video-track" aria-hidden="true"><i style={{width:`${Math.min(progress,100)}%`}}/></span>
      <button className="icon-button" aria-label={media?.hasAudio === false ? '此短片没有声音' : muted ? '开启声音' : '关闭声音'} title={muted ? '开启声音' : '关闭声音'} onClick={() => setMuted(value => !value)} disabled={failed || media?.hasAudio === false}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button>
      <a className="icon-button" href={src} download={`${role.name}.mp4`} aria-label="下载角色短片" title="下载角色短片"><Download size={18}/></a>
    </div>
  </div>;
}
