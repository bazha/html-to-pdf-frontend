# Live PDF Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every PDF option (format, orientation, margins, header/footer templates, custom CSS) produce immediate visual feedback in the Preview pane — faux-paginated page chrome rendered live inside the existing sandboxed iframe.

**Architecture:** Loosen iframe `sandbox=""` to `"allow-scripts"`. A pure utility `buildPreviewSrcDoc` composes the iframe HTML from content + options. The doc embeds a measurement script that, on load and on `ResizeObserver` ticks, computes page count from format/margins, places absolutely-positioned `.preview-header` / `.preview-footer` / `.preview-page-boundary` overlays per page, and substitutes `{pageNumber}` / `{totalPages}` / `{date}` placeholders. Editor state and the submit path are unchanged.

**Tech Stack:** React 19 · TypeScript · Vitest 4 + @testing-library/react · MSW · DOMPurify. No new dependencies. Code style: Prettier (4-space, no semicolons, no bracket spacing, single quotes).

---

## File structure

**Create**

- `src/utils/pageMetrics.ts` — pure dimension math (formats × orientation × margins → mm).
- `src/utils/pageMetrics.test.ts` — ~10 unit tests.
- `src/utils/previewSrcDoc.ts` — composes the iframe HTML; contains `PREVIEW_STYLES`, `substituteTemplate`, and the embedded measurement script string.
- `src/utils/previewSrcDoc.test.ts` — ~14 unit tests via `DOMParser`.
- `src/components/Preview.test.tsx` — focused test that option changes drive the srcDoc rebuild.

**Modify**

- `src/components/Preview.tsx` — slim to ~25 LOC; calls `buildPreviewSrcDoc`; accepts new `options` prop; sandbox → `"allow-scripts"`. `PREVIEW_STYLES` removed (moved to `previewSrcDoc.ts`).
- `src/App.tsx` — pass `options={pdfOptions.options}` to `<Preview>`.
- `src/App.test.tsx` — 3 new integration tests via iframe `srcDoc` substring checks.

**Branch:** create `feat/live-preview` off `feat/page-break-controls` (page-break is a prereq; its `transformPageBreaks` is part of the new Preview pipeline). When PR #2 (page-break) merges to `main`, GitHub auto-rebases this PR's base to `main`.

**Pre-commit gate (CLAUDE.md):** `npm run lint`, `npm test`, `npm run format:check` all green before any commit.

---

## Task 0: Create feature branch

**Files:** none.

- [ ] **Step 1: Create and switch**

```bash
git checkout feat/page-break-controls
git pull origin feat/page-break-controls
git checkout -b feat/live-preview
```

Expected: switched to a new branch.

- [ ] **Step 2: Verify clean tree and green baseline**

```bash
git status                # clean
npx vitest run            # 91 passed
npx tsc -b                # no output
npx eslint src/           # no output
npx prettier --check .    # all matched files use Prettier code style
```

---

## Task 1: `pageMetrics` utility (TDD)

**Files:**

- Create: `src/utils/pageMetrics.ts`
- Test: `src/utils/pageMetrics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/pageMetrics.test.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {PAGE_DIMENSIONS_MM, pageDimensionsMm, pageContentAreaMm} from './pageMetrics'

describe('PAGE_DIMENSIONS_MM', () => {
  it('exposes ISO and US sizes in millimetres', () => {
    expect(PAGE_DIMENSIONS_MM.A4).toEqual({w: 210, h: 297})
    expect(PAGE_DIMENSIONS_MM.A3).toEqual({w: 297, h: 420})
    expect(PAGE_DIMENSIONS_MM.A5).toEqual({w: 148, h: 210})
    expect(PAGE_DIMENSIONS_MM.Letter).toEqual({w: 215.9, h: 279.4})
    expect(PAGE_DIMENSIONS_MM.Legal).toEqual({w: 215.9, h: 355.6})
  })
})

describe('pageDimensionsMm', () => {
  it('returns portrait dimensions when landscape is false', () => {
    expect(pageDimensionsMm('A4', false)).toEqual({w: 210, h: 297})
  })

  it('swaps width and height for landscape', () => {
    expect(pageDimensionsMm('A4', true)).toEqual({w: 297, h: 210})
    expect(pageDimensionsMm('Letter', true)).toEqual({w: 279.4, h: 215.9})
  })
})

describe('pageContentAreaMm', () => {
  const M20 = {top: 20, right: 20, bottom: 20, left: 20}

  it('subtracts default margins from A4', () => {
    expect(pageContentAreaMm('A4', false, M20)).toEqual({w: 170, h: 257})
  })

  it('returns full page when margins are zero', () => {
    const zero = {top: 0, right: 0, bottom: 0, left: 0}
    expect(pageContentAreaMm('A4', false, zero)).toEqual({w: 210, h: 297})
  })

  it('handles asymmetric margins', () => {
    const m = {top: 10, right: 15, bottom: 20, left: 25}
    expect(pageContentAreaMm('A4', false, m)).toEqual({w: 170, h: 267})
  })

  it('clamps negative content area to zero when margins exceed page', () => {
    const huge = {top: 200, right: 200, bottom: 200, left: 200}
    expect(pageContentAreaMm('A4', false, huge)).toEqual({w: 0, h: 0})
  })

  it('applies margins after landscape swap', () => {
    expect(pageContentAreaMm('A4', true, M20)).toEqual({w: 257, h: 170})
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/pageMetrics.test.ts
```

