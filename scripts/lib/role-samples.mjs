import { dimensions } from '../../src/data/questions.js';
import { SCALE_MAX, SCALE_SHORTCUTS } from '../../src/data/answer-scale.js';

export function seededRandom(seed) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

// Synthetic answer models, not estimates of the population's personality mix.
export const SAMPLE_MODELS = ['uniform15', 'fiveShortcuts', 'endpoints', 'centerBiased', 'consistentTrait'];

export function sampleDimensionUnits(random, model, count = 2) {
  const latent = model === 'consistentTrait' ? random() * SCALE_MAX : null;
  return Array.from({ length: count }, () => {
    switch (model) {
      case 'uniform15': return Math.floor(random() * (SCALE_MAX + 1));
      case 'fiveShortcuts': return SCALE_SHORTCUTS[Math.floor(random() * SCALE_SHORTCUTS.length)];
      case 'endpoints': return random() < .5 ? 0 : SCALE_MAX;
      case 'centerBiased': return Math.round((random() + random() + random()) / 3 * SCALE_MAX);
      case 'consistentTrait': return Math.max(0, Math.min(SCALE_MAX, Math.round(latent + (random() - .5) * 6)));
      default: throw new Error(`Unknown sampling model: ${model}`);
    }
  });
}

export function sampleScores(random, model) {
  return dimensions.map(dimension => {
    const units = sampleDimensionUnits(random, model);
    return { ...dimension, value: Math.round(units.reduce((a, b) => a + b, 0) / (units.length * SCALE_MAX) * 100) };
  });
}
