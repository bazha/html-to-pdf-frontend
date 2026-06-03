import {pageDimensionsMm} from './pageMetrics'
import {type PdfOptions} from '../types/pdfOptions'

const MAX_PAGES = 200
const HEADER_FOOTER_HEIGHT_MM = 8

const PREVIEW_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wdth,wght@0,75..125,200..900;1,75..125,200..900&family=Fragment+Mono:ital@0;1&display=swap');
    :root { color-scheme: light dark; }
    html, body { margin: 0; }
    html { background: #14171e; }
    @media (prefers-color-scheme: light) { html { background: #eef0f4; } }

    .preview-page {
        width: var(--page-w);
        height: var(--page-h);
        margin: 22px auto;
        background: #ffffff;
        position: relative;
        transform: scale(var(--preview-scale, 1));
        transform-origin: top center;
        box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 18px 40px -22px rgba(0,0,0,.45);
    }
    .preview-page-area {
        width: 100%;
        min-height: 100%;
        padding: var(--margin-t) var(--margin-r) var(--margin-b) var(--margin-l);
        box-sizing: border-box;
        position: relative;
        font: 16px/1.65 'Mona Sans', ui-sans-serif, system-ui, sans-serif;
        font-variation-settings: 'wdth' 100, 'wght' 400;
        color: #14171e;
    }
    .preview-page-area h1, .preview-page-area h2, .preview-page-area h3, .preview-page-area h4 {
        font-family: 'Mona Sans', sans-serif;
        font-variation-settings: 'wdth' 96, 'wght' 660;
        letter-spacing: -.025em;
        line-height: 1.08;
        margin: 0 0 14px;
        color: #0a0b0e;
    }
    .preview-page-area h1 { font-size: 32px; font-variation-settings: 'wdth' 92, 'wght' 720; letter-spacing: -.035em; }
    .preview-page-area h2 { font-size: 24px; font-variation-settings: 'wdth' 94, 'wght' 660; }
    .preview-page-area h3 { font-size: 19px; font-variation-settings: 'wdth' 96, 'wght' 620; }
    .preview-page-area h4 { font-size: 16px; font-variation-settings: 'wdth' 100, 'wght' 620; }
    .preview-page-area p { margin: 0 0 14px; color: #1f242c; }
    .preview-page-area em { font-style: italic; }
    .preview-page-area strong { font-variation-settings: 'wdth' 100, 'wght' 620; font-weight: normal; }
    .preview-page-area blockquote {
        margin: 18px 0;
        padding: 2px 0 2px 16px;
        border-left: 2px solid #b5e368;
        color: #3a414b;
        font-style: italic;
        font-size: 16px;
    }
    .preview-page-area ul, .preview-page-area ol { padding-left: 1.2em; margin: 0 0 14px; color: #1f242c; }
    .preview-page-area li { margin: 0 0 4px; }
    .preview-page-area hr { border: 0; border-top: 1px solid #e7eaf0; margin: 22px 0; }
    .preview-page-area pre, .preview-page-area code {
        font-family: 'Fragment Mono', ui-monospace, monospace;
        background: #f3f5f9;
        color: #14171e;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 13px;
    }
    .preview-page-area pre { padding: 14px 16px; overflow-x: auto; line-height: 1.6; border: 1px solid #e7eaf0; }
    .preview-page-area pre code { background: transparent; padding: 0; }
    .preview-page-area a {
        color: #14171e;
        border-bottom: 1.5px solid #b5e368;
        text-decoration: none;
        padding-bottom: 1px;
    }
    .preview-page-area img { max-width: 100%; height: auto; display: block; margin: 14px 0; border-radius: 4px; }
    .preview-page-area table { border-collapse: collapse; margin: 14px 0; font-size: 14px; width: 100%; }
    .preview-page-area th, .preview-page-area td { padding: 8px 12px; border-bottom: 1px solid #e7eaf0; text-align: left; }
    .preview-page-area th { font-variation-settings: 'wdth' 100, 'wght' 620; font-weight: normal; color: #0a0b0e; }

    .pdf-page-break {
        border-top: 1px dashed #b5e368;
        margin: 22px 0 0;
        padding-top: 4px;
        text-align: center;
        font-size: 11px;
        color: #888;
        letter-spacing: 0.04em;
    }
    .pdf-page-break::after { content: 'page break'; }
    @media print {
        .pdf-page-break { border: 0; padding: 0; margin: 0; }
        .pdf-page-break::after { content: ''; }
    }

    .preview-header, .preview-footer {
        position: absolute;
        left: 0;
        right: 0;
        height: ${HEADER_FOOTER_HEIGHT_MM}mm;
        font-size: 9px;
        color: #666;
        padding: 0 var(--margin-r) 0 var(--margin-l);
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }
    .preview-page-boundary {
        position: absolute;
        left: 0;
        right: 0;
        height: 0;
        border-top: 1px dashed rgba(0,0,0,.18);
        pointer-events: none;
    }
    .preview-truncated-chip {
        position: fixed;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,.06);
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 10px;
        color: #666;
        z-index: 10;
    }
`

export const substituteTemplate = (
    template: string,
    values: Record<string, string | number>,
): string => {
    const escape = (s: string): string => s.replace(/[<>&"']/g, (c) => '&#' + c.charCodeAt(0) + ';')
    let out = template
    for (const [key, value] of Object.entries(values)) {
        out = out.split('{' + key + '}').join(escape(String(value)))
    }
    return out
}

const MEASUREMENT_SCRIPT = `
(function () {
    var MAX_PAGES = ${MAX_PAGES};
    var MM_PER_PX = 3.7795275591;

    function escapeHtml(s) {
        return String(s).replace(/[<>&"']/g, function (c) {
            return '&#' + c.charCodeAt(0) + ';';
        });
    }
    function substituteTemplate(template, values) {
        var out = template;
        for (var k in values) {
            if (Object.prototype.hasOwnProperty.call(values, k)) {
                out = out.split('{' + k + '}').join(escapeHtml(values[k]));
            }
        }
        return out;
    }
    function compute() {
        var html = document.documentElement;
        var pageWmm = parseFloat(html.dataset.pageWMm);
        var pageHmm = parseFloat(html.dataset.pageHMm);
        var mT = parseFloat(html.dataset.marginTMm);
        var mB = parseFloat(html.dataset.marginBMm);
        var hasHeader = html.dataset.hasHeader === 'true';
        var hasFooter = html.dataset.hasFooter === 'true';
        var tmplBlob = document.getElementById('preview-templates');
        if (!tmplBlob) return;
        var tmpl = JSON.parse(tmplBlob.textContent || '{}');

        var page = document.querySelector('.preview-page');
        var area = document.querySelector('.preview-page-area');
        if (!page || !area) return;

        var pageWpx = pageWmm * MM_PER_PX;
        var bodyWpx = document.body.clientWidth || pageWpx;
        var scale = Math.min(1, Math.max(0.3, (bodyWpx - 44) / pageWpx));
        html.style.setProperty('--preview-scale', String(scale));

        var pageHpx = pageHmm * MM_PER_PX;
        var contentHpx = Math.max(1, pageHpx - (mT + mB) * MM_PER_PX);

        var scrollH = area.scrollHeight;
        var truncated = false;
        var pages = Math.max(1, Math.ceil(scrollH / contentHpx));
        if (pages > MAX_PAGES) {
            pages = MAX_PAGES;
            truncated = true;
        }

        page.style.height = pages * pageHpx + 'px';

        var prev = document.querySelectorAll(
            '.preview-header,.preview-footer,.preview-page-boundary,.preview-truncated-chip',
        );
        for (var p = 0; p < prev.length; p++) prev[p].parentNode.removeChild(prev[p]);

        for (var i = 0; i < pages; i++) {
            var slotTop = i * pageHpx;
            var ctx = {
                pageNumber: i + 1,
                totalPages: pages,
                date: tmpl.date || '',
                title: '',
                url: '',
            };
            if (hasHeader) {
                var h = document.createElement('div');
                h.className = 'preview-header';
                h.style.top = slotTop + 'px';
                h.innerHTML = substituteTemplate(tmpl.header || '', ctx);
                page.appendChild(h);
            }
            if (hasFooter) {
                var f = document.createElement('div');
                f.className = 'preview-footer';
                f.style.top = slotTop + pageHpx - ${HEADER_FOOTER_HEIGHT_MM} * MM_PER_PX + 'px';
                f.innerHTML = substituteTemplate(tmpl.footer || '', ctx);
                page.appendChild(f);
            }
            if (i < pages - 1) {
                var b = document.createElement('div');
                b.className = 'preview-page-boundary';
                b.style.top = slotTop + pageHpx + 'px';
                page.appendChild(b);
            }
        }

        if (truncated) {
            var chip = document.createElement('div');
            chip.className = 'preview-truncated-chip';
            chip.textContent = 'preview truncated · ' + MAX_PAGES + '+ pages';
            document.body.appendChild(chip);
        }
    }

    var rafId = null;
    function schedule() {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(function () {
            rafId = null;
            compute();
        });
    }

    function init() {
        schedule();
        if (typeof ResizeObserver !== 'undefined') {
            var area = document.querySelector('.preview-page-area');
            if (area) new ResizeObserver(schedule).observe(area);
            if (document.body) new ResizeObserver(schedule).observe(document.body);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
`

interface BuildInput {
    body: string
    options: PdfOptions
    date?: string
}

const safeJson = (value: unknown): string =>
    JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

const safeCss = (css: string): string => css.replace(/<\/style/gi, '<\\/style')

export const buildPreviewSrcDoc = ({body, options, date}: BuildInput): string => {
    const {w, h} = pageDimensionsMm(options.format, options.landscape)
    const m = options.margins
    const dateStr = date ?? new Date().toLocaleDateString()

    const headerActive = options.header.enabled && options.header.template.trim() !== ''
    const footerActive = options.footer.enabled && options.footer.template.trim() !== ''

    const templates = {
        header: options.header.enabled ? options.header.template : '',
        footer: options.footer.enabled ? options.footer.template : '',
        date: dateStr,
    }

    const htmlAttrs =
        'data-page-w-mm="' +
        w +
        '" data-page-h-mm="' +
        h +
        '" data-margin-t-mm="' +
        m.top +
        '" data-margin-r-mm="' +
        m.right +
        '" data-margin-b-mm="' +
        m.bottom +
        '" data-margin-l-mm="' +
        m.left +
        '" data-has-header="' +
        String(headerActive) +
        '" data-has-footer="' +
        String(footerActive) +
        '" style="--page-w: ' +
        w +
        'mm; --page-h: ' +
        h +
        'mm; --margin-t: ' +
        m.top +
        'mm; --margin-r: ' +
        m.right +
        'mm; --margin-b: ' +
        m.bottom +
        'mm; --margin-l: ' +
        m.left +
        'mm;"'

    return (
        '<!doctype html>' +
        '<html ' +
        htmlAttrs +
        '><head><meta charset="utf-8">' +
        '<style>' +
        PREVIEW_STYLES +
        '\n' +
        safeCss(options.css) +
        '</style>' +
        '<script id="preview-templates" type="application/json">' +
        safeJson(templates) +
        '</script>' +
        '</head><body class="preview-doc">' +
        '<div class="preview-page"><div class="preview-page-area">' +
        body +
        '</div></div>' +
        '<script>' +
        MEASUREMENT_SCRIPT +
        '</script>' +
        '</body></html>'
    )
}
