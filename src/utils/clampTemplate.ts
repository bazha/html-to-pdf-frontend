import {HEADER_TEMPLATE_MAX_LENGTH} from '../types/pdfOptions'

export const clampTemplate = (s: string): string => s.slice(0, HEADER_TEMPLATE_MAX_LENGTH)
