import type {Margins, PageFormat} from '../types/pdfOptions'

export const PAGE_DIMENSIONS_MM: Record<PageFormat, {w: number; h: number}> = {
    A4: {w: 210, h: 297},
    Letter: {w: 215.9, h: 279.4},
    Legal: {w: 215.9, h: 355.6},
    A3: {w: 297, h: 420},
    A5: {w: 148, h: 210},
}

export const pageDimensionsMm = (
    format: PageFormat,
    landscape: boolean,
): {w: number; h: number} => {
    const base = PAGE_DIMENSIONS_MM[format]
    return landscape ? {w: base.h, h: base.w} : {w: base.w, h: base.h}
}

export const pageContentAreaMm = (
    format: PageFormat,
    landscape: boolean,
    margins: Margins,
): {w: number; h: number} => {
    const {w, h} = pageDimensionsMm(format, landscape)
    return {
        w: Math.max(0, w - margins.left - margins.right),
        h: Math.max(0, h - margins.top - margins.bottom),
    }
}