# Cleanup: Extract Hooks, Collapse ActionRow, Fix Drag Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the cleanup work catalogued in the 2026-05-20 audit (items R2–R6) and fix one real bug uncovered while writing this plan: the drag overlay can get stuck after an external file drag-leave.

**Architecture:** Pull two pieces of orchestration logic out of `App.tsx` into focused custom hooks (`useCooldown`, `useDropZone`). Replace `ActionRow`'s two parallel phase ladders with a single derived status table. Add a tiny template-clamp helper and a structural equality helper to replace `JSON.stringify` comparison.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, MSW, Vite. No new dependencies.

---

## File Structure

**Create**

- `src/hooks/useCooldown.ts` — derives a ticking `cooldownSeconds: number | null` from `SubmitState`.
- `src/hooks/useCooldown.test.ts` — unit tests using fake timers.
- `src/hooks/useDropZone.ts` — exposes `{ isDragOver, bind }` so a container can opt-in to file drag/drop.
- `src/hooks/useDropZone.test.ts` — unit tests for enter/leave/drop and the external-leave safety net.
- `src/utils/clampTemplate.ts` — single-purpose `clampTemplate(s)` returning `s.slice(0, HEADER_TEMPLATE_MAX_LENGTH)`.
- `src/utils/clampTemplate.test.ts` — unit tests.
- `src/utils/optionsEqual.ts` — structural `optionsEqual(a, b)` for `PdfOptions` (replaces `JSON.stringify` in `OptionsBar`).
- `src/utils/optionsEqual.test.ts` — unit tests.

**Modify**

- `src/App.tsx` — adopt `useCooldown` and `useDropZone`; drop `cooldownLeft`, `prevSubmitPhase`, `dragDepth`, `isDragOver`, the two effects, and four inline drag handlers.
- `src/components/ActionRow.tsx` — collapse `renderStatus` + `submitLabel` into a single `STATUS_VIEW` keyed by a derived status.
- `src/components/OptionsBar/OptionsBar.tsx` — use `optionsEqual(pdf.options, DEFAULTS)` instead of `JSON.stringify`.
- `src/components/OptionsBar/HeaderFooterControl.tsx` — call `clampTemplate` instead of inline `.slice`.
- `src/components/OptionsBar/PlaceholderChips.tsx` — call `clampTemplate` instead of inline `.slice`.

---

## Conventions used by this plan

- **Test commands**: `npx vitest run <path>` for a single file, `npx vitest run` for the whole suite. `npx tsc -b` for typecheck, `npx eslint <path>` for lint.
- **Commit style**: matches existing repo style — lowercase scope prefix, imperative, e.g. `feat(hooks): add useCooldown`, `fix(ui): reset drag overlay on window-level leave`, `refactor(ui): collapse ActionRow status ladder`.
- **Branch**: continue on `feat/pdf-options` (current branch). No new branch needed.

---

## Task 1: Add `useCooldown` hook

**Why:** `App.tsx:47–63` seeds a cooldown counter via render-time `setState` on phase transitions then runs a 250 ms interval. The "React-blessed pattern" comment acknowledges it's fragile. Extract to encapsulate the prev-phase ref + interval + `null`-when-not-rate-limited semantics.

**Files:**

- Create: `src/hooks/useCooldown.ts`
- Test: `src/hooks/useCooldown.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useCooldown.test.ts`:

```ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {renderHook, act} from '@testing-library/react'
import {useCooldown} from './useCooldown'
import type {SubmitState} from './useSubmit'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const idle: SubmitState = {phase: 'idle'}
const rateLimited = (retryAfter: number): SubmitState => ({
  phase: 'rate_limited',
  retryAfter,
  until: Date.now() + retryAfter * 1000,
})

describe('useCooldown', () => {
  it('returns null when not rate_limited', () => {
    const {result} = renderHook(() => useCooldown(idle))
    expect(result.current).toBeNull()
  })

  it('seeds with retryAfter when entering rate_limited', () => {
    const {result, rerender} = renderHook(({s}) => useCooldown(s), {
      initialProps: {s: idle},
    })
    rerender({s: rateLimited(30)})
    expect(result.current).toBe(30)
  })

  it('ticks down each second', () => {
    const {result, rerender} = renderHook(({s}) => useCooldown(s), {
      initialProps: {s: idle},
    })
    rerender({s: rateLimited(5)})
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(4)
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toBe(1)
  })

  it('clamps to 0 and does not go negative', () => {
    const {result, rerender} = renderHook(({s}) => useCooldown(s), {
      initialProps: {s: idle},
    })
    rerender({s: rateLimited(2)})
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current).toBe(0)
  })

  it('returns to null when phase leaves rate_limited', () => {
    const {result, rerender} = renderHook(({s}) => useCooldown(s), {
      initialProps: {s: rateLimited(10)},
    })
    rerender({s: idle})
    expect(result.current).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useCooldown.test.ts`
