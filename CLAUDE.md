# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React + TypeScript + Vite SPA that lets a user paste or drag-and-drop HTML/Markdown/text, submits the content to an external PDF rendering service, polls for completion, and exposes a download link. There is no application backend in this repo — the API base URL is configured via `VITE_API_BASE_URL` (default `http://localhost:3000`, see `.env.example`).

## Commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # tsc -b && vite build (typecheck is part of build)
npm test             # vitest run — all tests once
npm run test:watch   # vitest in watch mode
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm run format:check # prettier --check .
```

Single test file or pattern:

```bash
npx vitest run src/hooks/useCooldown.test.ts
npx vitest run -t 'returns null when not rate_limited'
```

**Pre-commit gate:** `npm run lint`, `npm test`, and `npm run format:check` must all be green before any commit.

## Architecture

Layering is strict and one-way: `components/` → `hooks/` → `api/` + `types/` + `utils/`. The boundary is `src/api/pdfClient.ts` (the only file that calls `fetch`).

### Submit → poll → download flow

`App.tsx` is the single coordinator. The flow is split across two hooks driven by discriminated-union state machines:

- `src/hooks/useSubmit.ts` — `SubmitState = idle | submitting | rate_limited | error`. Exposes `submit(content, options, onSuccess)`. On `429`, it captures `Retry-After`, stores `{retryAfter, until}`, and schedules a timeout to flip back to `idle`.
- `src/hooks/usePoll.ts` — `PollState = idle | polling | completed | failed | error`. Driven by a `jobId` prop; tears down and restarts on `jobId` change via the `prevJobId` render-time-state pattern. Polls every 1500 ms (3000 ms on backoff after 429) until completed/failed or 120 s deadline.

`App.tsx` wires them: `submit.submit(...)` returns a jobId via `onSuccess`, which sets local state and feeds `usePoll`. The button label and status line are derived in `src/components/ActionRow.tsx` from a single `Status` union (file_error → rate_limited → submit_error → submitting → rendering → ready → failed → poll_error → idle) keyed into a `STATUS_VIEW` table — do not add a second precedence ladder.

### API contract (`src/api/pdfClient.ts`)

- `POST /pdf` → `202 { jobId, file, detectedType }` | `400` validation | `429` rate-limited (reads `Retry-After` header).
- `GET /pdf/:jobId/url` → `200 { status, url? }` | `404 not_found` (Redis evicted) | `422 failed` | `429` rate-limited.
- All errors are thrown as `ApiError` with a discriminated `code: 'validation' | 'rate_limit' | 'http' | 'network'`. Consumer hooks pattern-match on `code`, not `status`.

### PDF options

`src/types/pdfOptions.ts` is the single source of truth for option shape, defaults, and string-literal arrays. Constants are declared `as const` with derived types — do NOT re-declare option literals (`'A4'`, `'normal'`, `'{pageNumber}'`) inline anywhere. Add new keys here.

`src/hooks/usePdfOptions.ts` owns option state with debounced (200 ms) versioned `localStorage` persistence at key `press.options`. `isValid()` is a manual shape guard; on schema breakage it falls back to `DEFAULTS`. When adding a field to `PdfOptions`:

1. Add to the interface and `DEFAULTS`.
2. Extend `isValid()` with a check (no new field == invalid load == reset to defaults; merge over DEFAULTS is shallow, nested defaults won't backfill).
3. `src/utils/optionsEqual.ts` enforces field exhaustiveness at compile time via a `satisfies Record<keyof PdfOptions, true>` sentinel — TS will fail until you add the new key there too.
4. Add the field to the `RequestPdfOptions` mapping in `src/api/optionsMapper.ts` if it must reach the wire.

Header/footer templates use placeholder substitution (`{pageNumber}`, `{totalPages}`, `{date}`, `{title}`, `{url}`). Raw input is `escapeHtml`'d before substitution to spans; templates are clamped to `HEADER_TEMPLATE_MAX_LENGTH` via `src/utils/clampTemplate.ts`.

### Preview pane

`src/components/Preview.tsx` renders into a sandboxed iframe (`sandbox=""` — opaque origin, no script execution, no same-origin access). It debounces 150 ms, then `renderMarkdownToHtml` (marked + DOMPurify) or `sanitizeHtml` (DOMPurify) the content. `detectType` is a heuristic that mirrors the backend; the comment at `src/utils/detectType.ts:1-5` is load-bearing — the backend is authoritative.

### Drag & drop

`src/hooks/useDropZone.ts` owns drag-over state and the window-level safety net. The safety net listens for `dragleave` with `e.relatedTarget === null` (cursor left the document) and `drop` on `window` — NOT `dragend`, which only fires for in-page drag sources and silently misses external file drag-leaves. Consumers spread `{...bind}` onto the surface element.

### Page break controls

Users mark page breaks with the literal HTML comment `<!-- page-break -->` (case- and whitespace-tolerant). The canonical form is exported as `PAGE_BREAK_LITERAL` from `src/utils/pageBreaks.ts` — reuse the export rather than typing the string. `transformPageBreaks(s)` replaces every match with `<div class="pdf-page-break" style="break-before: page; page-break-before: always;"></div>`.

The transform is called at **exactly two seams** and nowhere else:

- `src/components/Preview.tsx` — before `renderMarkdownToHtml` / `sanitizeHtml`, so the dashed divider shows in the iframe.
- `src/hooks/useSubmit.ts` — before `submitContent`, so Chromium sees the inline `break-before` directive on the backend.

**Editor state stays raw.** `App.setContent` always holds exactly what the user typed; the comment is never auto-rewritten upstream. This invariant is what permits a future find/replace / save-draft feature without surprises.

The `.pdf-page-break` class is styled inside `PREVIEW_STYLES` (dashed divider + "page break" label on screen, reset under `@media print`). DOMPurify survival is asserted by `pageBreaks.test.ts` test #7 — if a future PR tightens `PURIFY_OPTIONS` and strips the marker, that test fails loudly.

`src/components/EditorToolbar.tsx` is a thin presentational toolbar above the textarea. Currently one button ("Insert page break") but the surface is built to accept future editor actions without rework. Cursor-position insertion lives in `Editor.tsx` via textarea ref + `requestAnimationFrame` caret restore (same pattern as `PlaceholderChips` → `HeaderFooterControl`).

## Testing

- Vitest 4 + `@testing-library/react` + jsdom.
- `App.test.tsx` is the end-to-end integration test, using `msw` to mock the backend.
- `src/setupTests.ts` polyfills `DragEvent` for jsdom (gated on `typeof DragEvent === 'undefined'`).
- Hook tests use `renderHook` + `vi.useFakeTimers()` when intervals/timeouts are involved (`usePoll`, `usePdfOptions`, `useSubmit`, `useCooldown`).
- TS narrowing note: `renderHook({ initialProps })` infers prop types from the initial literal. If the prop's type union widens on `rerender`, you must cast at the initial site (e.g. `{ s: idle as SubmitState }`) — see `useCooldown.test.ts` for the pattern.

## Conventions

- Commit message style: lowercase scoped prefix, imperative (`feat(hooks): ...`, `refactor(ui): ...`, `fix(app): ...`). No `Co-Authored-By` trailers in normal commits.
- Plans for multi-step work live in `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`; design docs in `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`.
- Keep the layering one-way. Don't import from `components/` inside `hooks/` or `utils/`.
- When a piece of logic crosses two component files, prefer extracting a hook over prop-drilling state. The OptionsBar controls are intentionally not generalized into a compound component (only ~5 controls); resist that until a 7th lands.
