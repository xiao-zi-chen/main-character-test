import { hiddenRoles } from './data/roles.js';

export const HIDDEN_STORAGE_KEY = 'main-character-casting:hidden:v1';
const allowedIds = new Set(hiddenRoles.map(role => role.id));
export const hiddenUnlockRules = [
  {
    roleId: 'heaven-admin',
    label: '规则与自由同时在线',
    conditions: { logic: ['>=', 75], order: ['>=', 75], freedom: ['>=', 75], focus: ['>=', 75], social: ['<=', 40] },
  },
  {
    roleId: 'cosmic-director',
    label: '脑洞与连接共同开场',
    conditions: { explore: ['>=', 75], imagine: ['>=', 67], social: ['>=', 80], freedom: ['>=', 75], focus: ['<=', 25] },
  },
];

export function hiddenRoleForScores(scores) {
  const values = Object.fromEntries(scores.map(score => [score.id, score.value]));
  const match = hiddenUnlockRules.find(rule => Object.entries(rule.conditions).every(([dimension, [operator, threshold]]) => {
    const value = values[dimension];
    return Number.isFinite(value) && (operator === '>=' ? value >= threshold : value <= threshold);
  }));
  return match?.roleId ?? null;
}

export function readHiddenState(storage) {
  try {
    const data = JSON.parse(storage.getItem(HIDDEN_STORAGE_KEY));
    if (data?.version !== 1) return { enabled: false, unlocked: [] };
    return {
      enabled: data.enabled === true,
      unlocked: Array.isArray(data.unlocked) ? [...new Set(data.unlocked.filter(id => allowedIds.has(id)))] : [],
    };
  } catch { return { enabled: false, unlocked: [] }; }
}

export function saveHiddenState(storage, state) {
  try {
    storage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify({ version: 1, enabled: state?.enabled === true, unlocked: Array.isArray(state?.unlocked)?[...new Set(state.unlocked.filter(id => allowedIds.has(id)))]:[] }));
    return true;
  } catch { return false; }
}

export function canViewRole(role, hiddenState) {
  return Boolean(role) && (!role.hidden || (Array.isArray(hiddenState?.unlocked)&&hiddenState.unlocked.includes(role.id)));
}
