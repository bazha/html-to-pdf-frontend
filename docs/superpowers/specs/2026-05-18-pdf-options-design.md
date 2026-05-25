# PDF Output Options — Design Spec

**Date:** 2026-05-18
**Status:** Draft, awaiting user review
**Scope:** Frontend (this repo). Assumes backend already accepts a puppeteer-style options object on `POST /pdf`; that assumption is flagged and must be verified before implementation.

## 1. Goal

Promote the service from a one-shot "paste content, get default PDF" tool into a real document-generation surface for power users. Add four output controls — page format/orientation, margins, headers/footers, and a custom-CSS escape hatch — surfaced through a single inline panel that stays calm by default and unfolds on demand.

## 2. Non-goals

- Named option presets (save/load profiles). Defaults persist; that is enough for v1.
- Per-tab / per-document option scopes. Settings are global per browser profile.
- Live re-render of the preview on option change. Submit-driven only, matching the current model.
- Side-by-side editor + preview. Separate concern, not bundled here.
- Server-side validation of custom CSS. Pass-through; the backend's existing error path surfaces problems.

## 3. UI

### 3.1 Placement and composition

A collapsible bar lives between the existing `.tab-row` and `.surface`. Five staggered entry animations now (was four): masthead 0, tab-row 90ms, options 130ms, surface 220ms, actions 300ms, hint 380ms.

### 3.2 Collapsed state

A single ~36px row showing a summary line and an expand caret:

```
◇ Options   A4 · Portrait · Normal margins · No header     ▾
```

- `◇` indicator is a 4×4px dot. Gray when all options equal defaults; lime when any option deviates. Gives a glance read of "am I on stock settings."
- Summary text comes from a pure `summarize(options)` formatter. Defaults-only renders as `"Defaults"`; otherwise a `·`-joined list of the non-default values.
- The whole row is a button with `role="button"`, `aria-expanded`, keyboard activation via Enter/Space.

### 3.3 Expanded state

Four control groups stacked vertically, ~280px tall total. Reset button (with inline confirm) lives in the expanded header.

```
┌─ Options ──────────────────────────────────  Reset  ▴ ─┐
│                                                          │
│ Format    [ A4         ▾ ]    ◯ Portrait  ● Landscape  │
│                                                          │
│ Margins   [Normal]  Narrow  Wide  None  Custom          │
│           ┌──┐ T ┌──┐ R ┌──┐ B ┌──┐ L     mm            │
│           │20│   │20│   │20│   │20│                     │
│           └──┘   └──┘   └──┘   └──┘                     │
│                                                          │
│ Header    ○ off                                          │
│ Footer    ● on   [ {pageNumber} / {totalPages}      ]   │
│                  hint: {pageNumber} {totalPages} {date}  │
│                                                          │
│ Custom CSS  ▸ add stylesheet                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Motion

The bar uses the `grid-template-rows: 0fr → 1fr` trick for smooth expansion without `height: auto` jank. ~240ms with the existing `--ease` curve. Expand-caret rotates 180°.

## 4. State and persistence

### 4.1 Types (new module `src/types/pdfOptions.ts`)

```ts
export type PageFormat = 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5'
export type MarginPreset = 'normal' | 'narrow' | 'wide' | 'none' | 'custom'

export interface Margins {
  top: number // millimetres
  right: number
  bottom: number
  left: number
}

export interface PdfOptions {
  format: PageFormat
  landscape: boolean
  marginPreset: MarginPreset
  margins: Margins
  header: {enabled: boolean; template: string}
  footer: {enabled: boolean; template: string}
  printBackground: boolean
  css: string
}

export const DEFAULTS: PdfOptions = {
  format: 'A4',
  landscape: false,
  marginPreset: 'normal',
  margins: {top: 20, right: 20, bottom: 20, left: 20},
  header: {enabled: false, template: ''},
  footer: {enabled: false, template: '{pageNumber} / {totalPages}'},
  printBackground: true,
  css: '',
}