Expected: FAIL with "Cannot find module './useCooldown'" or similar.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useCooldown.ts`:

```ts
import {useEffect, useState} from 'react'
import type {SubmitState} from './useSubmit'

export const useCooldown = (state: SubmitState): number | null => {
  const [seconds, setSeconds] = useState<number | null>(
    state.phase === 'rate_limited' ? state.retryAfter : null,
  )

  // Sync seed on phase transitions without an effect (render-time state
  // sync is React's recommended pattern for prop-derived state).
  const [prevPhase, setPrevPhase] = useState(state.phase)
  if (state.phase !== prevPhase) {
    setPrevPhase(state.phase)
    setSeconds(state.phase === 'rate_limited' ? state.retryAfter : null)
  }

  useEffect(() => {
    if (state.phase !== 'rate_limited') return
    const until = state.until
    const id = window.setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    }, 250)
    return () => window.clearInterval(id)
  }, [state])

  return seconds
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useCooldown.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -b && npx eslint src/hooks/useCooldown.ts src/hooks/useCooldown.test.ts`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCooldown.ts src/hooks/useCooldown.test.ts
git commit -m "feat(hooks): add useCooldown for rate-limit countdown"
```

---

## Task 2: Add `useDropZone` hook (and fix the drag-overlay bug)

**Why two things in one task:** The drag-overlay bug (window `dragend` does not fire for OS-originated drags that leave the window without dropping) and the App.tsx orchestration smell share the same code surface. Fixing one without the other would mean editing the surface twice.

**Bug:** `App.tsx:75–82` registers a window `dragend` listener as a "safety net." `dragend` only fires for drags whose source is an in-page element. A user dragging a `.md` file in from Finder, then dragging back out of the window without dropping, never triggers `dragend` — leaving `dragDepth.current > 0` and `.dragover` stuck.

**Fix shape:** the hook listens for window-level `dragleave` (where `e.relatedTarget === null` indicates the cursor has left the document) and window-level `drop` as a belt-and-suspenders reset.

**Files:**

- Create: `src/hooks/useDropZone.ts`
- Test: `src/hooks/useDropZone.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useDropZone.test.ts`:

```ts
import {describe, it, expect, vi} from 'vitest'
import {renderHook, act} from '@testing-library/react'
import {useDropZone} from './useDropZone'

const file = new File(['hi'], 'x.md', {type: 'text/markdown'})
const dt = () => ({files: [file], dropEffect: 'none' as DataTransfer['dropEffect']})
const ev = (overrides: object = {}) => ({
  preventDefault: vi.fn(),
  dataTransfer: dt(),
  ...overrides,
})

describe('useDropZone', () => {
  it('starts not-dragging', () => {
    const {result} = renderHook(() => useDropZone(vi.fn()))
    expect(result.current.isDragOver).toBe(false)
  })

  it('sets isDragOver on first dragEnter, clears on drop', () => {
    const onFile = vi.fn()
    const {result} = renderHook(() => useDropZone(onFile))
    act(() => result.current.bind.onDragEnter(ev() as never))
    expect(result.current.isDragOver).toBe(true)
    act(() => result.current.bind.onDrop(ev() as never))
    expect(result.current.isDragOver).toBe(false)
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('handles nested enter/leave via depth counting', () => {
    const {result} = renderHook(() => useDropZone(vi.fn()))
    act(() => result.current.bind.onDragEnter(ev() as never)) // depth 1
    act(() => result.current.bind.onDragEnter(ev() as never)) // depth 2 (entering a child)
    act(() => result.current.bind.onDragLeave(ev() as never)) // depth 1 — still over
    expect(result.current.isDragOver).toBe(true)
    act(() => result.current.bind.onDragLeave(ev() as never)) // depth 0 — leaving
    expect(result.current.isDragOver).toBe(false)
  })

  it('resets when window dragleave fires with null relatedTarget (cursor left window)', () => {
    const {result} = renderHook(() => useDropZone(vi.fn()))
    act(() => result.current.bind.onDragEnter(ev() as never))
    expect(result.current.isDragOver).toBe(true)
    act(() => {
      window.dispatchEvent(new DragEvent('dragleave', {bubbles: true}))
    })
    expect(result.current.isDragOver).toBe(false)
  })

  it('resets on window drop (drop landed outside the zone)', () => {
    const {result} = renderHook(() => useDropZone(vi.fn()))
    act(() => result.current.bind.onDragEnter(ev() as never))
    act(() => {
      window.dispatchEvent(new DragEvent('drop', {bubbles: true}))
    })
    expect(result.current.isDragOver).toBe(false)
  })

  it('does not call onFile if drop has no files', () => {
    const onFile = vi.fn()
    const {result} = renderHook(() => useDropZone(onFile))
    act(() =>
      result.current.bind.onDrop({
        preventDefault: vi.fn(),
        dataTransfer: {files: []},
      } as never),
    )
    expect(onFile).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useDropZone.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useDropZone.ts`:

