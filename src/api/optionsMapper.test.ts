import { describe, it, expect } from 'vitest';
import { renderTemplate } from './optionsMapper';

describe('renderTemplate', () => {
  it('wraps plain text in the styled div', () => {
    const out = renderTemplate('Press');
    expect(out).toContain('Press');
    expect(out.startsWith('<div style="')).toBe(true);
  });

  it('substitutes {pageNumber} → span.pageNumber', () => {
    expect(renderTemplate('{pageNumber}')).toContain('<span class="pageNumber"></span>');
  });

  it('substitutes all five known placeholders', () => {
    const out = renderTemplate('{pageNumber}|{totalPages}|{date}|{title}|{url}');
    expect(out).toContain('<span class="pageNumber"></span>');
    expect(out).toContain('<span class="totalPages"></span>');
    expect(out).toContain('<span class="date"></span>');
    expect(out).toContain('<span class="title"></span>');
    expect(out).toContain('<span class="url"></span>');
  });

  it('escapes html in raw text before substitution', () => {
    const out = renderTemplate('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('passes unknown placeholder through as literal text', () => {
    const out = renderTemplate('hello {author}');
    expect(out).toContain('hello {author}');
    expect(out).not.toContain('<span class="author"></span>');
  });
});
