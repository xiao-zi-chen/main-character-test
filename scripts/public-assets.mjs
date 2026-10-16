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
  if (roles.length !== 20) throw new Error('Expected exactly twenty current media entries.');
  const paths = new Set(['media/manifest.json']);
  for (const [id, media] of roles) {
    if (!roleIdPattern.test(id) || !media || typeof media !== 'object' || Array.isArray(media) || media.status !== 'final') {
      throw new Error(`Invalid current media entry: ${id}`);
    }
    paths.add(`media/${id}.mp4`);
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
