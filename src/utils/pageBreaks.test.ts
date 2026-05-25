import {describe, it, expect} from 'vitest'
import {transformPageBreaks} from './pageBreaks'
import {sanitizeHtml} from './renderMarkdown'

describe('transformPageBreaks', () => {
    it('returns empty string unchanged', () => {
        expect(transformPageBreaks('')).toBe('')
    })

    it('returns text with no comment unchanged', () => {
        expect(transformPageBreaks('hello world')).toBe('hello world')
    })

    it('replaces the canonical comment with a styled div', () => {
        const out = transformPageBreaks('<!-- page-break -->')
        expect(out).toContain('class="pdf-page-break"')
        expect(out).toContain('break-before: page')
        expect(out).toContain('page-break-before: always')
    })

    it('replaces every occurrence across multiple lines', () => {
        const input = 'a\n<!-- page-break -->\nb\n<!-- page-break -->\nc'
        const out = transformPageBreaks(input)
        const matches = out.match(/class="pdf-page-break"/g) ?? []
        expect(matches.length).toBe(2)
    })

    it('tolerates extra whitespace and mixed case', () => {
        expect(transformPageBreaks('<!--   page-break   -->')).toContain('class="pdf-page-break"')
        expect(transformPageBreaks('<!-- PAGE-BREAK -->')).toContain('class="pdf-page-break"')
    })

    it('leaves unrelated HTML comments alone', () => {
        const out = transformPageBreaks('<!-- not a page break -->')
        expect(out).toBe('<!-- not a page break -->')
    })

    it('the produced div survives DOMPurify sanitization', () => {
        const dirty = transformPageBreaks('<!-- page-break -->')
        const clean = sanitizeHtml(dirty)
        expect(clean).toContain('pdf-page-break')
        expect(clean).toContain('break-before: page')
    })
})