Expected: FAIL with `Cannot find module './pageMetrics'`.

- [ ] **Step 3: Implement the utility**

Create `src/utils/pageMetrics.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/pageMetrics.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Verify the gate**

```bash
npx tsc -b
npx eslint src/utils/pageMetrics.ts src/utils/pageMetrics.test.ts
npx prettier --check src/utils/pageMetrics.ts src/utils/pageMetrics.test.ts
```

All clean. If prettier fails, run `npx prettier --write` on those files.

- [ ] **Step 6: Commit**

```bash
git add src/utils/pageMetrics.ts src/utils/pageMetrics.test.ts
git commit -m "feat(utils): add pageMetrics for PDF page dimension math"
```

---

## Task 2: `previewSrcDoc` composer + measurement script

This is the biggest task. It creates the pure composer that produces the iframe HTML, including the in-iframe measurement script as a template-literal string.

**Files:**

- Create: `src/utils/previewSrcDoc.ts`
- Test: `src/utils/previewSrcDoc.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/previewSrcDoc.test.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {buildPreviewSrcDoc, substituteTemplate} from './previewSrcDoc'
import {DEFAULTS, type PdfOptions} from '../types/pdfOptions'

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

const opts = (overrides: Partial<PdfOptions> = {}): PdfOptions => ({...DEFAULTS, ...overrides})