```ts
import {useEffect, useRef, useState, type DragEvent} from 'react'

interface Bind {
  onDragEnter: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

export interface UseDropZone {
  isDragOver: boolean
  bind: Bind
}

export const useDropZone = (onFile: (file: File) => void): UseDropZone => {
  const [isDragOver, setIsDragOver] = useState(false)
  const depth = useRef(0)

  const reset = () => {
    depth.current = 0
    setIsDragOver(false)
  }

  // Window-level safety net. `dragend` only fires for in-page drag sources,
  // so it does NOT cover the common case of dragging a file in from Finder
  // and back out of the window. `dragleave` on the window with no
  // relatedTarget (cursor left the document) plus a window `drop` listener
  // covers both external-leave and drops outside our zone.
  useEffect(() => {
    const onWindowDragLeave = (e: globalThis.DragEvent) => {
      if (e.relatedTarget === null) reset()
    }
    window.addEventListener('dragleave', onWindowDragLeave)
    window.addEventListener('drop', reset)
    return () => {
      window.removeEventListener('dragleave', onWindowDragLeave)
      window.removeEventListener('drop', reset)
    }
  }, [])

  const bind: Bind = {
    onDragEnter: (e) => {
      e.preventDefault()
      depth.current += 1
      setIsDragOver(true)
    },
    onDragOver: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setIsDragOver(false)
    },
    onDrop: (e) => {
      e.preventDefault()
      reset()
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    },
  }

  return {isDragOver, bind}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useDropZone.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -b && npx eslint src/hooks/useDropZone.ts src/hooks/useDropZone.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDropZone.ts src/hooks/useDropZone.test.ts
git commit -m "feat(hooks): add useDropZone with window-level safety net"
```

---

## Task 3: Integrate `useCooldown` and `useDropZone` into `App.tsx`

**Why:** Shrinks `App.tsx` by ~30 lines and removes the two pieces of orchestration. Existing `App.test.tsx` integration tests (submit→poll→download, file pick, drag-drop, options-format) keep covering behavior end-to-end.

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Apply the changes**

Edit `src/App.tsx` to:

1. Add imports at the top:

   ```ts
   import {useCooldown} from './hooks/useCooldown'
   import {useDropZone} from './hooks/useDropZone'
   ```

2. Remove these unused-after-refactor symbols from `useEffect, useRef, useState` import: the `useRef` import is still needed by other hooks indirectly via React — leave the imports alone; only state usage drops.

3. Remove `cooldownLeft`, `prevSubmitPhase`, `dragDepth`, `isDragOver` state and the related effects/setters. Remove the inline `onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop` handlers. Remove the window `dragend` safety-net effect (`useEffect(() => { const reset = () => { ... }; window.addEventListener('dragend', reset); ... }, []);`).

4. Inside the component body, after the `usePdfOptions` line, add:

   ```ts
   const cooldownLeft = useCooldown(submit.state)
   const dropZone = useDropZone(handlePickedFile)
   ```

   Note: `handlePickedFile` is declared later — hoist its declaration above the hook call or wrap it in `useCallback`. Simplest: move `handlePickedFile` declaration up (it has no dependencies that prevent hoisting). Actually `handlePickedFile` uses `setFileError`, `setContent`, `setActiveTab` — all stable setters — and `loadFileAsText`. Hoisting is safe. Move it to right after `pdfOptions`.

