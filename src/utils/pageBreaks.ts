const PAGE_BREAK_DIV =
    '<div class="pdf-page-break" style="break-before: page; page-break-before: always;"></div>'

const PAGE_BREAK_RE = /<!--\s*page-break\s*-->/gi

export const transformPageBreaks = (s: string): string => s.replace(PAGE_BREAK_RE, PAGE_BREAK_DIV)
