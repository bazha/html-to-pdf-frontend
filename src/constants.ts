// App-wide constants that are shared across more than one module. Values used by a
// single file (local debounce/refresh timings, poll intervals) intentionally stay
// next to their use site — only genuinely cross-file values live here.

// Submit window for editor content length (characters).
export const CONTENT_MIN = 10
export const CONTENT_MAX = 50_000

// Default API base URL when VITE_API_BASE_URL is unset. Used by the fetch boundary
// (api/pdfClient.ts) and surfaced for display in the header (App.tsx).
export const API_BASE_URL_DEFAULT = 'http://localhost:3000'

// localStorage keys. Centralized so the `press.*` namespace has one source of truth.
export const STORAGE_KEYS = {
    theme: 'press.theme',
    options: 'press.options',
    optionsExpanded: 'press.options.expanded',
} as const
