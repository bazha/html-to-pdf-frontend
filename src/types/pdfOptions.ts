export type PageFormat = 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';
export type MarginPreset = 'normal' | 'narrow' | 'wide' | 'none' | 'custom';

export interface Margins {
  top: number;     // millimetres
  right: number;
  bottom: number;
  left: number;
}

export interface PdfOptions {
  format: PageFormat;
  landscape: boolean;
  marginPreset: MarginPreset;
  margins: Margins;
  header: { enabled: boolean; template: string };
  footer: { enabled: boolean; template: string };
  printBackground: boolean;
  css: string;
}

export const DEFAULTS: PdfOptions = {
  format: 'A4',
  landscape: false,
  marginPreset: 'normal',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: { enabled: false, template: '' },
  footer: { enabled: false, template: '{pageNumber} / {totalPages}' },
  printBackground: true,
  css: '',
};

export const MARGIN_PRESETS: Record<Exclude<MarginPreset, 'custom'>, Margins> = {
  normal: { top: 20, right: 20, bottom: 20, left: 20 },
  narrow: { top: 10, right: 10, bottom: 10, left: 10 },
  wide:   { top: 30, right: 30, bottom: 30, left: 30 },
  none:   { top: 0,  right: 0,  bottom: 0,  left: 0 },
};

export const CSS_MAX_LENGTH = 5000;
export const HEADER_TEMPLATE_MAX_LENGTH = 200;
