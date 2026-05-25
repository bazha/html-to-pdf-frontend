import { describe, it, expect } from 'vitest';
import { optionsEqual } from './optionsEqual';
import { DEFAULTS } from '../types/pdfOptions';

describe('optionsEqual', () => {
  it('returns true for DEFAULTS vs DEFAULTS', () => {
    expect(optionsEqual(DEFAULTS, DEFAULTS)).toBe(true);
  });

  it('returns true for structural copy of DEFAULTS', () => {
    expect(optionsEqual({ ...DEFAULTS, margins: { ...DEFAULTS.margins } }, DEFAULTS))
      .toBe(true);
  });

  it('detects top-level scalar difference', () => {
    expect(optionsEqual({ ...DEFAULTS, format: 'Letter' }, DEFAULTS)).toBe(false);
  });

  it('detects nested margin difference', () => {
    expect(
      optionsEqual({ ...DEFAULTS, margins: { ...DEFAULTS.margins, top: 21 } }, DEFAULTS),
    ).toBe(false);
  });

  it('detects nested header difference', () => {
    expect(
      optionsEqual(
        { ...DEFAULTS, header: { enabled: true, template: '' } },
        DEFAULTS,
      ),
    ).toBe(false);
  });
});
