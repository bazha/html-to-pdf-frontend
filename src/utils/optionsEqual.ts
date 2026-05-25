import type { PdfOptions } from '../types/pdfOptions';

export const optionsEqual = (a: PdfOptions, b: PdfOptions): boolean =>
  a.format === b.format &&
  a.landscape === b.landscape &&
  a.marginPreset === b.marginPreset &&
  a.margins.top === b.margins.top &&
  a.margins.right === b.margins.right &&
  a.margins.bottom === b.margins.bottom &&
  a.margins.left === b.margins.left &&
  a.header.enabled === b.header.enabled &&
  a.header.template === b.header.template &&
  a.footer.enabled === b.footer.enabled &&
  a.footer.template === b.footer.template &&
  a.printBackground === b.printBackground &&
  a.css === b.css;

// Compile-time check: if a field is added to PdfOptions, this `satisfies`
// fails until the new key is added to this list AND compared above.
const _checkedKeys = {
  format: true,
  landscape: true,
  marginPreset: true,
  margins: true,
  header: true,
  footer: true,
  printBackground: true,
  css: true,
} satisfies Record<keyof PdfOptions, true>;
void _checkedKeys;