5. Replace the existing `<div className={\`surface...\`} onDragEnter={...} onDragOver={...} onDragLeave={...} onDrop={...}>` with:

   ```tsx
   <div
     className={`surface${dropZone.isDragOver ? ' dragover' : ''}${poll.phase === 'polling' || submit.state.phase === 'submitting' ? ' surface--running' : ''}`}
     {...dropZone.bind}
   >
   ```

6. Replace `{isDragOver && <div className="drop-overlay">Drop to load</div>}` with `{dropZone.isDragOver && <div className="drop-overlay">Drop to load</div>}`.

The expected diff: `App.tsx` loses `cooldownLeft`, `setCooldownLeft`, `prevSubmitPhase`, `setPrevSubmitPhase`, `isDragOver`, `setIsDragOver`, `dragDepth`, the cooldown effect, the `dragend` window-listener effect, and the four inline drag handlers. It gains two lines instantiating the hooks. Net: -30 lines.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all 70+ tests). Specifically the App-level drag/drop/submit tests in `src/App.test.tsx` must remain green.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc -b && npx eslint src/App.tsx`
Expected: clean.

- [ ] **Step 4: Manual smoke test in the browser**

Run: `npm run dev`

Verify:

- Drag a `.md` file from Finder onto the surface — overlay appears.
- Drag the file in, then drag it back out of the browser window without releasing — **overlay disappears**. (This is the bug fix; before the fix the overlay would stay stuck.)
- Drop a file onto the surface — content loads.
- Submit a long document repeatedly until rate-limited — countdown shows correct seconds, button label updates.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): adopt useCooldown and useDropZone; fix external drag-leave"
```

---

## Task 4: Collapse `ActionRow` status ladder into a single derived status

**Why:** `ActionRow.tsx:18–146` walks the same `(submitState, pollState, cooldownSeconds, fileError)` precedence twice — once in `renderStatus`, once in `submitLabel`. Adding a phase means editing two ladders, and you can introduce a discrepancy between status text and button label. Drive both from a single derived `status: Status`.

**Files:**

- Modify: `src/components/ActionRow.tsx`

**Note on testing:** `ActionRow` has no direct unit test today; its behavior is exercised via `App.test.tsx`. We rely on the App-level tests to catch regressions. Adding a focused unit test is overkill for this single-file refactor — skip it unless a regression appears.

- [ ] **Step 1: Apply the refactor**

Replace the entire body of `src/components/ActionRow.tsx` with:

