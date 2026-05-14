// Mirror of backend heuristic in
// html-to-pdf/src/services/content.service.ts (markdownIndicators +
// detectContentType). Keep this file in sync if the backend heuristic
// changes — the backend is the source of truth; this is best-effort
// preview labeling.
export type ContentType = 'html' | 'markdown';

const MARKDOWN_INDICATORS: RegExp[] = [
  /^#{1,6}\s/m,
  /^\s*[*\-+]\s/m,
  /^\s*\d+\.\s/m,
  /\*\*[^*]+\*\*/,
  /(^|\s)_[^_]+_(\s|$)/,
  /^\s*>\s/m,
  /^```/m,
  /^\s*\|.*\|\s*$/m,
  /\[[^\]]+\]\([^)]+\)/,
];

export const detectType = (content: string): ContentType => {
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return 'html';
  if (MARKDOWN_INDICATORS.some((p) => p.test(trimmed))) return 'markdown';
  return 'html';
};
