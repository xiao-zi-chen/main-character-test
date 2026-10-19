// Keep question artwork local to the site, including deployments under a subpath.
import { revision as artRevision } from '../public/question-art/manifest.json';

export function questionArt(id, kind = 'scene') {
  return `${import.meta.env.BASE_URL}question-art/${id.replace('.', '-')}/${kind}.webp?v=${encodeURIComponent(artRevision)}`;
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