export const MARGIN_PRESETS: Record<Exclude<MarginPreset, 'custom'>, Margins> = {
  normal: {top: 20, right: 20, bottom: 20, left: 20},
  narrow: {top: 10, right: 10, bottom: 10, left: 10},
  wide: {top: 30, right: 30, bottom: 30, left: 30},
  none: {top: 0, right: 0, bottom: 0, left: 0},
}
```

### 4.2 Hook (`src/hooks/usePdfOptions.ts`)

```ts
export interface UsePdfOptions {
  options: PdfOptions
  set: <K extends keyof PdfOptions>(key: K, value: PdfOptions[K]) => void
  setMargin: (side: keyof Margins, value: number) => void
  reset: () => void
}
```

Behaviour:

- On mount, read `localStorage["press.options"]`. Merge over `DEFAULTS` so new fields added later become forward-compatible (missing keys take the default).
- Storage envelope: `{ v: 1, options: PdfOptions }`. Versioned for future schema migrations.
- Writes are debounced 200ms via a `useEffect` so typing in the CSS textarea does not thrash storage on every keystroke.
- `set('marginPreset', preset)` with `preset !== 'custom'` auto-syncs `margins` to `MARGIN_PRESETS[preset]`.
- `setMargin(side, value)` forces `marginPreset: 'custom'`.
- `reset()` writes `DEFAULTS` and removes the storage key so the next session starts clean.
- Storage failures (private browsing) are caught and ignored; in-memory state still functions for the session. One console.warn for the developer.

### 4.3 Schema validation on load

Parse failures, version mismatches, or shape mismatches all fall back to `DEFAULTS`. The check is a small `isValid(o: unknown): o is PdfOptions` guard — verifies the discriminator fields exist and have the right primitive types. Anything richer would over-engineer for the actual risk surface (a user-edited DevTools value).

## 5. Backend contract (assumed; flagged)

### 5.1 Wire shape

```jsonc
// POST /pdf
{
  "content": "...",
  "options": {
    "format": "A4",
    "landscape": false,
    "margin": {"top": "20mm", "right": "20mm", "bottom": "20mm", "left": "20mm"},
    "displayHeaderFooter": true,
    "headerTemplate": "<div ...>...</div>",
    "footerTemplate": "<div ...>...</div>",
    "printBackground": true,
    "css": "h1 { color: #c8451e; }",
  },
}
```

**Assumption to verify:** the backend accepts this exact key set and shape, matching puppeteer's `Page.pdf()` options plus an additional `css` field. If field names differ in reality (`paperFormat` vs `format`, `marginsMm` vs `margin`, etc.), the mapper module is the single point of change — UI shape stays the same.

### 5.2 Mapper (`src/api/optionsMapper.ts`)

```ts
export const toRequestOptions = (o: PdfOptions): RequestPdfOptions => {
  // A toggle "on" with an empty template is treated as off — the user opted in
  // but never typed anything, so there's nothing to show.
  const headerHtml =
    o.header.enabled && o.header.template.trim() ? renderTemplate(o.header.template) : ''
  const footerHtml =
    o.footer.enabled && o.footer.template.trim() ? renderTemplate(o.footer.template) : ''
  return {
    format: o.format,
    landscape: o.landscape,
    margin: {
      top: `${o.margins.top}mm`,
      right: `${o.margins.right}mm`,
      bottom: `${o.margins.bottom}mm`,
      left: `${o.margins.left}mm`,
    },
    displayHeaderFooter: Boolean(headerHtml || footerHtml),
    headerTemplate: headerHtml,
    footerTemplate: footerHtml,
    printBackground: o.printBackground,
    ...(o.css.trim() ? {css: o.css} : {}),
  }
}
```

### 5.3 Template rendering

Users type `{pageNumber}` / `{totalPages}` / `{date}` / `{title}` / `{url}`. Puppeteer expects `<span class="pageNumber"></span>` etc. The mapper:

1. `escapeHtml(raw)` first — user text becomes inert text.
2. Replace the literal placeholder tokens with the puppeteer class spans. Since `{` and `}` are not HTML-special, escape doesn't touch them; the substitution finds exact matches.
3. Wrap the result in a styled `<div>` (font-size 9px, full-width, padded, muted color).

This is the same trust boundary the existing preview uses for sanitization — escape, then re-add only what we control.

### 5.4 API client

Extend `submitContent(content, baseUrl?, options?)`. The third arg is optional, so existing call sites (and `pdfClient.test.ts`) keep working. Body becomes `{ content, options }` when options provided, `{ content }` when omitted.

**Empty state:** if user resets all to defaults and `css` is empty, the request still carries `options`. Explicit is better than implicit; the backend can apply its own defaults if it chooses.

## 6. Component structure

```
src/components/OptionsBar/
  ├─ OptionsBar.tsx           — collapsible container, summary row, expand/reset
  ├─ PageFormatControl.tsx    — format select + orientation segmented
  ├─ MarginsControl.tsx       — preset chips + 4 numeric inputs
  ├─ HeaderFooterControl.tsx  — generic, used twice
  ├─ CustomCssControl.tsx     — expandable mini textarea
  ├─ PlaceholderChips.tsx     — clickable inserter chips
  └─ index.ts                 — barrel export
```

```
src/utils/
  ├─ summarize.ts             — PdfOptions → human-readable summary line
  └─ escapeHtml.ts            — new utility, ~10 LOC, used by renderTemplate
