# Live PDF Preview — Design

**Status:** ready for implementation plan
**Date:** 2026-05-25
**Branch (intended):** `feat/live-preview`

## Problem

PDF options (page format, orientation, margins, header/footer templates, custom CSS) currently produce no visible feedback until the user submits and downloads the PDF. A user typing in the Header template field, toggling margins, or pasting custom CSS sees no change in the Preview tab. The disconnect makes options hard to discover, hard to verify, and easy to mis-configure.

## Goal

Make every PDF setting produce immediate visual feedback in the Preview pane: page shape, margins, repeating header/footer per page, and the user's custom CSS — all live, debounced to keystrokes and option changes.

## Non-goals

- True paged-media fidelity (paged.js or similar). The preview is faux-paginated, not the actual print rendering.
- Running headers that reflect current section (e.g. current H1). Backend supports it via Chromium element queries; preview doesn't.
- First-page-different header / cover page.
- Print-CSS-only rules in user CSS taking effect in preview (`@media print`, `@page`).
- Locale-aware overrides for `{date}` substitution beyond `toLocaleDateString()`.

## Approach

The existing preview iframe (sandbox=`""`) gets upgraded to `sandbox="allow-scripts"`. The composer that produces the iframe `srcDoc` (currently inline in `Preview.tsx`) moves into a pure utility, `buildPreviewSrcDoc`, that produces an HTML document containing:

- Base preview styles + user's `options.css` (concatenated last to win the cascade).
- Page metrics (mm dimensions, margins) on `<html data-*>` attributes for in-iframe pickup.
- Header/footer template strings inside a `<script type="application/json">` blob.
- The (already-transformed, already-sanitized) body inside `<div class="preview-page-area">`.
- A measurement script (also from the composer) that runs on `DOMContentLoaded` and on `ResizeObserver` ticks.

The script measures rendered content height, computes page count from `format/orientation/margins`, and positions absolutely-placed `.preview-header`, `.preview-footer`, and `.preview-page-boundary` overlays at the right vertical offsets — substituting `{pageNumber}`, `{totalPages}`, and `{date}` per page.

Editor state is unchanged. Options pipe through `Preview` as a new prop; every option change triggers the existing 150 ms preview debounce.

## Architecture

```
App.tsx
  └─ Preview content={content} detectedType={...} options={pdfOptions.options}   ← +new prop
        ├─ utils/transformPageBreaks (unchanged)
        ├─ renderMarkdownToHtml / sanitizeHtml (unchanged)
        ├─ utils/pageMetrics (new — pure dimension math)
        ├─ utils/previewSrcDoc (new — composes iframe HTML; embeds measurement script)
        └─ iframe sandbox="allow-scripts" srcDoc={doc}
```

Inside the iframe, on `DOMContentLoaded`:

```
measurement script:
  ├─ read page-size & margins from <html data-* attrs>
  ├─ measure scrollHeight of .preview-page-area
  ├─ pages = max(1, min(200, ceil(scrollH / pageContentH_Px)))
  ├─ for i in 0..pages-1:
  │     ├─ position .preview-header at slotTop = i * pageHeightPx
  │     ├─ position .preview-footer at slotTop + pageHeightPx - footerH
  │     ├─ substitute {pageNumber}=i+1, {totalPages}=pages, {date}=today
  │     └─ inject dashed .preview-page-boundary at slotTop + pageHeightPx
  └─ ResizeObserver(.preview-page-area, rAF-coalesced re-compute)
```

## Components

### New

**`src/utils/pageMetrics.ts`** — pure math.

```ts
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
): {w: number; h: number}

export const pageContentAreaMm = (
  format: PageFormat,
  landscape: boolean,
  margins: Margins,
): {w: number; h: number}
```

No DOM, no React. ~20 LOC plus a test file.

**`src/utils/previewSrcDoc.ts`** — pure composition.

```ts
interface BuildInput {
  body: string                    // already transformPageBreaks'd + sanitized
  options: PdfOptions
  date?: string                   // {date} value; defaults to new Date().toLocaleDateString()
}
export const buildPreviewSrcDoc = (input: BuildInput): string
export const substituteTemplate = (template: string, values: Record<string, string>): string
```

Responsibilities:

