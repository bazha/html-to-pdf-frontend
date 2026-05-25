# PDF Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible PDF Options bar between the tab row and editor surface, exposing page format/orientation, margins, headers/footers, and a custom-CSS escape hatch — all persisted across sessions and threaded into the submit payload.

**Architecture:** A new `usePdfOptions` hook owns the option state and localStorage persistence. A pure `optionsMapper` translates UI shape → backend wire shape (puppeteer-style) at submit time. UI is composed of one `OptionsBar` parent and four sibling controls, each self-contained. The existing `submitContent` API client gains an optional third arg so all current call sites keep working.

**Tech Stack:** React 19 + TypeScript (strict not on, mind null checks), Vite, Vitest + `@testing-library/react` + MSW. ESLint with `react-hooks/set-state-in-effect`.

**Pre-flight (must confirm before phase 1 lands):** The spec assumes a puppeteer-style request body shape. If the actual backend differs, only `src/api/optionsMapper.ts` and its `RequestPdfOptions` type need to change — UI shape stays the same. Verify against the backend contract first.

**Spec reference:** `docs/superpowers/specs/2026-05-18-pdf-options-design.md` (committed at `497a4ce`).

---

## Phase 1 — Foundation

Pure data layer. No UI changes ship in this phase, but every layer has unit tests proving correct behavior. After phase 1, `npm test`, `npm run lint`, `npx tsc -b`, `npm run build` all pass.

### Task 1.1: PdfOptions types and defaults

**Files:**

- Create: `src/types/pdfOptions.ts`

- [ ] **Step 1: Create the types module**

```ts
// src/types/pdfOptions.ts
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

export const CSS_MAX_LENGTH = 5000
export const HEADER_TEMPLATE_MAX_LENGTH = 200
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean exit, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/pdfOptions.ts
git commit -m "feat(types): add PdfOptions schema and defaults"
```

### Task 1.2: escapeHtml utility

**Files:**

