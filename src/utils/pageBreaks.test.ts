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
        expect(transformPageBreaks('<!--   page-break   -->')).toContain(
            'class="pdf-page-break"',
        )
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

    // Additional edge-case and regression tests

    it('preserves surrounding text around replaced markers', () => {
        const out = transformPageBreaks('intro\n<!-- page-break -->\nconclusion')
        expect(out).toContain('intro')
        expect(out).toContain('conclusion')
        expect(out).toContain('class="pdf-page-break"')
    })

    it('handles three or more consecutive breaks', () => {
        const input = '<!-- page-break --><!-- page-break --><!-- page-break -->'
        const out = transformPageBreaks(input)
        const matches = out.match(/class="pdf-page-break"/g) ?? []
        expect(matches.length).toBe(3)
    })

    it('does not match partial or malformed page-break comments', () => {
        expect(transformPageBreaks('<!-- pagebreak -->')).toBe('<!-- pagebreak -->')
        expect(transformPageBreaks('<!-- page break -->')).toBe('<!-- page break -->')
        expect(transformPageBreaks('<!-- page-break')).toBe('<!-- page-break')
    })

    it('produces a self-closing div with no inner content', () => {
        const out = transformPageBreaks('<!-- page-break -->')
        // The div should be empty between opening and closing tags
        expect(out).toMatch(/class="pdf-page-break"[^>]*><\/div>/)
    })

    it('handles tab whitespace inside comment', () => {
        // Tabs count as whitespace in the regex \s*
        expect(transformPageBreaks('<!--\tpage-break\t-->')).toContain('class="pdf-page-break"')
    })

    it('returns non-page-break HTML intact alongside transformed markers', () => {
        const input = '<p>Hello</p><!-- page-break --><p>World</p>'
        const out = transformPageBreaks(input)
        expect(out).toContain('<p>Hello</p>')
        expect(out).toContain('<p>World</p>')
        expect(out).toContain('class="pdf-page-break"')
    })

    it('does not replace comment immediately adjacent to other HTML without extra spaces', () => {
        // No whitespace around the comment — should still be replaced
        const out = transformPageBreaks('<p>A</p><!-- page-break --><p>B</p>')
        expect(out).toContain('class="pdf-page-break"')
        expect(out).toContain('<p>A</p>')
        expect(out).toContain('<p>B</p>')
    })
})