# Page Break Controls — Design

**Status:** ready for implementation plan
**Date:** 2026-05-25
**Branch (intended):** `feat/page-break-controls`

## Problem

Users producing multi-section PDFs (reports, articles with appendices, etc.) need explicit control over where pages split. Chromium honors `break-before: page` in print CSS, but users editing Markdown or pasted HTML have no ergonomic way to express that intent and no way to see where breaks will land before submission.

## Goal

Add a discoverable, keyboard-friendly way to insert a page break, render the break visibly in the Preview pane, and ensure the produced PDF actually splits there. Zero backend changes.

## Non-goals

- Auto-break before headings (deferred; a different toggle in OptionsBar if ever requested).
- A WYSIWYG editor or rich-text replacement for the current textarea.
- Code-block-aware transformation (don't skip the regex inside fenced code blocks).
- Server-side page break handling — Chromium already does what we need given the right CSS.

## Approach

A pure frontend transform of a literal HTML comment into a CSS-page-break `<div>`. The transform runs at two seams (Preview render, submit) and nowhere else. Editor state remains exactly what the user typed.

Editor gains a dedicated thin toolbar above the textarea; its only initial action is "Insert page break," but the surface is structured to accept more editor actions later without redesign.

### Directive

Canonical form (what the toolbar inserts):
```
<!-- page-break -->
```

Transform output:
```html
<div class="pdf-page-break" style="break-before: page; page-break-before: always;"></div>
```

- The `class` hook is for the preview iframe's visible divider styling.
- The inline `style` is what survives DOMPurify, the wire, and Chromium's print-media pass on the backend.
- Detection regex: `/<!--\s*page-break\s*-->/gi` — whitespace- and case-tolerant. Other HTML comments (`<!-- not this -->`) pass through untouched.

## Architecture

```
EditorToolbar.tsx (new)        Editor.tsx (modified)
  └─ "Insert page break"  →    inserts '<!-- page-break -->' at cursor
                                via existing onChange callback

App.tsx                                    (no change in shape)
  ├─ Editor (now with EditorToolbar above)
  └─ Preview content={content}             (unchanged props)
        ├─ utils/pageBreaks.ts             (new — pure transform)
        ├─ utils/renderMarkdown.ts         (unchanged)
        └─ sandboxed iframe with PREVIEW_STYLES + new .pdf-page-break CSS

useSubmit.ts → api/optionsMapper.ts:
        ├─ pageBreaks.transformPageBreaks(content)   (new step)
        └─ (existing) escape, mapper, fetch
```

## Components

### New

**`src/utils/pageBreaks.ts`** — single named export `transformPageBreaks(s: string): string`. ~10 LOC. Pure function. Uses the regex above; replaces every match with the canonical div.

**`src/utils/pageBreaks.test.ts`** — 7 cases (see Testing).

**`src/components/EditorToolbar.tsx`** — receives one prop `onInsertPageBreak: () => void`. Renders a `role="toolbar"` flex row, `aria-label="Editor actions"`, with one button. Designed so future actions slot in without re-architecture.

### Modified

**`src/components/Editor.tsx`** — holds a `useRef<HTMLTextAreaElement>`. Renders `<EditorToolbar onInsertPageBreak={insertAtCursor} />` above the existing textarea. `insertAtCursor` reads selection start/end from the ref, builds the new value, calls `props.onChange(value)`, and uses `requestAnimationFrame` to restore caret position after React reconciles. This mirrors the existing pattern in `PlaceholderChips` / `HeaderFooterControl`.

**`src/hooks/useSubmit.ts`** — one-line change: `submitContent(transformPageBreaks(content), ...)` at the call site.

**`src/components/Preview.tsx`** — call `transformPageBreaks(content)` before the markdown/sanitize branch. Add `.pdf-page-break` rules to `PREVIEW_STYLES`:

```css
.pdf-page-break {
  border-top: 1px dashed #b5e368;
  margin: 22px 0 0;
  padding-top: 4px;
  text-align: center;
  font-size: 11px;
  color: #888;
}
.pdf-page-break::after { content: 'page break'; }
@media print {
  .pdf-page-break { border: 0; padding: 0; margin: 0; }
  .pdf-page-break::after { content: ''; }
}
```

**`src/theme.css`** — add `.editor-toolbar` row styles. Match the visual language of the existing tab-row and OptionsBar header (thin row, subdued background, focus-visible ring on buttons).

### Not touched

- `src/api/optionsMapper.ts` — content is not an option. Stays focused on `PdfOptions → RequestPdfOptions`.
- `src/api/pdfClient.ts` — boundary stays pure; sends what it's given.
- `src/App.tsx` — wiring already passes `content` and `onChange` to Editor; no structural change.

## Data flow

**Editing**
```
textarea onChange → Editor.props.onChange → App.setContent
                                            (raw text with the literal comment)
```
Source of truth is the raw user-typed text. The comment is never auto-rewritten in editor state.

**Insert via toolbar**
```
EditorToolbar onClick
  → Editor.insertAtCursor('<!-- page-break -->')
      ├─ value = before + comment + after  (from ref selection)
      ├─ props.onChange(value)
      └─ rAF: setSelectionRange(start + comment.length)
```

**Preview**
```
content prop → debounce 150 ms
  → transformPageBreaks(content)            ← seam #1
  → markdown ? renderMarkdownToHtml : sanitizeHtml   (both go through DOMPurify)
  → wrap in HTML doc with PREVIEW_STYLES (incl. .pdf-page-break)
  → iframe srcDoc
```

**Submit**
```
App.handleSubmit
  → useSubmit.submit(content, options, onSuccess)
      └─ submitContent(
             transformPageBreaks(content),  ← seam #2
             undefined,
             toRequestOptions(options),
         )
  → POST /pdf  body: { content: transformed, options: {...} }
```

Two seams instead of one upstream so that editor state remains exactly what the user typed (preserves invariant for any future find/replace, diff, or save-draft feature).

## Sanitization

The transform's output (`<div class="pdf-page-break" style="break-before: page;...">`) must survive DOMPurify. Current `PURIFY_OPTIONS` in `src/utils/renderMarkdown.ts` forbids `script/style/iframe/object/embed/form` tags and `onerror/onload/onclick` attributes. `<div>` and `style` attribute are allowed by default; the page-break div survives. Verified by Layer-1 test #7.

If a future PR tightens `PURIFY_OPTIONS` and accidentally strips the marker, test #7 fails loudly.

## Error handling & edge cases

| Case | Behavior |
|---|---|
| Empty content | Transform returns empty; existing MIN=10 gate handles submit. |
| Only a page break comment as content | Length 21 > MIN; passes submit. Produces a degenerate PDF. Acceptable. |
| Insert pushes content over MAX | Existing warn badge fires; submit gated by `lengthValid`. No new gating. |
| `textarea` ref null at click time | `insertAtCursor` early-returns; button is a no-op. |
| Multiple rapid clicks | Multiple comments inserted in sequence. No debouncing. |
| Literal comment inside Markdown fenced code block | Transform fires; the "code" actually becomes a real page break. Documented as a known limitation — toolbar path can't hit this. |
| User's custom CSS targets `.pdf-page-break` | Allowed; user override of preview divider is fine. Inline `break-before: page` still wins specificity in print media. |
| Sandbox iframe restrictions | No change. Inline `style` is permitted; class hook is permitted. |

## Accessibility

- `EditorToolbar` — `role="toolbar"`, `aria-label="Editor actions"`.
- Button — accessible name "Insert page break"; visible `:focus-visible` ring matching existing controls.
- Preview divider — decorative; no semantic markup for screen readers.

## Testing

### Layer 1 — pure transform (`pageBreaks.test.ts`, 7 cases)

| # | Input | Expected |
|---|---|---|
| 1 | `''` | `''` |
| 2 | `'hello'` | unchanged |
| 3 | `'<!-- page-break -->'` | output contains `class="pdf-page-break"` AND `break-before: page` |
| 4 | three breaks across lines | three divs |
| 5 | `'<!--   page-break   -->'` and `'<!-- PAGE-BREAK -->'` | both match |
| 6 | `'<!-- not a page break -->'` | unchanged |
| 7 | `sanitizeHtml(transformPageBreaks(...))` | divs survive with class and style intact |

### Layer 2 — integration (additions to `App.test.tsx`, 2 cases)

```ts
it('inserts <!-- page-break --> at cursor when toolbar button clicked');
it('sends transformed content (with page-break div) in the submit body');
```
The second test uses MSW to capture the POST body (existing pattern from the `options.format` test).

### Layer 3 — manual

- Multi-section doc with breaks → real PDF splits at each marker (cannot automate without backend).
- Toolbar focus ring + keyboard activation.
- Preview pane shows dashed divider labeled "page break".

### Expected delta

- Test count: 82 → ~91.
- New test files: 1.
- Modified test files: 1.

## Out of scope (deferred to future work, if any)

- Keyboard shortcut for the insert (e.g. `Ctrl+Shift+P`). Doable cheaply but not in v1.
- Auto-break-before-H1 OptionsBar toggle.
- Code-block-aware transform.
- Toolbar growth (insert link, insert image) — surface is ready, content deferred.

## File summary

| File | Action | LOC est. |
|---|---|---|
| `src/utils/pageBreaks.ts` | new | ~10 |
| `src/utils/pageBreaks.test.ts` | new | ~50 |
| `src/components/EditorToolbar.tsx` | new | ~25 |
| `src/components/Editor.tsx` | modify | +30/-2 |
| `src/components/Preview.tsx` | modify | +25/-2 |
| `src/hooks/useSubmit.ts` | modify | +2/-1 |
| `src/theme.css` | modify | +30 |
| `src/App.test.tsx` | modify | +40 |