1. Compute page metrics via `pageMetrics`.
2. Compose the HTML document:
   - `<style>` containing base `PREVIEW_STYLES` (moved here from `Preview.tsx`) plus page-shape rules plus `options.css` last.
   - `<html data-page-w-mm data-page-h-mm data-margin-{t,r,b,l}-mm data-has-header data-has-footer>`.
   - `<script id="preview-templates" type="application/json">{"header": "...", "footer": "...", "date": "..."}</script>` — JSON, not HTML; safe to parse.
   - `<body class="preview-doc"><div class="preview-page-area">{body}</div></body>`.
   - `<script>` containing the measurement logic (template-literal string in this file).

The measurement script uses `innerHTML` only on user-template HTML (after string-substituting placeholders with escaped values). User content in the body has already been sanitized; the iframe is sandboxed (no same-origin) so even if escape were skipped, XSS is contained.

**`src/utils/pageMetrics.test.ts`**, **`src/utils/previewSrcDoc.test.ts`** — unit tests; see Testing.

### Modified

**`src/components/Preview.tsx`** — slim glue, ~25 LOC after changes:

```tsx
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

Sandbox changes from `""` to `"allow-scripts"`. The big `PREVIEW_STYLES` constant moves to `previewSrcDoc.ts`. New `options` prop.

**`src/App.tsx`** — one-line change: `<Preview ... options={pdfOptions.options} />`.

### Not touched

- `src/api/optionsMapper.ts` — keep `renderTemplate` (the Chromium-span variant) as-is. Preview's substitution is a different concern.
- `src/types/pdfOptions.ts`, `src/hooks/usePdfOptions.ts` — unchanged.

## Data flow

**User edits content**

```
textarea onChange → App.setContent
  ↓
Preview useEffect debounce (150 ms)
  ↓
transformPageBreaks → markdown/html render → buildPreviewSrcDoc
  ↓
iframe srcDoc updated → measurement script runs → chrome positioned
```

**User changes a PDF option** (new path)

```
OptionsBar control onChange → pdf.set(...)
  ↓
App re-renders → Preview receives new `options` prop
  ↓
(same pipeline from debounce onward)
```

**Iframe lifecycle**

```
1. browser parses new srcDoc
2. DOMContentLoaded → measurement script runs
3. read <html data-*>, parse #preview-templates JSON
4. measure .preview-page-area.scrollHeight
5. compute pages = max(1, min(MAX_PAGES, ceil(h / contentH_Px)))
6. for each page: position header / footer / boundary; substitute placeholders
7. install ResizeObserver for async layout (image / font load)
```

**Substitution rules in the iframe script**

- Each substitute value (`pageNumber`, `totalPages`, `date`, `title`, `url`) HTML-escaped via small inline helper.
- Template HTML (user-controlled) inserted via `innerHTML` after substitution so user formatting (`<b>Page</b> {pageNumber}`) renders.
- Iframe sandbox contains any XSS to opaque origin (no parent access).

**Custom CSS ordering in `<style>`**

```css
{PREVIEW_STYLES}              /* base: page background, .preview-page, chrome positioning */
{PAGE_SHAPE_RULES}            /* per-format aspect ratio */
{options.css}                 /* user's CSS — last; wins cascade */
```

User can override `.preview-header` or hide chrome by writing rules; that's allowed.

**Submit path unchanged.** Preview is read-only.

## Sandbox & security

`sandbox="allow-scripts"` — no `allow-same-origin`, no `allow-popups`, no `allow-top-navigation`, no `allow-forms`. Iframe scripts run in an opaque origin and cannot:

- Access `window.parent` or the parent DOM.
- Navigate the top window.
- Open popups or new tabs.
- Submit forms.
- Make same-origin requests.

What they can do: run JS, read their own DOM, install observers. Sufficient for measurement.

DOMPurify already sanitizes user content before it enters the iframe. The measurement script's source is fixed and authored by us.

## Error handling & edge cases

| Case                                      | Behavior                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Empty content                             | `scrollHeight = 0` → 1 empty page with chrome.                                         |
| Content exceeds 200 pages                 | Cap at 200; render a "preview truncated · 200+ pages" chip. Submit path unaffected.    |
| All-zero margins                          | Content fills page; chrome overlaps edges. User's choice.                              |
| Margins ≥ page height (`contentH_Px ≤ 0`) | Cap pages at 1; render a "margins exceed page height" chip. Avoids infinite-page math. |
| Header enabled with empty template        | Render empty header div (matches submit).                                              |
| Custom CSS empty                          | No extra rules.                                                                        |
| Custom CSS invalid syntax                 | Browser ignores invalid rules; iframe unaffected.                                      |
| Custom CSS `@import url(external)`        | Blocked by sandbox (no allow-same-origin).                                             |
| Custom CSS `body { display: none }`       | Content invisible; chrome still shows. User can fix.                                   |
| Format change mid-edit                    | Debounced rebuild picks up new dimensions.                                             |
| Async image load reshapes content         | `ResizeObserver` recomputes chrome positions (rAF-coalesced).                          |

## Preview-vs-PDF divergences (documented)

- Web fonts: preview loads Google Fonts via existing `@import`. Backend Puppeteer may differ; minor visual deltas possible.
- Running headers reflecting current section — backend Chromium supports, preview doesn't.
- `@media print` and `@page` rules in user CSS — apply during real PDF, ignored in preview.
- First-page-different header — backend supports via `:first` page selector, preview shows all pages identically.

## Testing

### Layer 1 — pure utilities (~22 tests)

`pageMetrics.test.ts` (~10):

- All 5 formats portrait: A4, Letter, Legal, A3, A5.
- Landscape swaps w/h.
- `pageContentAreaMm` default + zero margins + asymmetric margins.

`previewSrcDoc.test.ts` (~12):

- DOCTYPE present.
- `<html data-page-w-mm>` matches input format.
- Landscape swaps the dims in attrs.
- All four margin data attrs match input.
- Base `PREVIEW_STYLES` present (substring check).
- `options.css` appears AFTER base rules.
- Empty `options.css` produces no extra content.
- `#preview-templates` script tag exists, parses as JSON, has `{header, footer, date}`.
- Header disabled → JSON `header = ""`.
- Header template with `{pageNumber}` preserved verbatim in JSON (substitution is runtime).
- Body content inside `<div class="preview-page-area">` verbatim.
- `substituteTemplate` helper: replaces tokens; escapes injected values.