```

`OptionsBar` is the only piece `App.tsx` imports. It receives the full `usePdfOptions` return as a prop and threads pieces to its children — no shared context, no global store.

### 6.1 Segmented control reuse

The existing `.theme-switcher` CSS in `theme.css` is the pattern for orientation (portrait/landscape) and margin presets. Factor into a generic `.segmented` class. Refactor `ThemeSwitcher` to use it in the same change — the orientation control gets the same micro-interactions for free (sliding thumb, lime fill).

## 7. Error handling

| Failure                                          | Where          | Handling                                                                                                                                                         |
| ------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend rejects options (400)                    | submit path    | Existing `ApiError(code='validation')` → status row renders `Invalid. <message>`                                                                                 |
| CSS exceeds 5,000 chars                          | client         | Submit disabled, counter chip shows `over 5,000 chars` in `--warn`, hover state explains. Mirrors the existing under-MIN / over-MAX content gating in `App.tsx`. |
| Bad localStorage JSON / shape mismatch           | hook init      | Try/catch around parse + shape guard. Fall back to `DEFAULTS`, console.warn, silent for user.                                                                    |
| Storage write fails (private mode)               | hook effect    | Try/catch. In-memory state still works for the session.                                                                                                          |
| Network / rate-limit / poll-timeout / failed-job | existing paths | No change. Options ride along on submit; downstream of `submitContent` doesn't know they exist.                                                                  |

**Deliberately not added:** per-field inline errors (only the CSS cap is a real client-side rule), toast/snackbar system (status row is sufficient), CSS syntax linting (power users author their own CSS).

## 8. Testing strategy

### 8.1 New unit tests (vitest)

| File                                             | Covers                                                                                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/summarize.test.ts`                    | defaults → `"Defaults"`; single deviation; all deviations; orientation/preset wording                                                                                                                           |
| `src/api/optionsMapper.test.ts`                  | mm → `"20mm"`; header/footer suppression when disabled; css omission when blank; header template substitution; footer template substitution                                                                     |
| `src/api/optionsMapper.test.ts` (renderTemplate) | escape-before-substitute order; XSS attempt → escaped output; unknown placeholder passes through as literal text                                                                                                |
| `src/hooks/usePdfOptions.test.ts`                | empty storage → DEFAULTS; valid stored → merged; bad JSON → DEFAULTS; missing field → DEFAULTS fills; `setMargin` forces `'custom'`; `set('marginPreset', 'narrow')` syncs `margins`; `reset()` writes defaults |

### 8.2 Integration test extension

Add one new case in `App.test.tsx`:

> **submit includes options in body when user changes format**
> Render App, type content, expand the options bar, change format to Letter, click Submit. Assert the MSW handler received `body.options.format === 'Letter'`.

### 8.3 Explicitly not tested

- Visual layout of OptionsBar — CSS, manual verification across themes.
- Every preset combination — the preset → margins sync unit test covers the logic.
- Backend response to bad CSS — backend concern; we test that we send what we said we'd send.

### 8.4 Existing tests

All 25 existing tests continue to pass. `submitContent`'s new third arg is optional, so `pdfClient.test.ts` and `App.test.tsx`'s smoke test still call the original two-arg form successfully.

## 9. Implementation phasing (suggested for the plan)

The spec is one unit; the implementation plan may phase it. Suggested order so each phase ships a usable slice:

1. **Foundation** — `PdfOptions` types, `usePdfOptions` hook, `summarize`, `optionsMapper`, `submitContent` third arg. No UI yet; unit tests prove the data layer.
2. **Collapsed bar + format/orientation** — `OptionsBar` shell with summary + expand, `PageFormatControl`. Ship: users can change format and orientation.
3. **Margins** — `MarginsControl` with presets and custom inputs.
4. **Headers and footers** — `HeaderFooterControl` + `PlaceholderChips`.
5. **Custom CSS** — `CustomCssControl` with the character cap and submit gating.

Each phase ends with a green lint/typecheck/test run and the dev server smoke-tested.

## 10. Open questions

1. **Backend contract** — verify the assumed puppeteer-style shape before phase 1 lands. If the actual contract differs, only `optionsMapper.ts` and `RequestPdfOptions` change; the UI is decoupled.
2. **mm vs in for margins** — defaulting to mm is right for A4 / Letter and matches puppeteer accepting unit-suffixed strings. If the audience is US-centric and prefers inches, swap the suffix and adjust `MARGIN_PRESETS` numerics.
3. **CSS cap value** — 5,000 chars is a guess. If the backend has its own limit (rejects 10KB?), reconcile before phase 5.
