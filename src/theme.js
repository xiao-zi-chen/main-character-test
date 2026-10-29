import { useSyncExternalStore } from 'react';

export const THEME_STORAGE_KEY = 'nbti:theme';
const themeColors = { dark: '#1b1c23', light: '#eeedf1' };
const isTheme = value => value === 'dark' || value === 'light';
const mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readPreference() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch { return null; }
}

let preference = readPreference();
const systemTheme = () => mediaQuery?.matches ? 'dark' : 'light';
let currentTheme = preference ?? systemTheme();
const subscribers = new Set();

function applyTheme(theme) {
  const changed = currentTheme !== theme;
  currentTheme = theme;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
  }
  if (changed) subscribers.forEach(notify => notify());
}

function onSystemChange() {
  if (preference === null) applyTheme(systemTheme());
}

function onStorageChange(event) {
  if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
  try {
    if (event.storageArea && event.storageArea !== window.localStorage) return;
  } catch { return; }
  preference = isTheme(event.newValue) ? event.newValue : null;
  applyTheme(preference ?? systemTheme());
}

// Set the document theme before React renders any page or modal.
applyTheme(currentTheme);
if (typeof window !== 'undefined') window.addEventListener('storage', onStorageChange);
if (mediaQuery?.addEventListener) mediaQuery.addEventListener('change', onSystemChange);
else mediaQuery?.addListener?.(onSystemChange);

function subscribe(notify) {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}
const getSnapshot = () => currentTheme;
const getServerSnapshot = () => 'light';

export function setTheme(theme) {
  if (!isTheme(theme)) return;
  preference = theme;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep the choice for this tab when storage is unavailable. */ }
  applyTheme(theme);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener('storage', onStorageChange);
  if (mediaQuery?.removeEventListener) mediaQuery.removeEventListener('change', onSystemChange);
  else mediaQuery?.removeListener?.(onSystemChange);
  subscribers.clear();
});
