// The server supplies the media origin before the application starts. Keep the
// Vite base as a fallback for standalone builds and Node-based tooling.
export function mediaBaseUrl() {
  const runtimeBase = typeof window === 'undefined' ? undefined : window.NBTI_PUBLIC_CONFIG?.mediaBaseUrl;
  return runtimeBase || import.meta.env?.BASE_URL || './';
}
