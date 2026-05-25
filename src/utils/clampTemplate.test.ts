import { describe, it, expect } from 'vitest';
import { clampTemplate } from './clampTemplate';
import { HEADER_TEMPLATE_MAX_LENGTH } from '../types/pdfOptions';

describe('clampTemplate', () => {
  it('passes short strings through unchanged', () => {
    expect(clampTemplate('hello')).toBe('hello');
  });

  it('truncates to HEADER_TEMPLATE_MAX_LENGTH', () => {
    const long = 'x'.repeat(HEADER_TEMPLATE_MAX_LENGTH + 50);
    expect(clampTemplate(long).length).toBe(HEADER_TEMPLATE_MAX_LENGTH);
  });

  it('returns empty string for empty input', () => {
    expect(clampTemplate('')).toBe('');
  });
});
