export function durationSeconds(media) {
  const seconds=Number(media?.duration);
  return Number.isFinite(seconds)&&seconds>0?Math.round(seconds):null;
}

export function durationLabel(media) {
  const seconds=durationSeconds(media);
  return seconds===null?'':`${seconds} 秒`;
}

export function formatPlaybackTime(seconds) {
  if(!Number.isFinite(seconds)||seconds<=0) return '--:--';
  const rounded=Math.round(seconds);
  return `${String(Math.floor(rounded/60)).padStart(2,'0')}:${String(rounded%60).padStart(2,'0')}`;
}

export function collectionDuration(manifest) {
  const durations=Object.values(manifest).map(durationSeconds).filter(value=>value!==null);
  if(!durations.length) return null;
  const min=Math.min(...durations),max=Math.max(...durations);
  return min===max?min:`${min}–${max}`;
}
import { mediaPath } from './data/roles.js';
import { mediaBaseUrl } from './runtime-config.js';

export function mediaAsset(role, media, kind='portrait') {
  const filename=media?.[kind];
  return typeof filename==='string'&&/^[a-z0-9_-]+\.(png|jpg|webp|srt|m4a)$/.test(filename)
    ? `${mediaBaseUrl()}media/${filename}${media.revision?`?v=${encodeURIComponent(media.revision)}`:''}`
    : mediaPath(role,'jpg',media?.revision);
}