describe('buildPreviewSrcDoc', () => {
  it('starts with a doctype', () => {
    expect(buildPreviewSrcDoc({body: '', options: opts()}).startsWith('<!doctype html>')).toBe(true)
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
    const doc = parse(buildPreviewSrcDoc({body: '', options: opts({css: 'body { color: red }'})}))
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/previewSrcDoc.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/previewSrcDoc.ts`**

Create `src/utils/previewSrcDoc.ts` with this exact content:

```ts
import {pageDimensionsMm} from './pageMetrics'
import {type PdfOptions} from '../types/pdfOptions'

const MAX_PAGES = 200

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
        height: 8mm;
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
                f.style.top = slotTop + pageHpx - 30 + 'px';
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
            chip.textContent = 'preview truncated · 200+ pages';
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
    options.css +
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/previewSrcDoc.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Verify the gate**

```bash
npx tsc -b
npx eslint src/utils/previewSrcDoc.ts src/utils/previewSrcDoc.test.ts
npx prettier --check src/utils/previewSrcDoc.ts src/utils/previewSrcDoc.test.ts
```

All clean. If prettier rewrites the file, re-run tests to confirm still green.

- [ ] **Step 6: Commit**

```bash
git add src/utils/previewSrcDoc.ts src/utils/previewSrcDoc.test.ts
git commit -m "feat(utils): add previewSrcDoc composer with in-iframe measurement script"
```

---

## Task 3: Wire `Preview.tsx` to use `buildPreviewSrcDoc` and accept `options` prop

**Files:**

- Modify: `src/components/Preview.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/Preview.test.tsx`

The `Preview.tsx` rewrite is substantial: most of the file (the `PREVIEW_STYLES` constant, the inline srcDoc string assembly) moves out. The new version is small.

- [ ] **Step 1: Replace `src/components/Preview.tsx` with this exact content**

```tsx
import {useEffect, useState} from 'react'
import {renderMarkdownToHtml, sanitizeHtml} from '../utils/renderMarkdown'
import {transformPageBreaks} from '../utils/pageBreaks'
import {buildPreviewSrcDoc} from '../utils/previewSrcDoc'
import type {ContentType} from '../utils/detectType'
import type {PdfOptions} from '../types/pdfOptions'

interface Props {
  content: string
  detectedType: ContentType
  options: PdfOptions
}

const DEBOUNCE_MS = 150

export const Preview = ({content, detectedType, options}: Props) => {
  const [srcDoc, setSrcDoc] = useState('')
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const transformed = transformPageBreaks(content)
      const body =
        detectedType === 'markdown' ? renderMarkdownToHtml(transformed) : sanitizeHtml(transformed)
      setSrcDoc(buildPreviewSrcDoc({body, options}))
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [content, detectedType, options])
  return (
    <iframe title="preview" className="preview-frame" sandbox="allow-scripts" srcDoc={srcDoc} />
  )
}
```

- [ ] **Step 2: Pass `options` from `App.tsx`**

In `src/App.tsx`, locate the line:

```tsx
<Preview content={content} detectedType={detectedType} />
```

Change to:

```tsx
<Preview content={content} detectedType={detectedType} options={pdfOptions.options} />
```

- [ ] **Step 3: Write the focused Preview component test**

Create `src/components/Preview.test.tsx`:

```tsx
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {render} from '@testing-library/react'
import {act} from 'react'
import {Preview} from './Preview'
import {DEFAULTS, type PdfOptions} from '../types/pdfOptions'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const opts = (overrides: Partial<PdfOptions> = {}): PdfOptions => ({...DEFAULTS, ...overrides})

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('Preview', () => {
  it('renders an iframe with sandbox="allow-scripts"', () => {
    render(<Preview content="" detectedType="html" options={opts()} />)
    const iframe = document.querySelector('iframe') as HTMLIFrameElement
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('rebuilds srcDoc when options change', () => {
    const {rerender} = render(
      <Preview content="hello" detectedType="html" options={opts({format: 'A4'})} />,
    )
    advance(200)
    const before = (document.querySelector('iframe') as HTMLIFrameElement).srcdoc
    expect(before).toContain('data-page-w-mm="210"')

    rerender(<Preview content="hello" detectedType="html" options={opts({format: 'Letter'})} />)
    advance(200)
    const after = (document.querySelector('iframe') as HTMLIFrameElement).srcdoc
    expect(after).toContain('data-page-w-mm="215.9"')
  })

  it('debounces — does not update srcDoc before 150 ms', () => {
    render(<Preview content="hello" detectedType="html" options={opts()} />)
    advance(100)
    const iframe = document.querySelector('iframe') as HTMLIFrameElement
    expect(iframe.srcdoc).toBe('')
  })
})
```

- [ ] **Step 4: Run the full suite**

```bash
npx vitest run
```

Expected: all prior tests still pass (91 from main + 7 from Task 1 + 17 from Task 2 + 3 new = ~118). The existing `App.test.tsx` integration tests including drag-drop, submit→poll, and the page-break tests must remain green.

- [ ] **Step 5: Verify the gate**

```bash
npx tsc -b
npx eslint src/components/Preview.tsx src/components/Preview.test.tsx src/App.tsx
npx prettier --check src/components/Preview.tsx src/components/Preview.test.tsx src/App.tsx
```

All clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Preview.tsx src/components/Preview.test.tsx src/App.tsx
git commit -m "feat(ui): wire Preview to live-options srcDoc; loosen sandbox to allow-scripts"
```

---

## Task 4: Integration tests in `App.test.tsx`

Add three new tests proving that user actions on the OptionsBar produce visible changes in the iframe's `srcDoc` (which jsdom can read as a string without running scripts).

**Files:**

- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add the three test cases**

In `src/App.test.tsx`, find the existing `describe('App full flow', () => {...})` block. After the last existing `it(...)` block, before the closing `})` of the describe, append:

```ts
it('changing format updates iframe srcDoc page dimensions', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Expand the options bar
    await user.click(screen.getByRole('button', {name: /options/i}))
    // Change format to Letter
    const formatSelect = screen.getByLabelText(/page format/i) as HTMLSelectElement
    await user.selectOptions(formatSelect, 'Letter')
    // Switch to preview
    await user.click(screen.getByRole('tab', {name: /preview/i}))
    await waitFor(
        () => {
            const iframe = document.querySelector('iframe') as HTMLIFrameElement
            expect(iframe.srcdoc).toContain('data-page-w-mm="215.9"')
        },
        {timeout: 1000},
    )
})

it('changing header template updates iframe srcDoc templates blob', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', {name: /options/i}))
    // Toggle header on
    await user.click(screen.getByRole('switch', {name: /header enabled/i}))
    // Type into header template input
    const headerInput = screen.getByLabelText(/header template/i) as HTMLInputElement
    await user.type(headerInput, 'Hello {pageNumber}')
    // Switch to preview
    await user.click(screen.getByRole('tab', {name: /preview/i}))
    await waitFor(
        () => {
            const iframe = document.querySelector('iframe') as HTMLIFrameElement
            expect(iframe.srcdoc).toContain('Hello {pageNumber}')
            expect(iframe.srcdoc).toContain('data-has-header="true"')
        },
        {timeout: 1000},
    )
})

