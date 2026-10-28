// Use the same runtime media origin as videos and cards; local builds retain
// their Vite base through mediaBaseUrl().
import { revision as artRevision } from '../public/question-art/manifest.json';
import { mediaBaseUrl } from './runtime-config.js';

export function questionArt(id, kind = 'scene') {
  return `${mediaBaseUrl()}question-art/${id.replace('.', '-')}/${kind}.webp?v=${encodeURIComponent(artRevision)}`;
}

export function preloadQuestionArt(id) {
  if (!id) return;
  for (const kind of ['scene', 'left', 'right']) {
    const image = new Image();
    image.src = questionArt(id, kind);
  }
}

export function preloadQuestionReactions(id) {
  if (!id) return;
  for (let value = 0; value < 5; value++) {
    const image = new Image();
    image.src = questionArt(id, `scale-${value}`);
  }
}
