import { questions } from '../src/data/questions.js';
import { roles as currentRoles } from '../src/data/roles.js';

const roleIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const imagePattern = /^[a-z0-9_-]+\.(?:jpg|png|webp)$/;
const optionalAssetPatterns = {
  voice: /^[a-z0-9_-]+\.m4a$/,
  subtitles: /^[a-z0-9_-]+\.srt$/,
};

// This manifest is the release boundary. Backups and unused source files must
// never become public merely because they happen to be in public/media.
export function publicAssetPaths(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Expected a media manifest object.');
  }
  const roles = Object.entries(manifest);
  if (roles.length !== currentRoles.length || currentRoles.some(role => !Object.hasOwn(manifest,role.id))) throw new Error('Expected exactly the current character media entries.');
  const paths = new Set(['media/manifest.json']);
  for (const [id, media] of roles) {
    if (!roleIdPattern.test(id) || !media || typeof media !== 'object' || Array.isArray(media) || media.status !== 'final') {
      throw new Error(`Invalid current media entry: ${id}`);
    }
    const role = currentRoles.find(role => role.id === id);
    if (media.video !== `${role.videoId}.mp4`) throw new Error(`Invalid shared video filename for ${id}`);
    paths.add(`media/${media.video}`);
    paths.add(`worlds/${id}.svg`);
    // Match mediaAsset(): a missing image field uses the role's default JPG.
    for (const kind of ['portrait', 'poster', 'avatar']) {
      const filename = media[kind] === undefined ? `${id}.jpg` : media[kind];
      if (typeof filename !== 'string' || !imagePattern.test(filename)) {
        throw new Error(`Invalid ${kind} filename for ${id}`);
      }
      paths.add(`media/${filename}`);
    }
    for (const [kind, pattern] of Object.entries(optionalAssetPatterns)) {
      if (media[kind] === undefined) continue;
      if (typeof media[kind] !== 'string' || !pattern.test(media[kind])) {
        throw new Error(`Invalid ${kind} filename for ${id}`);
      }
      paths.add(`media/${media[kind]}`);
    }
  }
  return [...paths].sort();
}

export const publicEntryPaths = Object.freeze(['collector.js', 'public-config.js', 'favicon.svg']);

export function questionArtPaths(manifest) {
  const entries = manifest?.questions;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)
    || Object.keys(entries).length !== questions.length) {
    throw new Error('Expected artwork for exactly the current forty questions.');
  }
  const paths = ['question-art/manifest.json'];
  for (const { id } of questions) {
    for (const kind of ['scene', 'left', 'right']) {
      const filename = `${id.replace('.', '-')}/${kind}.webp`;
      if (entries[id]?.assets?.[kind]?.file !== filename) {
        throw new Error(`Invalid question image: ${id}/${kind}`);
      }
      paths.push(`question-art/${filename}`);
    }
  }
  return paths.sort();
}