it('changing custom CSS injects it into iframe srcDoc style block', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', {name: /options/i}))
    // Expand the CSS pane
    await user.click(screen.getByRole('button', {name: /add stylesheet/i}))
    const cssArea = screen.getByLabelText(/custom css/i) as HTMLTextAreaElement
    await user.type(cssArea, 'h1 { color: tomato }')
    await user.click(screen.getByRole('tab', {name: /preview/i}))
    await waitFor(
        () => {
            const iframe = document.querySelector('iframe') as HTMLIFrameElement
            expect(iframe.srcdoc).toContain('h1 { color: tomato }')
        },
        {timeout: 1000},
    )
})
```

- [ ] **Step 2: Run the full suite**

```bash
npx vitest run
```

Expected: 121 / 121 (or thereabouts) pass. The three new tests use the existing MSW setup and React Testing Library helpers already imported in `App.test.tsx`.

If any test fails because the labels don't match what the controls actually expose (e.g. the OptionsBar header toggle's `aria-label` differs from `/header enabled/i`), inspect the actual labels by reading `src/components/OptionsBar/HeaderFooterControl.tsx` and `src/components/OptionsBar/CustomCssControl.tsx` and update the queries to match.

- [ ] **Step 3: Verify the gate**

```bash
npx tsc -b
npx eslint src/App.test.tsx
npx prettier --check src/App.test.tsx
```

All clean.

- [ ] **Step 4: Commit**

```bash
git add src/App.test.tsx
git commit -m "test(app): cover live-preview reflection of format, header, and CSS changes"
```

---

## Task 5: Final verification and PR

- [ ] **Step 1: Full gate sweep**

```bash
npm run lint
npm test
npm run format:check
npm run build
```

All four green. Build emits a `dist/` without errors.

- [ ] **Step 2: Manual smoke in the dev server**

```bash
npm run dev
```

Open `http://localhost:5173/`. Verify each item:

- The Preview tab shows a white page-shaped rectangle with the document content inside.
- Type a few headings in the editor, switch to Preview; the page resizes vertically as more content arrives.
- Expand Options, change Format to Letter, then to Legal. The page rectangle's aspect ratio updates.
- Toggle Landscape on. The rectangle rotates (wider than tall).
- Toggle Header on, type `Page {pageNumber} of {totalPages}`. After ~150 ms, header bars appear at the top of each page slot with substituted numbers.
- Toggle Footer on, type `Generated {date}`. Footer bars appear at the bottom of each page slot with today's date.
- Drag a margin slider; visible whitespace inside the page shrinks/grows.
- Expand the CSS section, paste `body { color: tomato }`. After debounce, content text turns tomato red.
- Type ~50 paragraphs of lorem ipsum. Page count grows; dashed boundary lines appear between page slots.
- Paste a large image (or insert an `<img>` tag with a slow-loading source). Chrome re-positions after image loads (ResizeObserver path).
- Toggle Header off; header bars disappear; boundaries remain.
- Hit Reset in OptionsBar; everything returns to defaults.

If anything looks broken, fix in the relevant Task's files before pushing.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/live-preview
gh pr create --base feat/page-break-controls --title "Live PDF preview" --body "$(cat <<'EOF'
## Summary
- Make every PDF setting (format, orientation, margins, header/footer templates, custom CSS) produce immediate visual feedback in the Preview pane.
- New `pageMetrics` utility (pure math, 5 page sizes × 2 orientations × margins).
- New `previewSrcDoc` utility composes the iframe HTML and embeds a measurement script.
- Iframe sandbox loosened from `""` to `"allow-scripts"`; remains origin-isolated, no `allow-same-origin`/`allow-popups`/`allow-forms`.
- Preview iframe now reacts to `options` changes (debounced 150 ms, same as content changes).
- Faux-paginated: page rectangles tile vertically; header + footer overlays positioned per page; dashed boundary lines between slots; `{pageNumber}`/`{totalPages}`/`{date}` substituted live.
- Capped at 200 pages with a small "preview truncated" chip beyond that.

## Spec
`docs/superpowers/specs/2026-05-25-live-preview-design.md`

## Plan
`docs/superpowers/plans/2026-05-25-live-preview.md`

