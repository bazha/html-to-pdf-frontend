import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('escapes the five html-special characters', () => {
    expect(escapeHtml(`<>"'&`)).toBe('&lt;&gt;&quot;&#39;&amp;');
  });
  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
  it('leaves curly braces untouched so placeholder tokens survive', () => {
    expect(escapeHtml('{pageNumber}/{totalPages}')).toBe('{pageNumber}/{totalPages}');
  });
  it('escapes a <script> tag attempt to inert text', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });
});
