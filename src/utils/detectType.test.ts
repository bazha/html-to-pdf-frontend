import { describe, it, expect } from 'vitest';
import { detectType } from './detectType';

describe('detectType', () => {
  it('classifies plain HTML as html', () => {
    expect(detectType('<h1>Hi</h1>')).toBe('html');
  });

  it('classifies headings as markdown', () => {
    expect(detectType('# Title\n\nParagraph')).toBe('markdown');
  });

  it('classifies bullet lists as markdown', () => {
    expect(detectType('* item 1\n* item 2')).toBe('markdown');
  });

  it('classifies bold inline as markdown', () => {
    expect(detectType('This is **bold**')).toBe('markdown');
  });

  it('classifies code fences as markdown', () => {
    expect(detectType('```js\nconsole.log(1)\n```')).toBe('markdown');
  });

  it('classifies plain prose as html (no markdown markers)', () => {
    expect(detectType('Just plain prose with no markup at all.')).toBe('html');
  });

  it('treats leading-< as html even if markdown appears later', () => {
    expect(detectType('<p>start</p>\n\n# heading')).toBe('html');
  });
});
