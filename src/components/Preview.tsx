import { useEffect, useState } from 'react';
import { renderMarkdownToHtml, sanitizeHtml } from '../utils/renderMarkdown';
import type { ContentType } from '../utils/detectType';

interface Props {
  content: string;
  detectedType: ContentType;
}

const DEBOUNCE_MS = 150;

export const Preview = ({ content, detectedType }: Props) => {
  const [srcDoc, setSrcDoc] = useState('');
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const body = detectedType === 'markdown'
        ? renderMarkdownToHtml(content)
        : sanitizeHtml(content);
      setSrcDoc(
        `<!doctype html><html><head><meta charset="utf-8"><style>
          body{font:13px/1.55 system-ui,sans-serif;color:#111;padding:16px;background:#fff;}
          pre,code{font-family:ui-monospace,monospace;}
        </style></head><body>${body}</body></html>`,
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [content, detectedType]);
  return (
    <iframe
      title="preview"
      className="pane"
      sandbox=""
      srcDoc={srcDoc}
      style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
    />
  );
};
