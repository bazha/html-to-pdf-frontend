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
const PREVIEW_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..700&family=Geist+Mono:wght@300;400;500&display=swap');
  body {
    font: 16px/1.55 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
    font-variation-settings: 'opsz' 16, 'wdth' 95, 'wght' 400;
    color: #0a0a0a;
    padding: 28px 32px;
    background: #fff;
    margin: 0;
  }
  h1, h2, h3 {
    font-variation-settings: 'opsz' 64, 'wdth' 85, 'wght' 600;
    letter-spacing: -.02em;
    margin: 0 0 16px;
    line-height: 1.05;
  }
  h1 { font-size: 32px; }
  h2 { font-size: 24px; }
  h3 { font-size: 19px; }
  p { margin: 0 0 14px; }
  ul, ol { padding-left: 1.1em; margin: 0 0 14px; }
  pre, code { font-family: 'Geist Mono', ui-monospace, monospace; background: #f3f3f3; padding: 1px 6px; border-radius: 4px; font-size: 13px; }
  pre { padding: 12px 14px; overflow-x: auto; }
  a { color: #0a0a0a; border-bottom: 1px solid #0a0a0a; text-decoration: none; }
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