## Verification
- [x] `npm run lint` clean
- [x] `npm test` — full suite passes
- [x] `npm run format:check` clean
- [x] `npm run build` clean
- [ ] Manual: format / orientation / margins / header / footer / custom CSS all reflect in preview after ~150 ms debounce
- [ ] Manual: long content paginates with header/footer per slot and dashed boundaries
- [ ] Manual: produced PDF (with backend running) still matches the preview's intent

## Test count delta
- Unit: `pageMetrics.test.ts` (+10), `previewSrcDoc.test.ts` (+17).
- Component: `Preview.test.tsx` (+3).
- Integration: `App.test.tsx` (+3).

## Sandbox / security
Iframe sandbox is `"allow-scripts"` — no `allow-same-origin`, no `allow-popups`, no `allow-forms`, no `allow-top-navigation`. Scripts run in an opaque origin; cannot reach `window.parent`. User content is DOMPurify-sanitized before insertion; template substitution escapes value channels before `innerHTML`.

## Base
Branched from `feat/page-break-controls` because the new Preview pipeline calls `transformPageBreaks`. When PR #2 merges to `main`, this PR's base will rebase to `main` automatically.
EOF
)"
```

- [ ] **Step 4: Done**

The PR URL is returned by `gh pr create`. Squash-merge when ready.

---

## Self-review notes

**Spec coverage (every spec requirement maps to a task):**

- Page-shape simulation (format × orientation) → Task 1 + Task 2 (`pageMetrics` + `previewSrcDoc` data attrs + CSS).
- Margins as visible whitespace → Task 2 CSS vars + measurement script padding read.
- Repeating header / footer per page → Task 2 measurement script overlay placement + substitution.
- Custom CSS applied to preview → Task 2 composer appends `options.css` after base styles.
- Page break visual (from prior feature) → preserved via `transformPageBreaks` call retained in Task 3 Preview.tsx + `.pdf-page-break` rule in PREVIEW_STYLES.
- Reactivity to option changes → Task 3 Preview.tsx adds `options` to effect deps + Task 4 integration tests assert it.
- Sandbox change to `allow-scripts` → Task 3.
- MAX_PAGES=200 cap → Task 2 measurement script.
- ResizeObserver for async layout → Task 2 measurement script.
- Substitution escapes value channel → Task 2 `substituteTemplate` + script.
- `{pageNumber}/{totalPages}/{date}` runtime substitution → Task 2 script.
- `{title}/{url}` empty in preview → Task 2 script ctx defaults.
- Pre-merge manual smoke → Task 5 step 2 (checklist).
- Layer-1 unit tests → Tasks 1, 2.
- Layer-2 component test → Task 3.
- Layer-3 integration tests → Task 4.

**Naming consistency check:**

- `transformPageBreaks` (from prior feature) — referenced once in Task 3 Preview.tsx; not redefined.
- `buildPreviewSrcDoc` — defined Task 2; called Task 3.
- `substituteTemplate` — defined + tested Task 2; mirrored as inline function in measurement script (same algorithm, escaped via `&#NN;` numeric entities for `< > & " '`).
- `MAX_PAGES = 200` — defined once in `previewSrcDoc.ts`, interpolated into the measurement script string at module load.
- CSS class names (`.preview-page`, `.preview-page-area`, `.preview-header`, `.preview-footer`, `.preview-page-boundary`, `.preview-truncated-chip`) — declared once in `PREVIEW_STYLES`, referenced by the measurement script and asserted by `previewSrcDoc.test.ts`.
- data attrs (`data-page-w-mm`, `data-page-h-mm`, `data-margin-{t,r,b,l}-mm`, `data-has-header`, `data-has-footer`) — set in Task 2 composer; read in Task 2 measurement script; asserted in Task 2 tests.

**File-size sanity:**

- `pageMetrics.ts` ≈ 25 LOC.
- `pageMetrics.test.ts` ≈ 55 LOC.
- `previewSrcDoc.ts` ≈ 280 LOC (PREVIEW_STYLES dominates).
- `previewSrcDoc.test.ts` ≈ 130 LOC.
- `Preview.tsx` shrinks from ~120 LOC to ~30.
- `Preview.test.tsx` ≈ 45 LOC.
- `App.tsx` grows by 1 LOC.
- `App.test.tsx` grows by ~70 LOC (3 new tests).

**Out of scope (deferred per spec):**

- True paged-media polyfill (paged.js).
- Running headers reflecting current section.
- First-page-different header.
- Print-CSS-only rules in user CSS taking effect in preview.
- Locale override for `{date}`.

These are deliberately not in the plan. Don't add them.
