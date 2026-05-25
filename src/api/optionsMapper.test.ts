import { describe, it, expect } from 'vitest';
import { toRequestOptions } from './optionsMapper';
import { DEFAULTS, type PdfOptions } from '../types/pdfOptions';

const renderHeader = (template: string): string =>
  toRequestOptions({
    ...DEFAULTS,
    header: { enabled: true, template },
  }).headerTemplate;

describe('header/footer template rendering', () => {
  it('wraps plain text in the styled div', () => {
    const out = renderHeader('Press');
    expect(out).toContain('Press');
    expect(out.startsWith('<div style="')).toBe(true);
  });

  it('substitutes {pageNumber} → span.pageNumber', () => {
    expect(renderHeader('{pageNumber}')).toContain('<span class="pageNumber"></span>');
  });

  it('substitutes all five known placeholders', () => {
    const out = renderHeader('{pageNumber}|{totalPages}|{date}|{title}|{url}');
    expect(out).toContain('<span class="pageNumber"></span>');
    expect(out).toContain('<span class="totalPages"></span>');
    expect(out).toContain('<span class="date"></span>');
    expect(out).toContain('<span class="title"></span>');
    expect(out).toContain('<span class="url"></span>');
  });

  it('escapes html in raw text before substitution', () => {
    const out = renderHeader('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('passes unknown placeholder through as literal text', () => {
    const out = renderHeader('hello {author}');
    expect(out).toContain('hello {author}');
    expect(out).not.toContain('<span class="author"></span>');
  });
});

describe('toRequestOptions', () => {
  it('converts margin numerics to mm-suffixed strings', () => {
    const req = toRequestOptions({
      ...DEFAULTS,
      margins: { top: 25, right: 15, bottom: 25, left: 15 },
    });
    expect(req.margin).toEqual({
      top: '25mm', right: '15mm', bottom: '25mm', left: '15mm',
    });
  });

  it('passes format and landscape straight through', () => {
    const req = toRequestOptions({ ...DEFAULTS, format: 'Letter', landscape: true });
    expect(req.format).toBe('Letter');
    expect(req.landscape).toBe(true);
  });

  it('suppresses header/footer when both disabled', () => {
    const req = toRequestOptions(DEFAULTS);
    expect(req.displayHeaderFooter).toBe(false);
    expect(req.headerTemplate).toBe('');
    expect(req.footerTemplate).toBe('');
  });

  it('renders only the enabled side', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      header: { enabled: true, template: 'Top' },
      footer: { enabled: false, template: 'ignored' },
    };
    const req = toRequestOptions(o);
    expect(req.displayHeaderFooter).toBe(true);
    expect(req.headerTemplate).toContain('Top');
    expect(req.footerTemplate).toBe('');
  });

  it('treats enabled-but-empty-template as off', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      header: { enabled: true, template: '   ' },
    };
    const req = toRequestOptions(o);
    expect(req.displayHeaderFooter).toBe(false);
    expect(req.headerTemplate).toBe('');
  });

  it('omits css when blank, includes when set', () => {
    expect(toRequestOptions(DEFAULTS).css).toBeUndefined();
    expect(toRequestOptions({ ...DEFAULTS, css: '   ' }).css).toBeUndefined();
    expect(toRequestOptions({ ...DEFAULTS, css: 'h1{color:red}' }).css).toBe('h1{color:red}');
  });
});