```tsx
import type {PollState} from '../hooks/usePoll'
import type {SubmitState} from '../hooks/useSubmit'
import type {ReactNode} from 'react'

interface Props {
  pollState: PollState
  submitState: SubmitState
  canSubmit: boolean
  cooldownSeconds: number | null
  fileError?: string | null
  onSubmit: () => void
}

type Status =
  | 'file_error'
  | 'rate_limited'
  | 'submit_error'
  | 'submitting'
  | 'rendering'
  | 'ready'
  | 'failed'
  | 'poll_error'
  | 'idle'

const deriveStatus = (
  pollState: PollState,
  submitState: SubmitState,
  fileError: string | null | undefined,
): Status => {
  if (fileError) return 'file_error'
  if (submitState.phase === 'rate_limited') return 'rate_limited'
  if (submitState.phase === 'error') return 'submit_error'
  if (submitState.phase === 'submitting') return 'submitting'
  if (pollState.phase === 'polling') return 'rendering'
  if (pollState.phase === 'completed') return 'ready'
  if (pollState.phase === 'failed') return 'failed'
  if (pollState.phase === 'error') return 'poll_error'
  return 'idle'
}

const KBD = <span className="kbd">⌘↵</span>

interface View {
  cls: 'idle' | 'busy' | 'done' | 'err'
  message: (ctx: ViewCtx) => ReactNode
  button: (ctx: ViewCtx) => ReactNode
}

interface ViewCtx {
  pollState: PollState
  submitState: SubmitState
  cooldownSeconds: number | null
  fileError: string | null | undefined
}

const STATUS_VIEW: Record<Status, View> = {
  file_error: {
    cls: 'err',
    message: ({fileError}) => (
      <span>
        <strong>File error.</strong> <span className="dim">{fileError}</span>
      </span>
    ),
    button: () => <>Press {KBD}</>,
  },
  rate_limited: {
    cls: 'err',
    message: ({submitState, cooldownSeconds}) => {
      const left =
        cooldownSeconds ?? (submitState.phase === 'rate_limited' ? submitState.retryAfter : 0)
      return (
        <span>
          <strong>Rate limited.</strong> <span className="dim">Wait </span>
          <code>{left}s</code>
        </span>
      )
    },
    button: ({submitState, cooldownSeconds}) => {
      const left =
        cooldownSeconds ?? (submitState.phase === 'rate_limited' ? submitState.retryAfter : 0)
      return `Wait ${left}s`
    },
  },
  submit_error: {
    cls: 'err',
    message: ({submitState}) => (
      <span>
        <strong>Error.</strong>{' '}
        <span className="dim">{submitState.phase === 'error' ? submitState.message : ''}</span>
      </span>
    ),
    button: () => <>Press {KBD}</>,
  },
  submitting: {
    cls: 'busy',
    message: () => (
      <span>
        <strong>Submitting.</strong> <span className="dim">Sending content.</span>
      </span>
    ),
    button: () => 'Submitting…',
  },
  rendering: {
    cls: 'busy',
    message: () => (
      <span>
        <strong>Rendering.</strong> <span className="dim">Generating PDF on the server.</span>
      </span>
    ),
    button: () => 'Rendering…',
  },
  ready: {
    cls: 'done',
    message: ({pollState}) => (
      <span>
        <strong>Ready.</strong> <span className="dim">PDF generated · </span>
        <a
          className="link"
          href={pollState.phase === 'completed' ? pollState.url : '#'}
          target="_blank"
          rel="noreferrer"
        >
          download pdf
        </a>
      </span>
    ),
    button: () => <>Press again {KBD}</>,
  },
  failed: {
    cls: 'err',
    message: ({pollState}) => (
      <span>
        <strong>Failed.</strong>{' '}
        <span className="dim">{pollState.phase === 'failed' ? pollState.reason : ''}</span>
      </span>
    ),
    button: () => <>Press {KBD}</>,
  },
  poll_error: {
    cls: 'err',
    message: ({pollState}) => (
      <span>
        <strong>Error.</strong>{' '}
        <span className="dim">{pollState.phase === 'error' ? pollState.message : ''}</span>
      </span>
    ),
    button: () => <>Press {KBD}</>,
  },
  idle: {
    cls: 'idle',
    message: () => (
      <span>
        <strong>Idle.</strong> <span className="dim">Type or paste, then submit.</span>
      </span>
    ),
    button: () => <>Press {KBD}</>,
  },
}

export const ActionRow = ({
  pollState,
  submitState,
  canSubmit,
  cooldownSeconds,
  fileError,
  onSubmit,
}: Props) => {
  const status = deriveStatus(pollState, submitState, fileError)
  const view = STATUS_VIEW[status]
  const ctx: ViewCtx = {pollState, submitState, cooldownSeconds, fileError}

  return (
    <div className="actions">
      <div className={`status ${view.cls}`}>
        <span className="glyph" />
        {view.message(ctx)}
      </div>
      <button type="button" className="submit" disabled={!canSubmit} onClick={onSubmit}>
        {view.button(ctx)}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. The App-level "download pdf" link assertion, the "Press" submit-button matcher (regex `/^Press/i`), and rate-limit countdown surfacing all continue to work because the rendered text/JSX is byte-identical to before.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc -b && npx eslint src/components/ActionRow.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ActionRow.tsx
git commit -m "refactor(ui): collapse ActionRow status ladder into single STATUS_VIEW"
```

---

## Task 5: Add `clampTemplate` utility and use it in two places

**Why:** `HeaderFooterControl.tsx:40` and `PlaceholderChips.tsx` lines 15, 21 each inline `.slice(0, HEADER_TEMPLATE_MAX_LENGTH)`. Centralize so the cap rule lives in one place.

**Files:**