### Layer 2 — `Preview.tsx` (1 new test)

```ts
it('rebuilds srcDoc when options change')
```

Renders the component, advances fake timers, asserts iframe `srcDoc` substring before and after option change.

### Layer 3 — `App.test.tsx` (~3 new tests)

```ts
it('changing header template updates iframe srcDoc')
it('changing format updates iframe srcDoc page dimensions')
it('changing custom CSS injects it into iframe srcDoc style block')
```

All read the iframe's `srcDoc` attribute (a string in jsdom) and substring-check.

### Layer 4 — manual smoke (not automated)

The in-iframe script's DOM behavior can't be auto-tested (jsdom doesn't run iframe scripts). Pre-merge checklist:

- Each format × orientation: page aspect ratio looks right.
- Header text appears at top of each page slot; `{pageNumber}` substitutes 1, 2, 3...; `{totalPages}` matches.
- Footer at bottom; substitutions correct.
- Custom CSS visibly applies (e.g. `body { color: red }`).
- Margin changes resize the content area.
- Page boundary lines (dashed) appear at page splits.
- Long content scrolls and shows multiple pages.
- Insert a large image; chrome re-positions after it loads.
- Toggle Header off → header overlays disappear; boundaries remain.

### Risk

The Layer-2 automated gap (no in-iframe script test) is mitigated by: (a) factoring pure logic into `pageMetrics` and `previewSrcDoc` (heavily tested), (b) the iframe script is small and reviewable, (c) the manual checklist runs pre-merge.

## File summary

| File                              | Action | LOC est.                              |
| --------------------------------- | ------ | ------------------------------------- |
| `src/utils/pageMetrics.ts`        | new    | ~25                                   |
| `src/utils/pageMetrics.test.ts`   | new    | ~40                                   |
| `src/utils/previewSrcDoc.ts`      | new    | ~180 (incl. embedded script & styles) |
| `src/utils/previewSrcDoc.test.ts` | new    | ~80                                   |
| `src/components/Preview.tsx`      | modify | -65/+20 (composer extracted out)      |
| `src/App.tsx`                     | modify | +1/-1                                 |
| `src/App.test.tsx`                | modify | +50                                   |

## Out of scope (deferred)

- True paged-media polyfill (paged.js or similar) for cross-page break behavior, widows/orphans.
- Running headers reflecting document section.
- First-page-different header.
- Footer height auto-detection.
- Locale override for `{date}` format.
- Visual regression / screenshot diffs.
