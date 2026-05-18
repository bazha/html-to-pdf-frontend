import { useEffect, useState } from 'react';
import { renderMarkdownToHtml, sanitizeHtml } from '../utils/renderMarkdown';
import type { ContentType } from '../utils/detectType';

interface Props {
  content: string;
  detectedType: ContentType;
}

const DEBOUNCE_MS = 150;

// The iframe uses sandbox="" (no allow-same-origin / allow-scripts), so it
// has an opaque origin and cannot inherit the parent's font cache. Importing
// the same Google Fonts inside the iframe stylesheet lets the preview match
// the surrounding UI typography (fixes the system-fallback look noted in
// review item #12). Sandbox still permits external CSS/font fetches.
// Preview renders on a light "page" inside the dark surface — the page is
// what the PDF will actually look like (white), framed by a dark gutter so
// it floats inside the editor card.
const PREVIEW_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wdth,wght@0,75..125,200..900;1,75..125,200..900&family=Fragment+Mono:ital@0;1&display=swap');
  :root { color-scheme: light dark; }
  html, body { margin: 0; }
  html { background: #14171e; }
  @media (prefers-color-scheme: light) {
    html { background: #eef0f4; }
  }
  body {
    font: 16px/1.65 'Mona Sans', ui-sans-serif, system-ui, sans-serif;
    font-variation-settings: 'wdth' 100, 'wght' 400;
    color: #14171e;
    background: #ffffff;
    margin: 22px 28px 26px;
    padding: 36px 44px 44px;
    border-radius: 8px;
    box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 18px 40px -22px rgba(0,0,0,.45);
  }
  h1, h2, h3, h4 {
    font-family: 'Mona Sans', sans-serif;
    font-variation-settings: 'wdth' 96, 'wght' 660;
    letter-spacing: -.025em;
    line-height: 1.08;
    margin: 0 0 14px;
    color: #0a0b0e;
  }
  h1 { font-size: 32px; font-variation-settings: 'wdth' 92, 'wght' 720; letter-spacing: -.035em; }
  h2 { font-size: 24px; font-variation-settings: 'wdth' 94, 'wght' 660; }
  h3 { font-size: 19px; font-variation-settings: 'wdth' 96, 'wght' 620; }
  h4 { font-size: 16px; font-variation-settings: 'wdth' 100, 'wght' 620; }
  p { margin: 0 0 14px; color: #1f242c; }
  em { font-style: italic; }
  strong { font-variation-settings: 'wdth' 100, 'wght' 620; font-weight: normal; }
  blockquote {
    margin: 18px 0;
    padding: 2px 0 2px 16px;
    border-left: 2px solid #b5e368;
    color: #3a414b;
    font-style: italic;
    font-size: 16px;
  }
  ul, ol { padding-left: 1.2em; margin: 0 0 14px; color: #1f242c; }
  li { margin: 0 0 4px; }
  hr { border: 0; border-top: 1px solid #e7eaf0; margin: 22px 0; }
  pre, code {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    background: #f3f5f9;
    color: #14171e;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 13px;
  }
  pre { padding: 14px 16px; overflow-x: auto; line-height: 1.6; border: 1px solid #e7eaf0; }
  pre code { background: transparent; padding: 0; }
  a {
    color: #14171e;
    border-bottom: 1.5px solid #b5e368;
    text-decoration: none;
    padding-bottom: 1px;
  }
  a:hover { background: #b5e368; color: #0e1206; padding: 1px 4px 2px; margin: -1px -4px -2px; border-radius: 3px; border-bottom-color: transparent; }
  img { max-width: 100%; height: auto; display: block; margin: 14px 0; border-radius: 4px; }
  table { border-collapse: collapse; margin: 14px 0; font-size: 14px; width: 100%; }
  th, td { padding: 8px 12px; border-bottom: 1px solid #e7eaf0; text-align: left; }
  th { font-variation-settings: 'wdth' 100, 'wght' 620; font-weight: normal; color: #0a0b0e; }
`;

export const Preview = ({ content, detectedType }: Props) => {
  const [srcDoc, setSrcDoc] = useState('');
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const body = detectedType === 'markdown'
        ? renderMarkdownToHtml(content)
        : sanitizeHtml(content);
      setSrcDoc(
        `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLES}</style></head><body>${body}</body></html>`,
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [content, detectedType]);
  return (
    <iframe
      title="preview"
      className="preview-frame"
      sandbox=""
      srcDoc={srcDoc}
    />
  );
};