- Create: `src/utils/clampTemplate.ts`
- Create: `src/utils/clampTemplate.test.ts`
- Modify: `src/components/OptionsBar/HeaderFooterControl.tsx`
- Modify: `src/components/OptionsBar/PlaceholderChips.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/utils/clampTemplate.test.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {clampTemplate} from './clampTemplate'
import {HEADER_TEMPLATE_MAX_LENGTH} from '../types/pdfOptions'

describe('clampTemplate', () => {
  it('passes short strings through unchanged', () => {
    expect(clampTemplate('hello')).toBe('hello')
  })

  it('truncates to HEADER_TEMPLATE_MAX_LENGTH', () => {
    const long = 'x'.repeat(HEADER_TEMPLATE_MAX_LENGTH + 50)
    expect(clampTemplate(long).length).toBe(HEADER_TEMPLATE_MAX_LENGTH)
  })

  it('returns empty string for empty input', () => {
    expect(clampTemplate('')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/clampTemplate.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/utils/clampTemplate.ts`:

```ts
import {HEADER_TEMPLATE_MAX_LENGTH} from '../types/pdfOptions'

export const clampTemplate = (s: string): string => s.slice(0, HEADER_TEMPLATE_MAX_LENGTH)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/clampTemplate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Use it in `HeaderFooterControl.tsx`**

Edit `src/components/OptionsBar/HeaderFooterControl.tsx`:

Replace:

```tsx
import {HEADER_TEMPLATE_MAX_LENGTH} from '../../types/pdfOptions'
```

with:

```tsx
import {HEADER_TEMPLATE_MAX_LENGTH} from '../../types/pdfOptions'
import {clampTemplate} from '../../utils/clampTemplate'
```

Replace the `onChange` body on the `<input>`:

```tsx
onChange={(e) => onTemplateChange(e.target.value.slice(0, HEADER_TEMPLATE_MAX_LENGTH))}
```

with:

```tsx
onChange={(e) => onTemplateChange(clampTemplate(e.target.value))}
```

Leave `maxLength={HEADER_TEMPLATE_MAX_LENGTH}` on the input alone.

- [ ] **Step 6: Use it in `PlaceholderChips.tsx`**

Edit `src/components/OptionsBar/PlaceholderChips.tsx`:

Replace:

```tsx
import {HEADER_TEMPLATE_MAX_LENGTH, PLACEHOLDER_TOKENS} from '../../types/pdfOptions'
```

with:

```tsx
import {PLACEHOLDER_TOKENS} from '../../types/pdfOptions'
import {clampTemplate} from '../../utils/clampTemplate'
```

Inside the `insert` function, replace:

```tsx
onInsert(token.slice(0, HEADER_TEMPLATE_MAX_LENGTH))
```

with:

```tsx
onInsert(clampTemplate(token))
```

And replace:

```tsx
const next = (el.value.slice(0, start) + token + el.value.slice(end)).slice(
  0,
  HEADER_TEMPLATE_MAX_LENGTH,
)
```

with:

```tsx
const next = clampTemplate(el.value.slice(0, start) + token + el.value.slice(end))
```

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run && npx tsc -b && npx eslint src/`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add src/utils/clampTemplate.ts src/utils/clampTemplate.test.ts \
  src/components/OptionsBar/HeaderFooterControl.tsx \
  src/components/OptionsBar/PlaceholderChips.tsx
git commit -m "refactor(ui): centralize header/footer template clamp in clampTemplate"
```

---

## Task 6: Replace `JSON.stringify` equality in `OptionsBar.isDefault`

**Why:** `OptionsBar.tsx:14–15` uses `JSON.stringify(opts) === JSON.stringify(DEFAULTS)`. Works today because both objects are built from the same shape, but it is order-sensitive and re-stringifies on every render. Switch to a small structural comparator.

**Files:**

- Create: `src/utils/optionsEqual.ts`
- Create: `src/utils/optionsEqual.test.ts`
- Modify: `src/components/OptionsBar/OptionsBar.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/utils/optionsEqual.test.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {optionsEqual} from './optionsEqual'
import {DEFAULTS} from '../types/pdfOptions'

