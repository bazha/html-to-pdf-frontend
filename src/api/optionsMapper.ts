import { escapeHtml } from '../utils/escapeHtml';
import { PLACEHOLDER_TOKENS, type PdfOptions } from '../types/pdfOptions';

export interface RequestPdfOptions {
  format: string;
  landscape: boolean;
  margin: { top: string; right: string; bottom: string; left: string };
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  printBackground: boolean;
  css?: string;
}

const WRAP_STYLE =
  'font-size:9px;width:100%;padding:0 20mm;color:#666;display:flex;justify-content:center';

const renderTemplate = (raw: string): string => {
  let out = escapeHtml(raw);
  for (const { token, html } of PLACEHOLDER_TOKENS) {
    out = out.replaceAll(token, html);
  }
  return `<div style="${WRAP_STYLE}">${out}</div>`;
};

export const toRequestOptions = (o: PdfOptions): RequestPdfOptions => {
  // A toggle "on" with an empty/whitespace template is treated as off — the
  // user opted in but never typed anything, so there's nothing to show.
  const headerHtml =
    o.header.enabled && o.header.template.trim()
      ? renderTemplate(o.header.template)
      : '';
  const footerHtml =
    o.footer.enabled && o.footer.template.trim()
      ? renderTemplate(o.footer.template)
      : '';
  return {
    format: o.format,
    landscape: o.landscape,
    margin: {
      top:    `${o.margins.top}mm`,
      right:  `${o.margins.right}mm`,
      bottom: `${o.margins.bottom}mm`,
      left:   `${o.margins.left}mm`,
    },
    displayHeaderFooter: Boolean(headerHtml || footerHtml),
    headerTemplate: headerHtml,
    footerTemplate: footerHtml,
    printBackground: o.printBackground,
    ...(o.css.trim() ? { css: o.css } : {}),
  };
};
