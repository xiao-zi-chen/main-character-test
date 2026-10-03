/* React quiz hooks submit one scale response on Next, with foreground response time. */
(function () {
  'use strict';
  const STORAGE_KEY = 'nbti:collector:v1';
  const VERSION = 'nbti-2026-10-02-scale15';
  let state;
  let storageAvailable = true;
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),
    byte => byte.toString(16).padStart(2, '0')).join('');
  function uuidFromBytes(bytes) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function randomUUID() {
    return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() :
      uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
  }
  async function sha256(input) {
    if (crypto.subtle?.digest) return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    // Web Crypto hashing and randomUUID require HTTPS; getRandomValues also
    // works on HTTP. Keep the same SHA-256 identity during the HTTP rollout.
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const hash = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    const message = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
    message.set(input);
    message[input.length] = 0x80;
    const view = new DataView(message.buffer);
    view.setUint32(message.length - 8, Math.floor(input.length / 0x20000000));
    view.setUint32(message.length - 4, input.length * 8);
    const words = new Uint32Array(64);
    const rotate = (value, count) => (value >>> count) | (value << (32 - count));
    for (let offset = 0; offset < message.length; offset += 64) {
      for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const previous = words[i - 15], earlier = words[i - 2];
        const sigma0 = rotate(previous, 7) ^ rotate(previous, 18) ^ (previous >>> 3);
        const sigma1 = rotate(earlier, 17) ^ rotate(earlier, 19) ^ (earlier >>> 10);
        words[i] = words[i - 16] + sigma0 + words[i - 7] + sigma1;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let i = 0; i < 64; i++) {
        const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const choose = (e & f) ^ (~e & g);
        const first = (h + sum1 + choose + constants[i] + words[i]) >>> 0;
        const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const second = (sum0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + first) >>> 0;
        d = c; c = b; b = a; a = (first + second) >>> 0;
      }
      const block = [a, b, c, d, e, f, g, h];
      for (let i = 0; i < 8; i++) hash[i] += block[i];
    }
    const output = new Uint8Array(32), result = new DataView(output.buffer);
    for (let i = 0; i < 8; i++) result.setUint32(i * 4, hash[i]);
    return output;
  }
  try {
    state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (_) { /* Start a fresh anonymous identity if storage is unavailable. */ }
  if (!state || state.version !== 2 || !Array.isArray(state.runs) ||
      !/^[0-9a-f]{64}$/.test(state.participantToken || '')) {
    state = { version: 2, participantToken: newToken(), participantId: null, activeSessionId: null, runs: [] };
  }
  // The binary questionnaire has been retired. Keep an existing secure identity,
  // but remove its old outbox so a stale tab cannot restore deleted A/B records.
  state.runs = state.runs.filter(run => run?.session?.questionnaireVersion === VERSION);
  delete state.legacyResume;
  try {
    localStorage.removeItem('nbti:collector:legacy:v1');
    localStorage.removeItem('nbti:collector:ab:v2');
  } catch (_) { storageAvailable = false; }
  let inQuiz = false;
  let segmentStartedAt = null;
  let uploading = false;
  let retryTimer = null;
  let lastError = false;
  let selectionLimit = false;
  let badge;

  if (activeRun()?.session.questionnaireVersion !== VERSION) state.activeSessionId = null;
  const identityReady = sha256(
    new TextEncoder().encode('nbti:participant:v2:' + state.participantToken)).then(bytes => {
    state.participantId = uuidFromBytes(bytes.slice(0, 16));
    for (const run of state.runs) run.session.participantId = state.participantId;
    persist();
    return state.participantId;
  });

  function activeRun() {
    return state.runs.find(run => run.session.id === state.activeSessionId);
  }
  function pending(run) {
    // The attempt and its start time remain local until the first Next response.
    if (!run.answers.length) return false;
    return !run.syncedSession || run.syncedCount < run.answers.length ||
      (run.session.completedAt && run.syncedCompletedAt !== run.session.completedAt);
  }
  function renderStatus() {
    if (!badge) return;
    const hasPending = state.runs.some(pending);
    badge.textContent = selectionLimit ? '本轮选择次数已达上限，请重新测试' :
      !storageAvailable ? '浏览器存储不可用，请保持页面打开' :
      uploading ? '正在保存答题记录…' : hasPending ?
      (lastError || !navigator.onLine ? '答题记录已暂存，等待同步' : '正在保存答题记录…') :
      '已提交的答题记录已保存';
    badge.hidden = !selectionLimit && !state.runs.some(run => run.answers.length);
    badge.dataset.pending = String(Boolean(hasPending));
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
    } catch (_) {
      storageAvailable = false;
    }
    renderStatus();
  }
  // Only time spent on a visible quiz page counts. Network time never affects a response.
  function accumulate() {
    const run = activeRun();
    if (!run || segmentStartedAt === null) return;
    const now = performance.now();
    const elapsed = Math.max(0, now - segmentStartedAt);
    run.activeElapsedMs += elapsed;
    run.questionElapsedMs += elapsed;
    segmentStartedAt = now;
  }
  function beginSegment() {
    segmentStartedAt = inQuiz && document.visibilityState === 'visible' ? performance.now() : null;
  }
  function pause() {
    accumulate();
    segmentStartedAt = null;
    persist();
  }
  function start({ resume = false } = {}) {
    const wasInQuiz = inQuiz;
    pause();
    let run = resume && activeRun()?.session.questionnaireVersion === VERSION ? activeRun() : null;
    const resumed = Boolean(run);
    if (resumed) {
      // Reopening is a draft until another response is confirmed. The server
      // invalidates the old completion only when a new event is accepted.
      run.session.completedAt = null;
      run.session.totalElapsedMs = null;
    }
    if (!run) {
      run = {
        session: {
          id: randomUUID(),
          participantId: state.participantId,
          questionnaireVersion: VERSION,
          startedAt: new Date().toISOString(),
          completedAt: null,
          totalElapsedMs: null
        },
        answers: [], syncedCount: 0, syncedCompletedAt: null, syncedSession: false,
        activeElapsedMs: 0, questionElapsedMs: 0, questionId: null
      };
      state.runs.push(run);
      state.activeSessionId = run.session.id;
    }
    delete state.legacyResume;
    selectionLimit = false;
    inQuiz = resumed && wasInQuiz;
    beginSegment();
    // Successfully uploaded old runs can be discarded from this browser's outbox.
    state.runs = state.runs.filter(item => item === run || pending(item));
    persist();
    void flush();
  }
  function show(questionId) {
    if (activeRun()?.session.questionnaireVersion !== VERSION) start({ resume: true });
    accumulate();
    const run = activeRun();
    const id = String(questionId);
    if (run.questionId !== id) {
      run.questionId = id;
      run.questionElapsedMs = 0;
    }
    inQuiz = true;
    beginSegment();
    persist();
  }
  function answer(questionId, scaleValue) {
    if (!Number.isInteger(scaleValue) || scaleValue < 0 || scaleValue > 14) return false;
    const id = String(questionId);
    if (!activeRun() || activeRun().questionId !== id) show(id);
    accumulate();
    const run = activeRun();
    if (run.answers.length >= 1000) {
      selectionLimit = true;
      renderStatus();
      return false;
    }
    run.session.completedAt = null;
    run.session.totalElapsedMs = null;
    run.answers.push({
      eventId: randomUUID(),
      sequence: run.answers.length + 1,
      questionId: id,
      scaleValue,
      responseTimeMs: Math.round(run.questionElapsedMs),
      answeredAt: new Date().toISOString()
    });
    run.questionElapsedMs = 0;
    persist();
    void flush();
    return true;
  }
  function complete() {
    accumulate();
    const run = activeRun();
    if (!run || run.session.questionnaireVersion !== VERSION) return;
    // A pre-existing browser-only progress record has no recoverable response times.
    // Such an incomplete collection must not be marked as a complete 40-question run.
    if (new Set(run.answers.map(answer => answer.questionId)).size === 40) {
      run.session.completedAt = new Date().toISOString();
      run.session.totalElapsedMs = Math.round(run.activeElapsedMs);
    }
    inQuiz = false;
    segmentStartedAt = null;
    persist();
    void flush();
  }
  function leave() {
    pause();
    inQuiz = false;
    void flush();
  }
  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flush();
    }, 5000);
  }
  async function flush() {
    if (uploading) return;
    if (!state.runs.some(pending)) { renderStatus(); return; }
    uploading = true;
    renderStatus();
    try {
      await identityReady;
      for (const run of state.runs) {
        while (pending(run)) {
          const from = run.syncedCount;
          const answers = run.answers.slice(from, from + 200);
          const end = from + answers.length;
          const session = { ...run.session };
          if (end < run.answers.length) {
            session.completedAt = null;
            session.totalElapsedMs = null;
          }
          const response = await fetch('/api/collect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Participant-Token': state.participantToken },
            body: JSON.stringify({ session, answers }),
            signal: AbortSignal.timeout(10000),
            keepalive: true
          });
          if (!response.ok) throw new Error(`Collection returned ${response.status}`);
          run.syncedCount = end;
          run.syncedSession = true;
          if (session.completedAt) run.syncedCompletedAt = session.completedAt;
          lastError = false;
          persist();
        }
      }
    } catch (_) {
      lastError = true;
      scheduleRetry();
    } finally {
      uploading = false;
      renderStatus();
      if (!lastError && state.runs.some(pending)) queueMicrotask(flush);
    }
  }
  function mountBadge() {
    badge = document.createElement('div');
    badge.id = 'nbti-save-status';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    Object.assign(badge.style, {
      position: 'fixed', left: '12px', bottom: '8px', zIndex: '30',
      fontSize: '11px', color: '#a8b6c9', background: 'rgba(9,14,24,.88)',
      padding: '3px 7px', borderRadius: '6px', pointerEvents: 'none',
      maxWidth: 'calc(100vw - 24px)'
    });
    document.body.appendChild(badge);
    renderStatus();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      pause();
      void flush();
    } else {
      beginSegment();
      void flush();
    }
  });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', beginSegment);
  window.addEventListener('online', () => { lastError = false; void flush(); });
  window.NBTICollector = Object.freeze({
    start, show, answer, complete, leave, flush, ready: identityReady,
    snapshot: () => JSON.parse(JSON.stringify(state))
  });
  persist();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBadge, { once: true });
  } else mountBadge();
  void flush();
})();
