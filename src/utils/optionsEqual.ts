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
