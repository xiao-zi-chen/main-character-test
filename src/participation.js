// Keep one short-lived request/result across home navigation and StrictMode mounts.
// The server owns both the statistic and its display formatting.
let display = null;
let expiresAt = 0;
let pending = null;

export function peekParticipationDisplay() {
  return display;
}

export function getParticipationDisplay() {
  if (pending) return pending;
  if (Date.now() < expiresAt) return Promise.resolve(display);
  pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/participation', { signal: controller.signal });
      if (!response.ok) throw new Error('Participation display unavailable');
      const result = await response.json();
      if (typeof result?.displayCount !== 'string' || !/^\d+\.\d[kw]$/.test(result.displayCount)) {
        throw new Error('Invalid participation display');
      }
      display = result.displayCount;
      expiresAt = Date.now() + 60_000;
    } catch {
      // Retain the last successful display, or omit the line on an initial failure.
      expiresAt = Date.now() + 10_000;
    } finally {
      clearTimeout(timeout);
      pending = null;
    }
    return display;
  })();
  return pending;
}
