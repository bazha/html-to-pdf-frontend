import { describe, it, expect } from 'vitest';
import { summarize } from './summarize';
import { DEFAULTS, type PdfOptions } from '../types/pdfOptions';

describe('summarize', () => {
  it('returns "Defaults" when all options match defaults', () => {
    expect(summarize(DEFAULTS)).toBe('Defaults');
  });

  it('renders format change', () => {
    expect(summarize({ ...DEFAULTS, format: 'Letter' })).toContain('Letter');
  });

  it('renders orientation change', () => {
    expect(summarize({ ...DEFAULTS, landscape: true })).toContain('Landscape');
  });

  it('renders margin preset change', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      marginPreset: 'wide',
      margins: { top: 30, right: 30, bottom: 30, left: 30 },
    };
    expect(summarize(o)).toContain('Wide margins');
  });

  it('flags custom CSS', () => {
    expect(summarize({ ...DEFAULTS, css: 'h1{color:red}' })).toContain('Custom CSS');
  });

  it('flags an enabled footer', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      footer: { enabled: true, template: '{pageNumber}' },
    };
    expect(summarize(o)).toContain('Footer');
  });

  it('joins multiple deviations with " · "', () => {
    const o: PdfOptions = { ...DEFAULTS, format: 'Letter', landscape: true };
    expect(summarize(o)).toBe('Letter · Landscape');
  });
});