- Test: `src/utils/escapeHtml.test.ts`
- Create: `src/utils/escapeHtml.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/escapeHtml.test.ts
import {describe, it, expect} from 'vitest'
import {escapeHtml} from './escapeHtml'

describe('escapeHtml', () => {
  it('escapes the five html-special characters', () => {
    expect(escapeHtml(`<>"'&`)).toBe('&lt;&gt;&quot;&#39;&amp;')
  })
  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
  it('leaves curly braces untouched so placeholder tokens survive', () => {
    expect(escapeHtml('{pageNumber}/{totalPages}')).toBe('{pageNumber}/{totalPages}')
  })
  it('escapes a <script> tag attempt to inert text', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/utils/escapeHtml.test.ts`
Expected: FAIL with "Cannot find module './escapeHtml'".

- [ ] **Step 3: Implement**

```ts
// src/utils/escapeHtml.ts
// `&` must be replaced first; otherwise it would re-escape the `&` produced
// by the other replacements.
export const escapeHtml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/utils/escapeHtml.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/escapeHtml.ts src/utils/escapeHtml.test.ts
git commit -m "feat(utils): add escapeHtml helper for safe template substitution"
```

### Task 1.3: optionsMapper.ts — renderTemplate

This task creates the mapper file with the `RequestPdfOptions` type and the `renderTemplate` function (placeholder → puppeteer-span substitution). `toRequestOptions` comes in the next task to keep this commit focused.

**Files:**

- Test: `src/api/optionsMapper.test.ts`
- Create: `src/api/optionsMapper.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/api/optionsMapper.test.ts
import {describe, it, expect} from 'vitest'
import {renderTemplate} from './optionsMapper'

describe('renderTemplate', () => {
  it('wraps plain text in the styled div', () => {
    const out = renderTemplate('Press')
    expect(out).toContain('Press')
    expect(out.startsWith('<div style="')).toBe(true)
  })

  it('substitutes {pageNumber} → span.pageNumber', () => {
    expect(renderTemplate('{pageNumber}')).toContain('<span class="pageNumber"></span>')
  })

  it('substitutes all five known placeholders', () => {
    const out = renderTemplate('{pageNumber}|{totalPages}|{date}|{title}|{url}')
    expect(out).toContain('<span class="pageNumber"></span>')
    expect(out).toContain('<span class="totalPages"></span>')
    expect(out).toContain('<span class="date"></span>')
    expect(out).toContain('<span class="title"></span>')
    expect(out).toContain('<span class="url"></span>')
  })

  it('escapes html in raw text before substitution', () => {
    const out = renderTemplate('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(out).not.toContain('<script>')
  })

  it('passes unknown placeholder through as literal text', () => {
    const out = renderTemplate('hello {author}')
    expect(out).toContain('hello {author}')
    expect(out).not.toContain('<span class="author"></span>')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/api/optionsMapper.test.ts`
Expected: FAIL with "Cannot find module './optionsMapper'".

- [ ] **Step 3: Implement**

```ts
// src/api/optionsMapper.ts
import {escapeHtml} from '../utils/escapeHtml'

export interface RequestPdfOptions {
  format: string
  landscape: boolean
  margin: {top: string; right: string; bottom: string; left: string}
  displayHeaderFooter: boolean
  headerTemplate: string
  footerTemplate: string
  printBackground: boolean
  css?: string
}

const WRAP_STYLE =
  'font-size:9px;width:100%;padding:0 20mm;color:#666;display:flex;justify-content:center'

const PLACEHOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['{pageNumber}', '<span class="pageNumber"></span>'],
  ['{totalPages}', '<span class="totalPages"></span>'],
  ['{date}', '<span class="date"></span>'],
  ['{title}', '<span class="title"></span>'],
  ['{url}', '<span class="url"></span>'],
]

export const renderTemplate = (raw: string): string => {
  let out = escapeHtml(raw)
  for (const [token, span] of PLACEHOLDERS) {
    out = out.replaceAll(token, span)
  }
  return `<div style="${WRAP_STYLE}">${out}</div>`
}

// toRequestOptions added in next task — keeps this commit focused.
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/api/optionsMapper.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/optionsMapper.ts src/api/optionsMapper.test.ts
git commit -m "feat(api): add renderTemplate for header/footer placeholder substitution"
```

### Task 1.4: optionsMapper.ts — toRequestOptions

**Files:**

- Modify: `src/api/optionsMapper.ts`
- Modify: `src/api/optionsMapper.test.ts`

- [ ] **Step 1: Append failing tests to `src/api/optionsMapper.test.ts`**

```ts
import {toRequestOptions} from './optionsMapper'
import {DEFAULTS, type PdfOptions} from '../types/pdfOptions'

describe('toRequestOptions', () => {
  it('converts margin numerics to mm-suffixed strings', () => {
    const req = toRequestOptions({
      ...DEFAULTS,
      margins: {top: 25, right: 15, bottom: 25, left: 15},
    })
    expect(req.margin).toEqual({
      top: '25mm',
      right: '15mm',
      bottom: '25mm',
      left: '15mm',
    })
  })

  it('passes format and landscape straight through', () => {
    const req = toRequestOptions({...DEFAULTS, format: 'Letter', landscape: true})
    expect(req.format).toBe('Letter')
    expect(req.landscape).toBe(true)
  })

  it('suppresses header/footer when both disabled', () => {
    const req = toRequestOptions(DEFAULTS)
    expect(req.displayHeaderFooter).toBe(false)
    expect(req.headerTemplate).toBe('')
    expect(req.footerTemplate).toBe('')
  })

  it('renders only the enabled side', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      header: {enabled: true, template: 'Top'},
      footer: {enabled: false, template: 'ignored'},
    }
    const req = toRequestOptions(o)
    expect(req.displayHeaderFooter).toBe(true)
    expect(req.headerTemplate).toContain('Top')
    expect(req.footerTemplate).toBe('')
  })

  it('treats enabled-but-empty-template as off', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      header: {enabled: true, template: '   '},
    }
    const req = toRequestOptions(o)
    expect(req.displayHeaderFooter).toBe(false)
    expect(req.headerTemplate).toBe('')
  })

  it('omits css when blank, includes when set', () => {
    expect(toRequestOptions(DEFAULTS).css).toBeUndefined()
    expect(toRequestOptions({...DEFAULTS, css: '   '}).css).toBeUndefined()
    expect(toRequestOptions({...DEFAULTS, css: 'h1{color:red}'}).css).toBe('h1{color:red}')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/api/optionsMapper.test.ts`
Expected: FAIL with "toRequestOptions is not exported".

- [ ] **Step 3: Implement `toRequestOptions`**

In `src/api/optionsMapper.ts`, add an import at the top:

```ts
import type {PdfOptions} from '../types/pdfOptions'
```

Replace the placeholder comment `// toRequestOptions added in next task — keeps this commit focused.` with:

```ts
export const toRequestOptions = (o: PdfOptions): RequestPdfOptions => {
  // A toggle "on" with an empty/whitespace template is treated as off — the
  // user opted in but never typed anything, so there's nothing to show.
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

- [ ] **Step 4: Run all mapper tests**

Run: `npm test -- --run src/api/optionsMapper.test.ts`
Expected: PASS (5 renderTemplate + 6 toRequestOptions = 11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/optionsMapper.ts src/api/optionsMapper.test.ts
git commit -m "feat(api): add toRequestOptions PdfOptions → wire shape mapper"
```

### Task 1.5: summarize utility

**Files:**

- Test: `src/utils/summarize.test.ts`
- Create: `src/utils/summarize.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/summarize.test.ts
import {describe, it, expect} from 'vitest'
import {summarize} from './summarize'
import {DEFAULTS, type PdfOptions} from '../types/pdfOptions'

describe('summarize', () => {
  it('returns "Defaults" when all options match defaults', () => {
    expect(summarize(DEFAULTS)).toBe('Defaults')
  })

  it('renders format change', () => {
    expect(summarize({...DEFAULTS, format: 'Letter'})).toContain('Letter')
  })

  it('renders orientation change', () => {
    expect(summarize({...DEFAULTS, landscape: true})).toContain('Landscape')
  })

  it('renders margin preset change', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      marginPreset: 'wide',
      margins: {top: 30, right: 30, bottom: 30, left: 30},
    }
    expect(summarize(o)).toContain('Wide margins')
  })

  it('flags custom CSS', () => {
    expect(summarize({...DEFAULTS, css: 'h1{color:red}'})).toContain('Custom CSS')
  })

  it('flags an enabled footer', () => {
    const o: PdfOptions = {
      ...DEFAULTS,
      footer: {enabled: true, template: '{pageNumber}'},
    }
    expect(summarize(o)).toContain('Footer')
  })

  it('joins multiple deviations with " · "', () => {
    const o: PdfOptions = {...DEFAULTS, format: 'Letter', landscape: true}
    expect(summarize(o)).toBe('Letter · Landscape')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/utils/summarize.test.ts`
Expected: FAIL with "Cannot find module './summarize'".

- [ ] **Step 3: Implement**

```ts
// src/utils/summarize.ts
import {DEFAULTS, type PdfOptions} from '../types/pdfOptions'

const PRESET_LABEL: Record<PdfOptions['marginPreset'], string> = {
  normal: 'Normal margins',
  narrow: 'Narrow margins',
  wide: 'Wide margins',
  none: 'No margins',
  custom: 'Custom margins',
}

export const summarize = (o: PdfOptions): string => {
  const parts: string[] = []
  if (o.format !== DEFAULTS.format) parts.push(o.format)
  if (o.landscape !== DEFAULTS.landscape) parts.push(o.landscape ? 'Landscape' : 'Portrait')
  if (o.marginPreset !== DEFAULTS.marginPreset) parts.push(PRESET_LABEL[o.marginPreset])
  if (o.header.enabled) parts.push('Header')
  if (o.footer.enabled) parts.push('Footer')
  if (o.css.trim() !== '') parts.push('Custom CSS')
  if (o.printBackground !== DEFAULTS.printBackground) parts.push('BG off')
  return parts.length === 0 ? 'Defaults' : parts.join(' · ')
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run src/utils/summarize.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/summarize.ts src/utils/summarize.test.ts
git commit -m "feat(utils): add summarize for PdfOptions → human-readable line"
```

### Task 1.6: usePdfOptions hook

**Files:**

- Test: `src/hooks/usePdfOptions.test.ts`
- Create: `src/hooks/usePdfOptions.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/usePdfOptions.test.ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {act, renderHook} from '@testing-library/react'
import {usePdfOptions} from './usePdfOptions'
import {DEFAULTS, MARGIN_PRESETS} from '../types/pdfOptions'

const KEY = 'press.options'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('usePdfOptions', () => {
  it('returns DEFAULTS on empty storage', () => {
    const {result} = renderHook(() => usePdfOptions())
    expect(result.current.options).toEqual(DEFAULTS)
  })

  it('merges stored values over DEFAULTS', () => {
    localStorage.setItem(KEY, JSON.stringify({v: 1, options: {...DEFAULTS, format: 'Letter'}}))
    const {result} = renderHook(() => usePdfOptions())
    expect(result.current.options.format).toBe('Letter')
    expect(result.current.options.landscape).toBe(false)
  })

  it('falls back to DEFAULTS on bad JSON', () => {
    localStorage.setItem(KEY, '{not valid json')
    const {result} = renderHook(() => usePdfOptions())
    expect(result.current.options).toEqual(DEFAULTS)
  })

  it('falls back to DEFAULTS on wrong shape', () => {
    localStorage.setItem(KEY, JSON.stringify({v: 1, options: {format: 999}}))
    const {result} = renderHook(() => usePdfOptions())
    expect(result.current.options).toEqual(DEFAULTS)
  })

  it('set() updates a single field', () => {
    const {result} = renderHook(() => usePdfOptions())
    act(() => result.current.set('format', 'Letter'))
    expect(result.current.options.format).toBe('Letter')
  })

  it('set(marginPreset, "narrow") syncs margins to MARGIN_PRESETS.narrow', () => {
    const {result} = renderHook(() => usePdfOptions())
    act(() => result.current.set('marginPreset', 'narrow'))
    expect(result.current.options.marginPreset).toBe('narrow')
    expect(result.current.options.margins).toEqual(MARGIN_PRESETS.narrow)
  })

  it('set(marginPreset, "custom") does not overwrite margins', () => {
    const {result} = renderHook(() => usePdfOptions())
    act(() => result.current.set('margins', {top: 7, right: 7, bottom: 7, left: 7}))
    act(() => result.current.set('marginPreset', 'custom'))
    expect(result.current.options.margins).toEqual({top: 7, right: 7, bottom: 7, left: 7})
    expect(result.current.options.marginPreset).toBe('custom')
  })

  it('setMargin() forces marginPreset to "custom"', () => {
    const {result} = renderHook(() => usePdfOptions())
    expect(result.current.options.marginPreset).toBe('normal')
    act(() => result.current.setMargin('top', 12))
    expect(result.current.options.marginPreset).toBe('custom')
    expect(result.current.options.margins.top).toBe(12)
  })

  it('reset() restores DEFAULTS and clears the storage key', () => {
    const {result} = renderHook(() => usePdfOptions())
    act(() => result.current.set('format', 'Letter'))
    act(() => result.current.reset())
    expect(result.current.options).toEqual(DEFAULTS)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('persists changes to localStorage after debounce', () => {
    const {result} = renderHook(() => usePdfOptions())
    act(() => result.current.set('format', 'Letter'))
    act(() => vi.advanceTimersByTime(250))
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(stored.v).toBe(1)
    expect(stored.options.format).toBe('Letter')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/hooks/usePdfOptions.test.ts`
Expected: FAIL with "Cannot find module './usePdfOptions'".

- [ ] **Step 3: Implement**

```ts
// src/hooks/usePdfOptions.ts
import {useCallback, useEffect, useRef, useState} from 'react'
import {DEFAULTS, MARGIN_PRESETS, type Margins, type PdfOptions} from '../types/pdfOptions'

const STORAGE_KEY = 'press.options'
const STORAGE_VERSION = 1
const DEBOUNCE_MS = 200

export interface UsePdfOptions {
  options: PdfOptions
  set: <K extends keyof PdfOptions>(key: K, value: PdfOptions[K]) => void
  setMargin: (side: keyof Margins, value: number) => void
  reset: () => void
}

// Best-effort shape guard. Any failure → return null so caller falls back.
const isValid = (o: unknown): o is PdfOptions => {
  if (!o || typeof o !== 'object') return false
  const x = o as Partial<PdfOptions>
  return (
    typeof x.format === 'string' &&
    ['A4', 'Letter', 'Legal', 'A3', 'A5'].includes(x.format) &&
    typeof x.landscape === 'boolean' &&
    typeof x.marginPreset === 'string' &&
    !!x.margins &&
    typeof (x.margins as Margins).top === 'number' &&
    !!x.header &&
    typeof x.header.enabled === 'boolean' &&
    typeof x.header.template === 'string' &&
    !!x.footer &&
    typeof x.footer.enabled === 'boolean' &&
    typeof x.footer.template === 'string' &&
    typeof x.printBackground === 'boolean' &&
    typeof x.css === 'string'
  )
}

const load = (): PdfOptions => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as {v?: number; options?: unknown}
    if (parsed.v !== STORAGE_VERSION) return DEFAULTS
    if (!isValid(parsed.options)) return DEFAULTS
    // Merge over DEFAULTS so future-added fields fill in gracefully.
    return {...DEFAULTS, ...parsed.options}
  } catch {
    console.warn('[usePdfOptions] failed to load; using defaults')
    return DEFAULTS
  }
}

export const usePdfOptions = (): UsePdfOptions => {
  const [options, setOptions] = useState<PdfOptions>(load)
  const timer = useRef<number | null>(null)

  // Debounced persist.
  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({v: STORAGE_VERSION, options}))
      } catch {
        // private mode or quota; in-memory state is still authoritative.
      }
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [options])

  const set = useCallback<UsePdfOptions['set']>((key, value) => {
    setOptions((prev) => {
      // Choosing a named preset auto-syncs margins to its canonical values.
      if (key === 'marginPreset' && value !== 'custom' && typeof value === 'string') {
        return {
          ...prev,
          marginPreset: value as PdfOptions['marginPreset'],
          margins: MARGIN_PRESETS[value as Exclude<PdfOptions['marginPreset'], 'custom'>],
        }
      }
      return {...prev, [key]: value}
    })
  }, [])

  const setMargin = useCallback<UsePdfOptions['setMargin']>((side, value) => {
    setOptions((prev) => ({
      ...prev,
      marginPreset: 'custom',
      margins: {...prev.margins, [side]: value},
    }))
  }, [])

  const reset = useCallback<UsePdfOptions['reset']>(() => {
    setOptions(DEFAULTS)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignored
    }
  }, [])

  return {options, set, setMargin, reset}
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/hooks/usePdfOptions.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePdfOptions.ts src/hooks/usePdfOptions.test.ts
git commit -m "feat(hooks): add usePdfOptions with versioned localStorage persistence"
```

### Task 1.7: Thread options through submitContent and useSubmit

**Files:**

- Modify: `src/api/pdfClient.ts`
- Modify: `src/api/pdfClient.test.ts`
- Modify: `src/hooks/useSubmit.ts`
- Modify: `src/hooks/useSubmit.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Append failing tests to `src/api/pdfClient.test.ts`**

Add inside `describe('submitContent', ...)`:

```ts
it('sends options in the body when provided', async () => {
  let captured: {content?: string; options?: unknown} = {}
  server.use(
    http.post(`${API}/pdf`, async ({request}) => {
      captured = (await request.json()) as typeof captured
      return HttpResponse.json(
        {message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'html'},
        {status: 202},
      )
    }),
  )
  const opts = {
    format: 'Letter',
    landscape: true,
    margin: {top: '10mm', right: '10mm', bottom: '10mm', left: '10mm'},
    displayHeaderFooter: false,
    headerTemplate: '',
    footerTemplate: '',
    printBackground: true,
  }
  await submitContent('hello world long enough', API, opts)
  expect(captured.content).toBe('hello world long enough')
  expect(captured.options).toEqual(opts)
})

it('omits options field when not provided', async () => {
  let captured: {content?: string; options?: unknown} = {}
  server.use(
    http.post(`${API}/pdf`, async ({request}) => {
      captured = (await request.json()) as typeof captured
      return HttpResponse.json(
        {message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'html'},
        {status: 202},
      )
    }),
  )
  await submitContent('hello world long enough', API)
  expect(captured.content).toBe('hello world long enough')
  expect('options' in captured).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/api/pdfClient.test.ts`
Expected: FAIL — third arg not accepted.

- [ ] **Step 3: Update `submitContent` signature and body**

In `src/api/pdfClient.ts`:

a) Add import after the existing imports (or at the top):

```ts
import type {RequestPdfOptions} from './optionsMapper'
```

b) Find the function declaration:

```ts
export const submitContent = async (
  content: string,
  baseUrl?: string,
): Promise<SubmitResult> => {
```

Replace with:

```ts
export const submitContent = async (
  content: string,
  baseUrl?: string,
  options?: RequestPdfOptions,
): Promise<SubmitResult> => {
```

c) Find the fetch body inside the same function:

```ts
      body: JSON.stringify({ content }),
```

Replace with:

```ts
      body: JSON.stringify(options ? { content, options } : { content }),
```

- [ ] **Step 4: Run pdfClient tests**

Run: `npm test -- --run src/api/pdfClient.test.ts`
Expected: PASS (5 existing + 2 new = 7 tests).

- [ ] **Step 5: Update `useSubmit` signature and call site**

In `src/hooks/useSubmit.ts`:

a) Add imports near the top:

```ts
import {type PdfOptions} from '../types/pdfOptions'
import {toRequestOptions} from '../api/optionsMapper'
```

b) Find the `UseSubmit` interface:

```ts
export interface UseSubmit {
  state: SubmitState
  submit: (content: string, onSuccess: (r: SubmitResult) => void) => void
}
```

Replace with:

```ts
export interface UseSubmit {
  state: SubmitState
  submit: (content: string, options: PdfOptions, onSuccess: (r: SubmitResult) => void) => void
}
```

c) Find the `submit` callback:

```ts
  const submit = useCallback(
    (content: string, onSuccess: (r: SubmitResult) => void) => {
      // ...
      submitContent(content)
```

Replace the signature and the `submitContent` call:

```ts
  const submit = useCallback(
    (content: string, options: PdfOptions, onSuccess: (r: SubmitResult) => void) => {
      // ...
      submitContent(content, undefined, toRequestOptions(options))
```

Leave the rest of the function body unchanged.

- [ ] **Step 6: Update `useSubmit.test.ts` call sites**

In `src/hooks/useSubmit.test.ts`:

a) Add an import:

```ts
import {DEFAULTS} from '../types/pdfOptions'
```

b) Find each `result.current.submit(...)` call and add `DEFAULTS` as the second argument. The three current call sites are:

```ts
result.current.submit('hello world ten plus chars', onResult)
result.current.submit('content long enough', vi.fn())
result.current.submit('short', vi.fn())
```

After (each call):

```ts
result.current.submit('hello world ten plus chars', DEFAULTS, onResult)
result.current.submit('content long enough', DEFAULTS, vi.fn())
result.current.submit('short', DEFAULTS, vi.fn())
```

(Use grep first to make sure none are missed: `grep -n "result.current.submit" src/hooks/useSubmit.test.ts`. There should be three lines.)

- [ ] **Step 7: Update `App.tsx`**

In `src/App.tsx`:

a) Add imports near the existing imports:

```ts
import {usePdfOptions} from './hooks/usePdfOptions'
```

b) After the existing hook calls inside the `App` component (near `const submit = useSubmit();` and `const poll = usePoll(jobId);`), add:

```ts
const pdfOptions = usePdfOptions()
```

c) Find the `handleSubmit` function:

```ts
const handleSubmit = () => {
  if (!canSubmit) return
  submit.submit(content, (res) => setJobId(res.jobId))
}
```

Replace with:

```ts
const handleSubmit = () => {
  if (!canSubmit) return
  submit.submit(content, pdfOptions.options, (res) => setJobId(res.jobId))
}
```

- [ ] **Step 8: Run the full test suite**

Run: `npm test -- --run`
Expected: all existing tests still pass (25), plus the new ones from this phase.

- [ ] **Step 9: Lint and typecheck**

Run: `npm run lint && npx tsc -b`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/api/pdfClient.ts src/api/pdfClient.test.ts \
        src/hooks/useSubmit.ts src/hooks/useSubmit.test.ts \
        src/App.tsx
git commit -m "feat(api): thread PdfOptions through submitContent and useSubmit"
```

### Phase 1 verification

- [ ] **Run the full gauntlet**

```bash
npm run lint && npx tsc -b && npm test -- --run && npm run build
```

Expected: all green. No UI changes visible yet — the foundation is in place.

---

## Phase 2 — Collapsed bar + format/orientation

Surface the OptionsBar in the UI with one expanded control (format + orientation) plus the full collapsed/expanded mechanism. After this phase, users can change page format and orientation and see them persist + appear in the submit payload end-to-end.

### Task 2.1: Extract generic `.segmented` class from `.theme-switcher`

The new orientation control reuses the segmented-pill pattern. Extract the existing `.theme-switcher` styles into a generic `.segmented` class, and refactor `ThemeSwitcher` to use it.

**Files:**

- Modify: `src/theme.css`
- Modify: `src/components/ThemeSwitcher.tsx`

- [ ] **Step 1: Locate current theme-switcher rules**

Run: `grep -n "theme-switcher" src/theme.css`
Note the line range of the existing block so you can delete it after copying.

- [ ] **Step 2: Add the generic `.segmented` styles**

Insert this block in `src/theme.css` immediately **above** the existing `theme switcher — segmented pill` block:

```css
/* ============================================================ */
/*  segmented — generic pill with a sliding indicator            */
/* ============================================================ */
.segmented {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 3px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
}
.segmented__indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  height: 22px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow:
    0 4px 14px -4px var(--accent-glow),
    0 0 0 1px rgba(155, 204, 75, 0.45) inset;
  transition:
    transform 340ms cubic-bezier(0.4, 1.2, 0.35, 1),
    width 240ms var(--ease);
  z-index: 0;
  pointer-events: none;
}
.segmented__opt {
  position: relative;
  z-index: 1;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 999px;
  padding: 0 10px;
  font-family: var(--sans);
  font-size: 12px;
  font-variation-settings:
    'wdth' 100,
    'wght' 500;
  letter-spacing: -0.005em;
  transition: color 220ms var(--ease);
}
.segmented__opt:hover:not(.is-active) {
  color: var(--fg-2);
}
.segmented__opt.is-active {
  color: var(--accent-ink);
}
.segmented__opt:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.segmented__opt svg {
  transition: transform 220ms var(--ease);
}
.segmented__opt:hover:not(.is-active) svg {
  transform: scale(1.1);
}

/* Icon-only variant (theme switcher uses this). */
.segmented--icons .segmented__opt {
  width: 26px;
  padding: 0;
}
.segmented--icons .segmented__indicator {
  width: 26px;
}

/* Two-slot text variant (orientation uses this). */
.segmented--two {
  width: 160px;
}
.segmented--two .segmented__opt {
  flex: 1;
  min-width: 0;
  padding: 0;
}
.segmented--two .segmented__indicator {
  width: calc(50% - 3px);
}
```

- [ ] **Step 3: Delete the old `.theme-switcher` CSS block**

Remove the entire block starting at `/* theme switcher — segmented pill */` (or `/* ============================================================ */` + `/*  theme switcher — segmented pill                              */` if that comment block is present) and ending at the closing brace of `.theme-switcher__opt:focus-visible`.

- [ ] **Step 4: Refactor `ThemeSwitcher` to use generic classes**

In `src/components/ThemeSwitcher.tsx`, replace class names:

- `theme-switcher` → `segmented segmented--icons`
- `theme-switcher__indicator` → `segmented__indicator`
- `theme-switcher__opt` → `segmented__opt`

The container line becomes:

```tsx
<div className="segmented segmented--icons" role="radiogroup" aria-label="Theme">
```

The indicator line stays structurally the same — only its className changes:

```tsx
<span
  className="segmented__indicator"
  style={{transform: `translateX(${activeIdx * 26}px)`}}
  aria-hidden="true"
/>
```

Each button:

```tsx
<button
  ...
  className={`segmented__opt${theme === value ? ' is-active' : ''}`}
  ...
>
```

- [ ] **Step 5: Run lint + tests**

Run: `npm run lint && npm test -- --run`
Expected: clean lint, 25 existing tests still pass.

- [ ] **Step 6: Manual visual check**

Run `npm run dev` in one terminal. Visit the printed local URL. Verify:

- Theme switcher in the masthead-meta renders identically to before (icon-only pill, three slots, sliding lime thumb).
- Click each slot → Light / Auto / Dark all switch correctly.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/theme.css src/components/ThemeSwitcher.tsx
git commit -m "refactor(ui): extract generic .segmented class from theme-switcher"
```

### Task 2.2: PageFormatControl

**Files:**

- Create: `src/components/OptionsBar/PageFormatControl.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/OptionsBar/PageFormatControl.tsx
import type {PageFormat} from '../../types/pdfOptions'

interface Props {
  format: PageFormat
  landscape: boolean
  onFormatChange: (f: PageFormat) => void
  onOrientationChange: (landscape: boolean) => void
}

const FORMATS: PageFormat[] = ['A4', 'Letter', 'Legal', 'A3', 'A5']

export const PageFormatControl = ({
  format,
  landscape,
  onFormatChange,
  onOrientationChange,
}: Props) => {
  const idx = landscape ? 1 : 0
  return (
    <div className="opt-row">
      <span className="opt-label">Format</span>
      <select
        className="opt-select"
        value={format}
        onChange={(e) => onFormatChange(e.target.value as PageFormat)}
        aria-label="Page format"
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <div className="segmented segmented--two" role="radiogroup" aria-label="Orientation">
        <span
          className="segmented__indicator"
          style={{transform: `translateX(${idx * 100}%)`}}
          aria-hidden="true"
        />
        <button
          type="button"
          role="radio"
          aria-checked={!landscape}
          className={`segmented__opt${!landscape ? ' is-active' : ''}`}
          onClick={() => onOrientationChange(false)}
        >
          Portrait
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={landscape}
          className={`segmented__opt${landscape ? ' is-active' : ''}`}
          onClick={() => onOrientationChange(true)}
        >
          Landscape
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/OptionsBar/PageFormatControl.tsx
git commit -m "feat(ui): add PageFormatControl (format select + orientation segmented)"
```

### Task 2.3: OptionsBar shell, CSS, and wiring

**Files:**

- Create: `src/components/OptionsBar/OptionsBar.tsx`
- Create: `src/components/OptionsBar/index.ts`
- Modify: `src/theme.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the barrel export**

```ts
// src/components/OptionsBar/index.ts
export {OptionsBar} from './OptionsBar'
```

- [ ] **Step 2: Implement the OptionsBar shell**

```tsx
// src/components/OptionsBar/OptionsBar.tsx
import {useState} from 'react'
import type {UsePdfOptions} from '../../hooks/usePdfOptions'
import {DEFAULTS} from '../../types/pdfOptions'
import {summarize} from '../../utils/summarize'
import {PageFormatControl} from './PageFormatControl'

interface Props {
  pdf: UsePdfOptions
}

const isDefault = (opts: typeof DEFAULTS): boolean =>
  JSON.stringify(opts) === JSON.stringify(DEFAULTS)

const EXPANDED_KEY = 'press.options.expanded'

export const OptionsBar = ({pdf}: Props) => {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(EXPANDED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [confirmingReset, setConfirmingReset] = useState(false)

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    try {
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0')
    } catch {
      // ignored
    }
  }

  const dirty = !isDefault(pdf.options)
  const summary = summarize(pdf.options)

  return (
    <section className={`options-bar${expanded ? ' is-expanded' : ''}`} aria-label="PDF options">
      <button type="button" className="options-bar__head" aria-expanded={expanded} onClick={toggle}>
        <span className={`options-bar__dot${dirty ? ' is-dirty' : ''}`} aria-hidden="true" />
        <span className="options-bar__title">Options</span>
        <span className="options-bar__summary">{summary}</span>
        <span className="options-bar__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      <div className="options-bar__body" aria-hidden={!expanded}>
        <div className="options-bar__inner">
          <PageFormatControl
            format={pdf.options.format}
            landscape={pdf.options.landscape}
            onFormatChange={(f) => pdf.set('format', f)}
            onOrientationChange={(l) => pdf.set('landscape', l)}
          />

          {/* future controls render here: Margins, Header, Footer, CSS */}

          <div className="options-bar__footer">
            {confirmingReset ? (
              <span className="options-bar__confirm">
                Reset all to defaults?
                <button
                  type="button"
                  className="options-bar__confirm-yes"
                  onClick={() => {
                    pdf.reset()
                    setConfirmingReset(false)
                  }}
                >
                  yes
                </button>
                <button
                  type="button"
                  className="options-bar__confirm-no"
                  onClick={() => setConfirmingReset(false)}
                >
                  cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="options-bar__reset"
                onClick={() => setConfirmingReset(true)}
                disabled={!dirty}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Add CSS for the OptionsBar**

Append to `src/theme.css`:

```css
/* ============================================================ */
/*  options bar — collapsible PDF settings                       */
/* ============================================================ */
.options-bar {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 0fr;
  transition:
    grid-template-rows 240ms var(--ease),
    border-color 220ms var(--ease);
}
.options-bar.is-expanded {
  grid-template-rows: auto 1fr;
}

.options-bar__head {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  background: transparent;
  border: 0;
  padding: 10px 14px 10px 12px;
  cursor: pointer;
  font-family: var(--sans);
  color: var(--fg-2);
  text-align: left;
  font-size: 13px;
}
.options-bar__head:hover {
  color: var(--fg);
}

.options-bar__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--faint);
  flex: none;
  transition:
    background-color 220ms var(--ease),
    box-shadow 220ms var(--ease);
}
.options-bar__dot.is-dirty {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
}

.options-bar__title {
  font-variation-settings:
    'wdth' 100,
    'wght' 580;
  font-size: 12.5px;
  color: var(--fg);
  letter-spacing: -0.005em;
}
.options-bar__summary {
  font-family: var(--mono);
  font-size: 11.5px;
  color: var(--muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.options-bar__caret {
  font-size: 11px;
  color: var(--muted);
  transition: transform 240ms var(--ease);
}
.options-bar.is-expanded .options-bar__caret {
  transform: rotate(180deg);
}

.options-bar__body {
  overflow: hidden;
}
.options-bar__inner {
  padding: 16px 18px 18px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.opt-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.opt-label {
  font-family: var(--sans);
  font-variation-settings:
    'wdth' 100,
    'wght' 500;
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  min-width: 64px;
}
.opt-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--surface-2);
  color: var(--fg);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 5px 28px 6px 10px;
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--muted) 50%),
    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position:
    calc(100% - 14px) 50%,
    calc(100% - 10px) 50%;
  background-size: 4px 4px;
  background-repeat: no-repeat;
  transition:
    border-color 200ms var(--ease),
    background 200ms var(--ease);
}
.opt-select:hover {
  border-color: var(--line-strong);
}
.opt-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.options-bar__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  border-top: 1px dashed var(--line);
  padding-top: 12px;
}
.options-bar__reset {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11.5px;
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 200ms var(--ease),
    border-color 200ms var(--ease),
    background 200ms var(--ease);
}
.options-bar__reset:hover:not(:disabled) {
  color: var(--fg);
  border-color: var(--warn);
}
.options-bar__reset:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.options-bar__confirm {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11.5px;
  color: var(--muted);
}
.options-bar__confirm-yes,
.options-bar__confirm-no {
  background: transparent;
  border: 0;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 2px 4px;
}
.options-bar__confirm-yes {
  color: var(--warn);
}
.options-bar__confirm-no {
  color: var(--muted);
}
.options-bar__confirm-yes:hover {
  color: var(--warn-2);
}
.options-bar__confirm-no:hover {
  color: var(--fg);
}
```

- [ ] **Step 4: Add `.options-bar` to the staggered entry animation**

In `src/theme.css`, find the entry-animation block:

```css
.masthead,
.tab-row,
.surface,
.actions,
.hint {
  animation: rise 560ms var(--ease) both;
}
.masthead {
  animation-delay: 0ms;
}
.tab-row {
  animation-delay: 90ms;
}
.surface {
  animation-delay: 170ms;
}
.actions {
  animation-delay: 260ms;
}
.hint {
  animation-delay: 330ms;
}
```

Replace with:

```css
.masthead,
.tab-row,
.options-bar,
.surface,
.actions,
.hint {
  animation: rise 560ms var(--ease) both;
}
.masthead {
  animation-delay: 0ms;
}
.tab-row {
  animation-delay: 80ms;
}
.options-bar {
  animation-delay: 140ms;
}
.surface {
  animation-delay: 210ms;
}
.actions {
  animation-delay: 290ms;
}
.hint {
  animation-delay: 360ms;
}
```

- [ ] **Step 5: Render `OptionsBar` in `App.tsx`**

In `src/App.tsx`:

a) Add an import next to the other component imports:

```tsx
import {OptionsBar} from './components/OptionsBar'
```

b) Find the closing tag of the tab-row `<div>` followed by the surface `<div>`:

```tsx
      </div>

      <div
        className={`surface${isDragOver ? ' dragover' : ''}${...}`}
```

Insert `<OptionsBar pdf={pdfOptions} />` between them:

```tsx
      </div>

      <OptionsBar pdf={pdfOptions} />

      <div
        className={`surface${...}`}
```

- [ ] **Step 6: Run lint, typecheck, tests**

Run: `npm run lint && npx tsc -b && npm test -- --run`
Expected: all green; 25 existing tests still pass.

- [ ] **Step 7: Manual dev-server check**

Run `npm run dev`. Verify:

- The Options bar appears between the tabs row and the editor card.
- Collapsed view shows `◇ Options Defaults ▾` (gray dot, "Defaults" summary).
- Click the header → it expands smoothly, revealing the Format select + Portrait/Landscape segmented.
- Change format to `Letter` → summary line shows `Letter`, the `◇` dot turns lime.
- Toggle orientation → segmented thumb slides.
- Reload the page → expanded state persists, options persist.
- Click Reset → confirm "yes" → all back to defaults.

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/components/OptionsBar/OptionsBar.tsx \
        src/components/OptionsBar/index.ts \
        src/theme.css \
        src/App.tsx
git commit -m "feat(ui): add OptionsBar shell with format/orientation control"
```

### Task 2.4: Integration test — format sent in body

**Files:**

- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add localStorage cleanup**

In `src/App.test.tsx`, find the existing `afterEach` block:

```ts
afterEach(() => {
  pollHits = 0
  server.resetHandlers()
})
```

Replace with:

```ts
afterEach(() => {
  pollHits = 0
  server.resetHandlers()
  localStorage.clear()
})
```

This prevents Phase-1 persistence from leaking between tests.

- [ ] **Step 2: Add the new integration test**

Add inside `describe('App full flow', ...)`:

```ts
it('sends options.format in body when user changes format', async () => {
  let captured: { content?: string; options?: { format?: string; landscape?: boolean } } = {};
  server.use(
    http.post(`${API}/pdf`, async ({ request }) => {
      captured = (await request.json()) as typeof captured;
      return HttpResponse.json(
        { message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'html' },
        { status: 202 },
      );
    }),
  );

  const user = userEvent.setup();
  render(<App />);

  const editor = screen.getByPlaceholderText(/Write or paste/i);
  await user.type(editor, '# Hello world test content');

  // Expand the options bar
  await user.click(screen.getByRole('button', { name: /options/i }));

  // Change format to Letter
  const formatSelect = screen.getByLabelText(/page format/i) as HTMLSelectElement;
  await user.selectOptions(formatSelect, 'Letter');

  await user.click(screen.getByRole('button', { name: /^Press/i }));
  await screen.findByRole('link', { name: /download pdf/i }, { timeout: 8000 });

  expect(captured.options?.format).toBe('Letter');
});
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS (3 existing + 1 new = 4).

- [ ] **Step 4: Commit**

```bash
git add src/App.test.tsx
git commit -m "test(app): cover options.format in submit body"
```

### Phase 2 verification

- [ ] **Run the full gauntlet**

```bash
npm run lint && npx tsc -b && npm test -- --run && npm run build
```

Expected: all green. The OptionsBar is live with format and orientation working end-to-end.

---

## Phase 3 — Margins

Add the margins control with preset chips and four numeric inputs.

### Task 3.1: MarginsControl component

**Files:**

- Create: `src/components/OptionsBar/MarginsControl.tsx`
- Modify: `src/components/OptionsBar/OptionsBar.tsx`
- Modify: `src/theme.css`

- [ ] **Step 1: Implement `MarginsControl`**

```tsx
// src/components/OptionsBar/MarginsControl.tsx
import type {Margins, MarginPreset} from '../../types/pdfOptions'

interface Props {
  preset: MarginPreset
  margins: Margins
  onPresetChange: (p: MarginPreset) => void
  onMarginChange: (side: keyof Margins, value: number) => void
}

const PRESETS: {value: MarginPreset; label: string}[] = [
  {value: 'normal', label: 'Normal'},
  {value: 'narrow', label: 'Narrow'},
  {value: 'wide', label: 'Wide'},
  {value: 'none', label: 'None'},
  {value: 'custom', label: 'Custom'},
]

const SIDES: {key: keyof Margins; label: string}[] = [
  {key: 'top', label: 'T'},
  {key: 'right', label: 'R'},
  {key: 'bottom', label: 'B'},
  {key: 'left', label: 'L'},
]

export const MarginsControl = ({preset, margins, onPresetChange, onMarginChange}: Props) => {
  const disabled = preset === 'none'
  return (
    <div className="opt-row opt-row--stack">
      <div className="opt-row">
        <span className="opt-label">Margins</span>
        <div className="opt-chips" role="radiogroup" aria-label="Margin preset">
          {PRESETS.map(({value, label}) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={preset === value}
              className={`opt-chip${preset === value ? ' is-active' : ''}`}
              onClick={() => onPresetChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="opt-margin-inputs">
        {SIDES.map(({key, label}) => (
          <label key={key} className="opt-margin-field">
            <span className="opt-margin-label">{label}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={margins[key]}
              disabled={disabled}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isNaN(v)) onMarginChange(key, Math.max(0, Math.min(100, v)))
              }}
              aria-label={`Margin ${key} in mm`}
            />
          </label>
        ))}
        <span className="opt-margin-unit">mm</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add CSS**

Append to `src/theme.css`:

```css
.opt-row--stack {
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.opt-chips {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 999px;
}
.opt-chip {
  background: transparent;
  border: 0;
  border-radius: 999px;
  padding: 4px 12px;
  font-family: var(--mono);
  font-size: 11.5px;
  color: var(--muted);
  cursor: pointer;
  transition:
    background 200ms var(--ease),
    color 200ms var(--ease);
}
.opt-chip:hover:not(.is-active) {
  color: var(--fg-2);
}
.opt-chip.is-active {
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow:
    0 0 0 1px rgba(155, 204, 75, 0.45) inset,
    0 0 14px -4px var(--accent-glow);
}
.opt-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.opt-margin-inputs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 78px;
}
.opt-margin-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.opt-margin-label {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  width: 10px;
}
.opt-margin-field input {
  width: 52px;
  background: var(--surface-2);
  color: var(--fg);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 4px 6px;
  font-family: var(--mono);
  font-size: 12px;
  -moz-appearance: textfield;
}
.opt-margin-field input::-webkit-outer-spin-button,
.opt-margin-field input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.opt-margin-field input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.opt-margin-field input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.opt-margin-unit {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  margin-left: 4px;
}
```

- [ ] **Step 3: Wire into `OptionsBar`**

In `src/components/OptionsBar/OptionsBar.tsx`:

a) Add import next to the existing `PageFormatControl` import:

```tsx
import {MarginsControl} from './MarginsControl'
```

b) Find the comment marker `{/* future controls render here: Margins, Header, Footer, CSS */}` and replace it (and insert below `<PageFormatControl ... />`) with:

```tsx
;<MarginsControl
  preset={pdf.options.marginPreset}
  margins={pdf.options.margins}
  onPresetChange={(p) => pdf.set('marginPreset', p)}
  onMarginChange={pdf.setMargin}
/>

{
  /* future controls render here: Header, Footer, CSS */
}
```

- [ ] **Step 4: Verify lint + typecheck + tests**

Run: `npm run lint && npx tsc -b && npm test -- --run`
Expected: all green.

- [ ] **Step 5: Manual dev check**

Run `npm run dev`. Verify:

- All five chips render. Active chip has the lime fill.
- Click `Narrow` → all four mm inputs update to 10.
- Type a new value into Top → preset switches to `Custom` automatically; other three stay where they were.
- Click `None` → inputs go to 0 and become disabled.
- Reload → values persist.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/OptionsBar/MarginsControl.tsx \
        src/components/OptionsBar/OptionsBar.tsx \
        src/theme.css
git commit -m "feat(ui): add MarginsControl with presets and custom mm inputs"
```

---

## Phase 4 — Headers & footers

Header and footer controls with clickable placeholder chips.

### Task 4.1: PlaceholderChips component

**Files:**

- Create: `src/components/OptionsBar/PlaceholderChips.tsx`
- Modify: `src/theme.css`

- [ ] **Step 1: Implement**

```tsx
// src/components/OptionsBar/PlaceholderChips.tsx
import type {RefObject} from 'react'

interface Props {
  inputRef: RefObject<HTMLInputElement | null>
  onInsert: (next: string) => void
}

const TOKENS = ['{pageNumber}', '{totalPages}', '{date}', '{title}', '{url}']

export const PlaceholderChips = ({inputRef, onInsert}: Props) => {
  const insert = (token: string) => {
    const el = inputRef.current
    if (!el) {
      onInsert(token)
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + token + el.value.slice(end)
    onInsert(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="opt-chips opt-chips--inline" role="toolbar" aria-label="Placeholders">
      {TOKENS.map((t) => (
        <button key={t} type="button" className="opt-chip-token" onClick={() => insert(t)}>
          {t}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: CSS**

Append to `src/theme.css`:

```css
.opt-chips--inline {
  background: transparent;
  border: 0;
  padding: 0;
  gap: 6px;
  flex-wrap: wrap;
}
.opt-chip-token {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 2px 6px;
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--muted);
  cursor: pointer;
  transition:
    color 200ms var(--ease),
    border-color 200ms var(--ease),
    background 200ms var(--ease);
}
.opt-chip-token:hover {
  color: var(--fg);
  border-color: var(--accent);
  background: var(--accent-soft);
}
```

- [ ] **Step 3: Commit (provisional — consumer arrives next task)**

```bash
git add src/components/OptionsBar/PlaceholderChips.tsx src/theme.css
git commit -m "feat(ui): add PlaceholderChips for header/footer placeholder inserter"
```

### Task 4.2: HeaderFooterControl

**Files:**

- Create: `src/components/OptionsBar/HeaderFooterControl.tsx`
- Modify: `src/components/OptionsBar/OptionsBar.tsx`
- Modify: `src/theme.css`

- [ ] **Step 1: Implement**

```tsx
// src/components/OptionsBar/HeaderFooterControl.tsx
import {useRef} from 'react'
import {HEADER_TEMPLATE_MAX_LENGTH} from '../../types/pdfOptions'
import {PlaceholderChips} from './PlaceholderChips'

interface Props {
  label: 'Header' | 'Footer'
  enabled: boolean
  template: string
  onEnabledChange: (enabled: boolean) => void
  onTemplateChange: (t: string) => void
}

export const HeaderFooterControl = ({
  label,
  enabled,
  template,
  onEnabledChange,
  onTemplateChange,
}: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="opt-row opt-row--stack">
      <div className="opt-row">
        <span className="opt-label">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={`opt-toggle${enabled ? ' is-on' : ''}`}
          onClick={() => onEnabledChange(!enabled)}
        >
          <span className="opt-toggle__knob" />
        </button>
        <input
          ref={inputRef}
          type="text"
          className="opt-text"
          value={template}
          onChange={(e) => onTemplateChange(e.target.value.slice(0, HEADER_TEMPLATE_MAX_LENGTH))}
          placeholder={label === 'Footer' ? '{pageNumber} / {totalPages}' : 'My Document'}
          disabled={!enabled}
          aria-label={`${label} template`}
          maxLength={HEADER_TEMPLATE_MAX_LENGTH}
        />
      </div>
      {enabled && <PlaceholderChips inputRef={inputRef} onInsert={onTemplateChange} />}
    </div>
  )
}
```

- [ ] **Step 2: CSS for toggle + text input**

Append to `src/theme.css`:

```css
.opt-toggle {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface-2);
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    background 220ms var(--ease),
    border-color 220ms var(--ease);
}
.opt-toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--muted);
  transition:
    transform 220ms var(--ease),
    background 220ms var(--ease);
}
.opt-toggle.is-on {
  background: var(--accent);
  border-color: var(--accent);
}
.opt-toggle.is-on .opt-toggle__knob {
  transform: translateX(14px);
  background: var(--accent-ink);
}
.opt-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.opt-text {
  flex: 1;
  min-width: 0;
  background: var(--surface-2);
  color: var(--fg);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 10px 7px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0;
  transition: border-color 200ms var(--ease);
}
.opt-text:hover:not(:disabled) {
  border-color: var(--line-strong);
}
.opt-text:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.opt-text:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Wire two instances into `OptionsBar`**

In `src/components/OptionsBar/OptionsBar.tsx`:

a) Add import:

```tsx
import {HeaderFooterControl} from './HeaderFooterControl'
```

b) Find the comment marker `{/* future controls render here: Header, Footer, CSS */}` and replace it with:

```tsx
<HeaderFooterControl
  label="Header"
  enabled={pdf.options.header.enabled}
  template={pdf.options.header.template}
  onEnabledChange={(e) => pdf.set('header', { ...pdf.options.header, enabled: e })}
  onTemplateChange={(t) => pdf.set('header', { ...pdf.options.header, template: t })}
/>
<HeaderFooterControl
  label="Footer"
  enabled={pdf.options.footer.enabled}
  template={pdf.options.footer.template}
  onEnabledChange={(e) => pdf.set('footer', { ...pdf.options.footer, enabled: e })}
  onTemplateChange={(t) => pdf.set('footer', { ...pdf.options.footer, template: t })}
/>

{/* future controls render here: CSS */}
```

- [ ] **Step 4: Verify lint + typecheck + tests**

Run: `npm run lint && npx tsc -b && npm test -- --run`
Expected: all green.

- [ ] **Step 5: Manual dev check**

Run `npm run dev`. Verify:

- Both Header and Footer rows render, toggles default to off.
- Toggle Header on → text input becomes editable + placeholder chips appear.
- Type `Title:` and then click `{title}` chip → input shows `Title: {title}` with caret correctly placed.
- Toggle off → input dims and disables; chips disappear.
- Reload → state persists.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/OptionsBar/HeaderFooterControl.tsx \
        src/components/OptionsBar/OptionsBar.tsx \
        src/theme.css
git commit -m "feat(ui): add HeaderFooterControl with template input and placeholder chips"
```

---

## Phase 5 — Custom CSS

Final control: expandable textarea with character cap. Submit is gated when the CSS is over the cap.

### Task 5.1: CustomCssControl + submit gating

**Files:**

- Create: `src/components/OptionsBar/CustomCssControl.tsx`
- Modify: `src/components/OptionsBar/OptionsBar.tsx`
- Modify: `src/theme.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement `CustomCssControl`**

```tsx
// src/components/OptionsBar/CustomCssControl.tsx
import {useState, type KeyboardEvent} from 'react'
import {CSS_MAX_LENGTH} from '../../types/pdfOptions'

interface Props {
  value: string
  onChange: (v: string) => void
}

export const CustomCssControl = ({value, onChange}: Props) => {
  const [expanded, setExpanded] = useState(value.length > 0)
  const count = value.length
  const overCap = count > CSS_MAX_LENGTH
  const nearCap = !overCap && count >= CSS_MAX_LENGTH * 0.9

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      onChange(value.slice(0, start) + '  ' + value.slice(end))
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2
      })
    }
  }

  if (!expanded) {
    return (
      <div className="opt-row">
        <span className="opt-label">CSS</span>
        <button type="button" className="opt-link" onClick={() => setExpanded(true)}>
          ▸ add stylesheet
        </button>
      </div>
    )
  }

  return (
    <div className="opt-row opt-row--stack">
      <div className="opt-row">
        <span className="opt-label">CSS</span>
        <button type="button" className="opt-link" onClick={() => setExpanded(false)}>
          ▾ hide
        </button>
      </div>
      <div className="opt-css-wrap">
        <textarea
          className="opt-css"
          rows={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/* additional stylesheet sent with the PDF */"
          spellCheck={false}
          aria-label="Custom CSS"
        />
        <div
          className={`opt-css-count${overCap ? ' is-over' : ''}${nearCap ? ' is-near' : ''}`}
          aria-live="polite"
        >
          {count.toLocaleString()} / {CSS_MAX_LENGTH.toLocaleString()}
          {overCap && <span> · over cap</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CSS for the textarea + counter**

Append to `src/theme.css`:

```css
.opt-link {
  background: transparent;
  border: 0;
  padding: 0;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: color 200ms var(--ease);
}
.opt-link:hover {
  color: var(--accent);
}

.opt-css-wrap {
  position: relative;
  width: 100%;
  padding-left: 78px;
}
.opt-css {
  width: 100%;
  background: var(--surface-2);
  color: var(--fg);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.65;
  resize: vertical;
  min-height: 120px;
  caret-color: var(--accent);
}
.opt-css::placeholder {
  color: var(--faint);
}
.opt-css::selection {
  background: var(--accent-soft);
  color: var(--fg);
}
.opt-css:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.opt-css-count {
  position: absolute;
  right: 10px;
  bottom: 10px;
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--faint);
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
}
.opt-css-count.is-near {
  color: var(--warn);
}
.opt-css-count.is-over {
  color: var(--danger);
}
```

- [ ] **Step 3: Wire into `OptionsBar`**

In `src/components/OptionsBar/OptionsBar.tsx`:

a) Add import:

```tsx
import {CustomCssControl} from './CustomCssControl'
```

b) Find `{/* future controls render here: CSS */}` and replace with:

```tsx
<CustomCssControl value={pdf.options.css} onChange={(v) => pdf.set('css', v)} />
```

- [ ] **Step 4: Gate Submit on CSS length in `App.tsx`**

In `src/App.tsx`:

a) Add to the import group:

```tsx
import {CSS_MAX_LENGTH} from './types/pdfOptions'
```

b) Find the `canSubmit` derivation:

```tsx
const canSubmit =
  lengthValid &&
  submit.state.phase !== 'submitting' &&
  submit.state.phase !== 'rate_limited' &&
  poll.phase !== 'polling'
```

Replace with:

```tsx
const cssWithinCap = pdfOptions.options.css.length <= CSS_MAX_LENGTH
const canSubmit =
  lengthValid &&
  cssWithinCap &&
  submit.state.phase !== 'submitting' &&
  submit.state.phase !== 'rate_limited' &&
  poll.phase !== 'polling'
```

- [ ] **Step 5: Verify lint + typecheck + tests**

Run: `npm run lint && npx tsc -b && npm test -- --run`
Expected: all green.

- [ ] **Step 6: Manual dev check**

Run `npm run dev`. Verify:

- Bottom of the expanded panel shows `CSS · ▸ add stylesheet`.
- Click → textarea reveals with placeholder.
- Type CSS → caret is lime, counter updates as you type.
- Paste a block to push past 4,500 chars → counter colour shifts to warn.
- Paste past 5,000 chars → counter shifts to danger; the Press button disables.
- Trim back below 5,000 → Press re-enables.
- Press `Tab` in the textarea → two spaces inserted, no focus change.
- Submit → request body includes `options.css`.
- Reload → CSS persists and the textarea stays expanded if there's content.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/components/OptionsBar/CustomCssControl.tsx \
        src/components/OptionsBar/OptionsBar.tsx \
        src/theme.css \
        src/App.tsx
git commit -m "feat(ui): add CustomCssControl with character cap and submit gating"
```

---

## Final verification

- [ ] **Run the full gauntlet**

```bash
npm run lint && npx tsc -b && npm test -- --run && npm run build
```

Expected: all green, all tests pass, gzipped JS bundle remains well under 100 KB.

- [ ] **End-to-end manual smoke**

Run `npm run dev` and walk the full flow:

1. Open the page; verify the bar renders with `Defaults` summary, gray dot.
2. Expand it. Change format to `Letter`, orientation to `Landscape`. Summary updates; dot turns lime.
3. Pick `Narrow` margins → all four inputs reflect `10`.
4. Toggle Footer on; type `Made with `, click `{date}` chip → field reads `Made with {date}`.
5. Open the CSS panel; type `h1 { color: #b5e368; }`.
6. Click Press → status shows `Submitting.` then `Rendering.` then `Ready.` with a download link.
7. Reload the page → the bar starts expanded, all your options are still set.
8. Click `Reset` → confirm `yes` → everything returns to defaults; dot greys; bar collapses if you collapse it.

Stop the dev server.

- [ ] **Done**

The plan ends here. No follow-on tasks unless the open questions in the spec (mm vs in, CSS cap, exact backend field names) trigger adjustments.
