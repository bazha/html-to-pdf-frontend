import { escapeHtml } from '../utils/escapeHtml';

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

const PLACEHOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['{pageNumber}', '<span class="pageNumber"></span>'],
  ['{totalPages}', '<span class="totalPages"></span>'],
  ['{date}',       '<span class="date"></span>'],
  ['{title}',      '<span class="title"></span>'],
  ['{url}',        '<span class="url"></span>'],
];

export const renderTemplate = (raw: string): string => {
  let out = escapeHtml(raw);
  for (const [token, span] of PLACEHOLDERS) {
    out = out.replaceAll(token, span);
  }
  return `<div style="${WRAP_STYLE}">${out}</div>`;
};

// toRequestOptions added in next task — keeps this commit focused.