describe('optionsEqual', () => {
  it('returns true for DEFAULTS vs DEFAULTS', () => {
    expect(optionsEqual(DEFAULTS, DEFAULTS)).toBe(true)
  })

  it('returns true for structural copy of DEFAULTS', () => {
    expect(optionsEqual({...DEFAULTS, margins: {...DEFAULTS.margins}}, DEFAULTS)).toBe(true)
  })

  it('detects top-level scalar difference', () => {
    expect(optionsEqual({...DEFAULTS, format: 'Letter'}, DEFAULTS)).toBe(false)
  })

  it('detects nested margin difference', () => {
    expect(optionsEqual({...DEFAULTS, margins: {...DEFAULTS.margins, top: 21}}, DEFAULTS)).toBe(
      false,
    )
  })

  it('detects nested header difference', () => {
    expect(optionsEqual({...DEFAULTS, header: {enabled: true, template: ''}}, DEFAULTS)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/optionsEqual.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/utils/optionsEqual.ts`:

```ts
import type {PdfOptions} from '../types/pdfOptions'

export const optionsEqual = (a: PdfOptions, b: PdfOptions): boolean =>
  a.format === b.format &&
  a.landscape === b.landscape &&
  a.marginPreset === b.marginPreset &&
  a.margins.top === b.margins.top &&
  a.margins.right === b.margins.right &&
  a.margins.bottom === b.margins.bottom &&
  a.margins.left === b.margins.left &&
  a.header.enabled === b.header.enabled &&
  a.header.template === b.header.template &&
  a.footer.enabled === b.footer.enabled &&
  a.footer.template === b.footer.template &&
  a.printBackground === b.printBackground &&
  a.css === b.css
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/optionsEqual.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Use in `OptionsBar.tsx`**

Edit `src/components/OptionsBar/OptionsBar.tsx`:

Replace:

```tsx
import {DEFAULTS} from '../../types/pdfOptions'
```

with:

```tsx
import {DEFAULTS} from '../../types/pdfOptions'
import {optionsEqual} from '../../utils/optionsEqual'
```

Replace:

```tsx
const isDefault = (opts: typeof DEFAULTS): boolean =>
  JSON.stringify(opts) === JSON.stringify(DEFAULTS)
```

(delete those two lines)

Replace:

```tsx
const dirty = !isDefault(pdf.options)
```

with:

```tsx
const dirty = !optionsEqual(pdf.options, DEFAULTS)
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run && npx tsc -b && npx eslint src/`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add src/utils/optionsEqual.ts src/utils/optionsEqual.test.ts \
  src/components/OptionsBar/OptionsBar.tsx
git commit -m "refactor(ui): structural equality for OptionsBar dirty detection"
```

---

## Final verification

After all six tasks are complete:

- [ ] **Full test sweep**

Run: `npx vitest run`
Expected: all tests pass. New file counts:

- `useCooldown.test.ts` — 5 tests
- `useDropZone.test.ts` — 6 tests
- `clampTemplate.test.ts` — 3 tests
- `optionsEqual.test.ts` — 5 tests

- [ ] **Build**

Run: `npm run build`
Expected: clean Vite build.

- [ ] **Lint**

Run: `npm run lint`
Expected: no output.

- [ ] **Manual smoke**

Run: `npm run dev`. Exercise: submit a long doc, trigger rate-limit, watch countdown decrement and Submit button label match it; drag a `.md` file in and back out of the browser window — overlay clears (this is the bug fix); drop a file — content loads; toggle header/footer; expand CSS; reset options.

- [ ] **Diff summary**

Run: `git log --oneline feat/pdf-options ^origin/feat/pdf-options 2>/dev/null || git log --oneline -8`
Expected: 6 new commits (one per task), all on `feat/pdf-options`.

---

## Appendix: Not-doing list

These are deliberately deferred to keep this plan tight. Add to a future plan if priorities shift.

- **`usePdfOptions.load()` shallow-spread (line 54)** — `{ ...DEFAULTS, ...parsed.options }` does not backfill nested fields if a future field is added inside `header`, `footer`, or `margins`. Currently safe because `isValid` requires every current nested field. Fix when adding a nested option, not before.
- **`Preview` sanitization in setTimeout (Preview.tsx:90–99)** — runs synchronously inside the debounced setTimeout. Fine for small documents; consider `useDeferredValue` or web-worker sanitization only if performance shows up as a problem with the 50k-char limit.
- **`theme.css` is 1207 lines** — one file. Not a problem at current scope; revisit only if more controls are added.
- **`ThemeSwitcher.tsx` and the rest of `components/`** — clean, no findings.
