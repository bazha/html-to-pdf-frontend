# html-to-pdf-frontend

A React + TypeScript + Vite SPA for converting HTML, Markdown, or plain text to PDF. Paste or drag-and-drop content, submit it to an external PDF rendering service, and download the result when it's ready.

There is no application backend in this repo — the API is configured via `VITE_API_BASE_URL`.

## Getting started

```bash
npm install
cp .env.example .env   # optional: override VITE_API_BASE_URL
npm run dev
```

The dev server runs on Vite with HMR. By default the frontend talks to `http://localhost:3000`.

## Scripts

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

Run a single test file or by name:

```bash
npx vitest run src/hooks/useCooldown.test.ts
npx vitest run -t 'returns null when not rate_limited'
```

## Features

- Paste or drag-and-drop HTML, Markdown, or text — type is auto-detected.
- Sandboxed live preview (`<iframe sandbox="">`) with Markdown rendering (marked + DOMPurify) and HTML sanitization.
- PDF options: page format, orientation, margins, header/footer templates with placeholders (`{pageNumber}`, `{totalPages}`, `{date}`, `{title}`, `{url}`), custom CSS.
- Options persisted to `localStorage` with versioned shape validation.
- Submit → poll → download flow with rate-limit handling (honors `Retry-After`) and a 120 s deadline.
- Light/dark theme switcher.

## Architecture

Layering is strict and one-way: `components/` → `hooks/` → `api/` + `types/` + `utils/`. The only file that calls `fetch` is `src/api/pdfClient.ts`.

### Flow

`App.tsx` coordinates two state-machine hooks:

- **`useSubmit`** (`src/hooks/useSubmit.ts`) — `idle | submitting | rate_limited | error`. On `429`, captures `Retry-After` and schedules a cooldown back to `idle`.
- **`usePoll`** (`src/hooks/usePoll.ts`) — `idle | polling | completed | failed | error`. Driven by `jobId`; polls every 1500 ms (3000 ms after a 429) until completed/failed or 120 s deadline.

`ActionRow` derives the button label and status line from a single `Status` union keyed into a `STATUS_VIEW` table — there is no second precedence ladder.

### API contract (`src/api/pdfClient.ts`)

- `POST /pdf` → `202 { jobId, file, detectedType }` | `400` validation | `429` rate-limited.
- `GET /pdf/:jobId/url` → `200 { status, url? }` | `404 not_found` | `422 failed` | `429` rate-limited.
- All errors throw `ApiError` with a discriminated `code: 'validation' | 'rate_limit' | 'http' | 'network'`. Consumers pattern-match on `code`, not `status`.

### PDF options

`src/types/pdfOptions.ts` is the single source of truth for option shape, defaults, and literal arrays. When adding a field:

1. Add it to the interface and `DEFAULTS`.
2. Extend `isValid()` in `src/hooks/usePdfOptions.ts`.
3. Add the key to the sentinel in `src/utils/optionsEqual.ts` (compile-time exhaustiveness check).
4. Map it in `src/api/optionsMapper.ts` if it must reach the wire.

## Testing

- Vitest 4 + `@testing-library/react` + jsdom.
- `App.test.tsx` is the end-to-end integration test, using `msw` to mock the backend.
- `src/setupTests.ts` polyfills `DragEvent` for jsdom.
- Hook tests use `renderHook` + `vi.useFakeTimers()` for interval/timeout logic.

## Conventions

- Pre-commit gate: `npm run lint`, `npm test`, and `npm run format:check` must all be green.
- Commit messages: lowercase scoped prefix, imperative — `feat(hooks): ...`, `fix(app): ...`, `refactor(ui): ...`.
- Multi-step plans live in `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.
- Don't import from `components/` inside `hooks/` or `utils/`.
