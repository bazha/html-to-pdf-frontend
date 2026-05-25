import {DEFAULTS, type PdfOptions} from '../types/pdfOptions'

const PRESET_LABEL: Record<PdfOptions['marginPreset'], string> = {
    normal: 'Normal margins',
    narrow: 'Narrow margins',
    wide: 'Wide margins',
    none: 'No margins',
    custom: 'Custom margins',
}

export const summarize = (o: PdfOptions): string => {
    const parts: string[] = []
    if (o.format !== DEFAULTS.format) parts.push(o.format)
    if (o.landscape !== DEFAULTS.landscape) parts.push(o.landscape ? 'Landscape' : 'Portrait')
    if (o.marginPreset !== DEFAULTS.marginPreset) parts.push(PRESET_LABEL[o.marginPreset])
    if (o.header.enabled) parts.push('Header')
    if (o.footer.enabled) parts.push('Footer')
    if (o.css.trim() !== '') parts.push('Custom CSS')
    if (o.printBackground !== DEFAULTS.printBackground) parts.push('BG off')
    return parts.length === 0 ? 'Defaults' : parts.join(' · ')
}
