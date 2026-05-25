import {describe, it, expect} from 'vitest'
import {buildPreviewSrcDoc, substituteTemplate} from './previewSrcDoc'
import {DEFAULTS, type PdfOptions} from '../types/pdfOptions'

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

const opts = (overrides: Partial<PdfOptions> = {}): PdfOptions => ({...DEFAULTS, ...overrides})

describe('buildPreviewSrcDoc', () => {
    it('starts with a doctype', () => {
        expect(buildPreviewSrcDoc({body: '', options: opts()}).startsWith('<!doctype html>')).toBe(
            true,
        )
    })

    it('emits page dimensions as data attributes on <html>', () => {
        const doc = parse(buildPreviewSrcDoc({body: '', options: opts()}))
        expect(doc.documentElement.dataset.pageWMm).toBe('210')
        expect(doc.documentElement.dataset.pageHMm).toBe('297')
    })

    it('swaps dimensions in landscape mode', () => {
        const doc = parse(buildPreviewSrcDoc({body: '', options: opts({landscape: true})}))
        expect(doc.documentElement.dataset.pageWMm).toBe('297')
        expect(doc.documentElement.dataset.pageHMm).toBe('210')
    })

    it('emits margin data attributes from options', () => {
        const doc = parse(
            buildPreviewSrcDoc({
                body: '',
                options: opts({margins: {top: 10, right: 15, bottom: 20, left: 25}}),
            }),
        )
        expect(doc.documentElement.dataset.marginTMm).toBe('10')
        expect(doc.documentElement.dataset.marginRMm).toBe('15')
        expect(doc.documentElement.dataset.marginBMm).toBe('20')
        expect(doc.documentElement.dataset.marginLMm).toBe('25')
    })

    it('sets CSS custom properties on <html> for page-size and margins', () => {
        const doc = parse(buildPreviewSrcDoc({body: '', options: opts()}))
        const style = doc.documentElement.getAttribute('style') ?? ''
        expect(style).toContain('--page-w: 210mm')
        expect(style).toContain('--page-h: 297mm')
        expect(style).toContain('--margin-t: 20mm')
    })

    it('emits has-header / has-footer flags reflecting toggle AND non-empty template', () => {
        const enabled = opts({
            header: {enabled: true, template: 'Top'},
            footer: {enabled: true, template: ''},
        })
        const doc = parse(buildPreviewSrcDoc({body: '', options: enabled}))
        expect(doc.documentElement.dataset.hasHeader).toBe('true')
        expect(doc.documentElement.dataset.hasFooter).toBe('false')
    })

    it('includes base preview styles', () => {
        const doc = parse(buildPreviewSrcDoc({body: '', options: opts()}))
        const styleText = doc.querySelector('style')?.textContent ?? ''
        expect(styleText).toContain('.preview-page')
        expect(styleText).toContain('.preview-header')
        expect(styleText).toContain('.preview-page-boundary')
    })

    it('appends user CSS after base styles so cascade favors user', () => {
        const doc = parse(
            buildPreviewSrcDoc({body: '', options: opts({css: 'body { color: red }'})}),
        )
        const styleText = doc.querySelector('style')?.textContent ?? ''
        const baseIdx = styleText.indexOf('.preview-page')
        const userIdx = styleText.indexOf('body { color: red }')
        expect(userIdx).toBeGreaterThan(baseIdx)
    })

    it('emits a JSON templates blob with header, footer, and date', () => {
        const o = opts({
            header: {enabled: true, template: 'Hdr {pageNumber}'},
            footer: {enabled: true, template: 'Page {pageNumber}/{totalPages}'},
        })
        const doc = parse(buildPreviewSrcDoc({body: '', options: o, date: '2026-05-25'}))
        const blob = doc.getElementById('preview-templates')
        expect(blob?.getAttribute('type')).toBe('application/json')
        const data = JSON.parse(blob?.textContent ?? '{}')
        expect(data.header).toBe('Hdr {pageNumber}')
        expect(data.footer).toBe('Page {pageNumber}/{totalPages}')
        expect(data.date).toBe('2026-05-25')
    })

    it('passes empty strings for disabled header/footer templates', () => {
        const doc = parse(buildPreviewSrcDoc({body: '', options: opts()}))
        const data = JSON.parse(doc.getElementById('preview-templates')?.textContent ?? '{}')
        expect(data.header).toBe('')
        expect(data.footer).toBe('')
    })

    it('escapes < and > inside the templates JSON blob to neutralise </script> injection', () => {
        const malicious = opts({
            header: {enabled: true, template: '</script><script>x</script>'},
        })
        const html = buildPreviewSrcDoc({body: '', options: malicious})
        expect(html).not.toContain('</script><script>x')
    })

    it('neutralises </style> injection in options.css', () => {
        const css = '</style><script>alert(1)</script><style>'
        const html = buildPreviewSrcDoc({body: '', options: opts({css})})
        // Original </style> must not appear inside the style block path
        expect(html).not.toContain('</style><script>')
    })

    it('wraps body in .preview-page > .preview-page-area', () => {
        const doc = parse(buildPreviewSrcDoc({body: '<p>hello</p>', options: opts()}))
        const area = doc.querySelector('.preview-page > .preview-page-area')
        expect(area?.innerHTML).toContain('<p>hello</p>')
    })

    it('uses options.css verbatim (already capped by CSS_MAX_LENGTH at the input layer)', () => {
        const css = 'h1 { color: tomato }'
        const doc = parse(buildPreviewSrcDoc({body: '', options: opts({css})}))
        expect(doc.querySelector('style')?.textContent ?? '').toContain(css)
    })

    it('embeds a measurement script (presence check only)', () => {
        const doc = parse(buildPreviewSrcDoc({body: '', options: opts()}))
        const scripts = Array.from(doc.querySelectorAll('script')).filter(
            (s) => s.getAttribute('type') !== 'application/json',
        )
        expect(scripts.length).toBeGreaterThanOrEqual(1)
        expect(scripts[0].textContent).toContain('ResizeObserver')
        expect(scripts[0].textContent).toContain('preview-templates')
    })
})

describe('substituteTemplate', () => {
    it('substitutes a single token', () => {
        expect(substituteTemplate('Page {pageNumber}', {pageNumber: 3})).toBe('Page 3')
    })

    it('substitutes multiple tokens', () => {
        expect(
            substituteTemplate('Page {pageNumber} of {totalPages}', {
                pageNumber: 2,
                totalPages: 5,
            }),
        ).toBe('Page 2 of 5')
    })

    it('escapes HTML in substituted values', () => {
        expect(substituteTemplate('Title: {title}', {title: '<script>x</script>'})).toBe(
            'Title: &#60;script&#62;x&#60;/script&#62;',
        )
    })

    it('leaves template HTML intact', () => {
        expect(substituteTemplate('<b>{pageNumber}</b>', {pageNumber: 1})).toBe('<b>1</b>')
    })

    it('leaves unknown tokens alone', () => {
        expect(substituteTemplate('Hello {unknown}', {pageNumber: 1})).toBe('Hello {unknown}')
    })
})
