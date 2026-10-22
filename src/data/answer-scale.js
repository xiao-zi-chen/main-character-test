// Keep the questionnaire version distinct from the original binary questionnaire.
export const QUESTIONNAIRE_VERSION = 'nbti-2026-10-20-scale15-sample20';
export const LEGACY_QUESTIONNAIRE_VERSION = 'nbti-2026-10-01';

// The original A wording anchors the left endpoint; B anchors the right endpoint.
export const SCALE_MIN = 0;
export const SCALE_MAX = 14;
export const SCALE_MID = 7;
export const SCALE_STEPS = SCALE_MAX - SCALE_MIN + 1;

// Five artwork/label groups cover three exact answer values each.
// Only presentation is grouped: scoring and collection retain all 15 values.
export const SCALE_LABELS = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'];
export const SCALE_SHORTCUTS = [0, 4, 7, 10, 14];
export const reactionIndex = value => Math.min(4, Math.max(0, Math.floor((value - SCALE_MIN) / 3)));
