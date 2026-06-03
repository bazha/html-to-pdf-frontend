# Page Break Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark page breaks in editor content via a literal `<!-- page-break -->` comment, inserted by a toolbar button or typed by hand; render the break visually in the Preview pane and transform it into Chromium-honored `break-before: page` CSS at the wire boundary.

**Architecture:** A pure utility `transformPageBreaks(s)` replaces the literal comment with a styled `<div>` and is called at two seams — `Preview.tsx` (before sanitization) and `useSubmit.ts` (before POST). Editor state stays as raw user text. Editor gains a thin toolbar above the textarea; insertion happens at cursor via a ref (same pattern as `PlaceholderChips` → `HeaderFooterControl`).

**Tech Stack:** React 19 · TypeScript · Vitest 4 + @testing-library/react · MSW · DOMPurify (existing). No new dependencies. Code style: Prettier — 4-space indent, no semicolons, no bracket spacing, single quotes.

---

## File structure

**Create**

- `src/utils/pageBreaks.ts` — pure transform: `transformPageBreaks(s: string): string`.
- `src/utils/pageBreaks.test.ts` — 7 unit tests (incl. DOMPurify survival).
- `src/components/EditorToolbar.tsx` — presentational toolbar with one button.

**Modify**

- `src/components/Editor.tsx` — render `<EditorToolbar />` above the textarea; expose cursor-insert handler.
- `src/components/Preview.tsx` — call transform before render; add `.pdf-page-break` styles to `PREVIEW_STYLES`.
- `src/hooks/useSubmit.ts` — call transform before `submitContent(...)`.
- `src/theme.css` — add `.editor-toolbar` and button styles.
- `src/App.test.tsx` — 2 new integration tests.

**Branch:** create and work on `feat/page-break-controls` off `main`. Open PR back to `main` when done.

**Pre-commit gate (per CLAUDE.md):** `npm run lint`, `npm test`, `npm run format:check` must all be green before any commit.

---

## Task 0: Create feature branch

**Files:** none (branch only).

- [ ] **Step 1: Create and switch**

Run from `/Users/arthur/Documents/work/html-to-pdf-frontend`:

```bash
git checkout main && git pull origin main && git checkout -b feat/page-break-controls
```

Expected: switched to a new branch.

- [ ] **Step 2: Verify clean tree and green baseline**

```bash
git status                    # clean
npx vitest run                # 82 passed
npx tsc -b                    # no output
npx eslint src/               # no output
npx prettier --check .        # all matched files use Prettier code style
```

---

## Task 1: `transformPageBreaks` utility (TDD)

**Files:**

- Create: `src/utils/pageBreaks.ts`
- Test: `src/utils/pageBreaks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/pageBreaks.test.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {transformPageBreaks} from './pageBreaks'
import {sanitizeHtml} from './renderMarkdown'

describe('transformPageBreaks', () => {
  it('returns empty string unchanged', () => {
    expect(transformPageBreaks('')).toBe('')
  })

  it('returns text with no comment unchanged', () => {
    expect(transformPageBreaks('hello world')).toBe('hello world')
  })

  it('replaces the canonical comment with a styled div', () => {
    const out = transformPageBreaks('<!-- page-break -->')
    expect(out).toContain('class="pdf-page-break"')
    expect(out).toContain('break-before: page')
    expect(out).toContain('page-break-before: always')
  })

  it('replaces every occurrence across multiple lines', () => {
    const input = 'a\n<!-- page-break -->\nb\n<!-- page-break -->\nc'
    const out = transformPageBreaks(input)
    const matches = out.match(/class="pdf-page-break"/g) ?? []
    expect(matches.length).toBe(2)
  })

  it('tolerates extra whitespace and mixed case', () => {
    expect(transformPageBreaks('<!--   page-break   -->')).toContain('class="pdf-page-break"')
    expect(transformPageBreaks('<!-- PAGE-BREAK -->')).toContain('class="pdf-page-break"')
  })

  it('leaves unrelated HTML comments alone', () => {
    const out = transformPageBreaks('<!-- not a page break -->')
    expect(out).toBe('<!-- not a page break -->')
  })

  it('the produced div survives DOMPurify sanitization', () => {
    const dirty = transformPageBreaks('<!-- page-break -->')
    const clean = sanitizeHtml(dirty)
    expect(clean).toContain('pdf-page-break')
    expect(clean).toContain('break-before: page')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/pageBreaks.test.ts
```

Expected: FAIL with `Cannot find module './pageBreaks'` (or 7 failures after the file exists empty).

- [ ] **Step 3: Implement the transform**

Create `src/utils/pageBreaks.ts`:

```ts
const PAGE_BREAK_DIV =
  '<div class="pdf-page-break" style="break-before: page; page-break-before: always;"></div>'

const PAGE_BREAK_RE = /<!--\s*page-break\s*-->/gi

export const transformPageBreaks = (s: string): string => s.replace(PAGE_BREAK_RE, PAGE_BREAK_DIV)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/pageBreaks.test.ts
```

Expected: 7/7 passed.

- [ ] **Step 5: Verify the gate**

```bash
npx tsc -b
npx eslint src/utils/pageBreaks.ts src/utils/pageBreaks.test.ts
npx prettier --check src/utils/pageBreaks.ts src/utils/pageBreaks.test.ts
```

All three commands: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/utils/pageBreaks.ts src/utils/pageBreaks.test.ts
git commit -m "feat(utils): add transformPageBreaks for <!-- page-break --> markers"
```

---

## Task 2: `EditorToolbar` component + CSS

**Files:**

- Create: `src/components/EditorToolbar.tsx`
- Modify: `src/theme.css` (append to end)

EditorToolbar has no own test — it is a thin presentational shell; behavior is covered by Task 6's integration tests.

- [ ] **Step 1: Create the component**

Create `src/components/EditorToolbar.tsx`:

```tsx
interface Props {
  onInsertPageBreak: () => void
}

export const EditorToolbar = ({onInsertPageBreak}: Props) => (
  <div className="editor-toolbar" role="toolbar" aria-label="Editor actions">
    <button
      type="button"
      className="editor-toolbar__btn"
      onClick={onInsertPageBreak}
      aria-label="Insert page break"
    >
      ⤓ Page break
    </button>
  </div>
)
```

- [ ] **Step 2: Add styles to `src/theme.css`**

Append the following block to the end of `src/theme.css` (matching the visual language of `.load-file` and `.tab-row` already there):

```css
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line-2);
}

.editor-toolbar__btn {
  background: transparent;
  border: 1px solid var(--line-2);
  padding: 4px 10px 5px;
  cursor: pointer;
  font-family: var(--mono);
  font-size: 11.5px;
  color: var(--fg-2);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition:
    color 200ms var(--ease),
    border-color 200ms var(--ease),
    background 200ms var(--ease);
}

.editor-toolbar__btn:hover {
  color: var(--fg);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.editor-toolbar__btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Verify gate**

```bash
npx tsc -b
npx eslint src/components/EditorToolbar.tsx
npx prettier --check src/components/EditorToolbar.tsx src/theme.css
```

All clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/EditorToolbar.tsx src/theme.css
git commit -m "feat(ui): add EditorToolbar shell with 'Insert page break' button"
```

---

## Task 3: Wire toolbar into `Editor` with cursor insertion

**Files:**

- Modify: `src/components/Editor.tsx`

The textarea ref already exists for autofocus; reuse it for cursor-position insertion.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/components/Editor.tsx` with:

```tsx
import {useCallback, useEffect, useRef} from 'react'
import {EditorToolbar} from './EditorToolbar'

interface Props {
  value: string
  onChange: (next: string) => void
  onSubmitShortcut: () => void
}

const PAGE_BREAK_LITERAL = '<!-- page-break -->'

export const Editor = ({value, onChange, onSubmitShortcut}: Props) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  const insertPageBreak = useCallback(() => {
    const el = ref.current
    if (!el) {
      onChange(value + PAGE_BREAK_LITERAL)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + PAGE_BREAK_LITERAL + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + PAGE_BREAK_LITERAL.length
      el.setSelectionRange(caret, caret)
    })
  }, [onChange, value])

  return (
    <div className="editor-wrap">
      <EditorToolbar onInsertPageBreak={insertPageBreak} />
      <textarea
        ref={ref}
        className="editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            onSubmitShortcut()
          }
        }}
        placeholder="Write or paste html / markdown — 10 to 50,000 characters."
        spellCheck={false}
      />
    </div>
  )
}
```

- [ ] **Step 2: Add `.editor-wrap` style to `src/theme.css`**

Append to the end of `src/theme.css`. Note: `.editor` keeps its existing fixed `height: 380px`; the wrap simply stacks the toolbar above. The surface will grow by toolbar height (~32px) when the editor tab is active — acceptable, and matches how `.surface` already conforms to its child's size.

```css
.editor-wrap {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 3: Run tests — full suite (verify nothing regressed)**

```bash
npx vitest run
```

Expected: all existing tests still pass (82 from baseline + 7 from Task 1 = 89). The new wrapper `<div>` doesn't change focus or keyboard behavior; the existing App test that types into the editor placeholder regex `/Write or paste/i` still matches.

- [ ] **Step 4: Verify gate**

```bash
npx tsc -b
npx eslint src/components/Editor.tsx
npx prettier --check src/components/Editor.tsx src/theme.css
```

All clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/Editor.tsx src/theme.css
git commit -m "feat(ui): wire EditorToolbar into Editor with cursor-position insertion"
```

---

## Task 4: Apply transform in submit pipeline

**Files:**

- Modify: `src/hooks/useSubmit.ts`

- [ ] **Step 1: Add the import**

In `src/hooks/useSubmit.ts`, add this import near the top with the others:

```ts
import {transformPageBreaks} from '../utils/pageBreaks'
```

- [ ] **Step 2: Apply the transform at the submitContent call site**

In `src/hooks/useSubmit.ts`, find the line:

```ts
submitContent(content, undefined, toRequestOptions(options))
```

and change it to:

```ts
submitContent(transformPageBreaks(content), undefined, toRequestOptions(options))
```

That is the only behavior change. No other lines in this file need editing.

- [ ] **Step 3: Run the full suite**

```bash
npx vitest run
```

Expected: 89/89 pass. The change is wire-only; no existing test inspects the request body's content for the page-break marker (yet).

- [ ] **Step 4: Verify gate**

```bash
npx tsc -b
npx eslint src/hooks/useSubmit.ts
npx prettier --check src/hooks/useSubmit.ts
```

All clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSubmit.ts
git commit -m "feat(hooks): apply transformPageBreaks at submit boundary"
```

---

## Task 5: Apply transform in Preview + add visible divider CSS

**Files:**

- Modify: `src/components/Preview.tsx`

- [ ] **Step 1: Add the import**

In `src/components/Preview.tsx`, add this import near the top:

```ts
import {transformPageBreaks} from '../utils/pageBreaks'
```

- [ ] **Step 2: Apply the transform before render**

In `src/components/Preview.tsx`, find this block inside the `useEffect`:

```ts
const body = detectedType === 'markdown' ? renderMarkdownToHtml(content) : sanitizeHtml(content)
```

Change it to:

```ts
const transformed = transformPageBreaks(content)
const body =
  detectedType === 'markdown' ? renderMarkdownToHtml(transformed) : sanitizeHtml(transformed)
```

- [ ] **Step 3: Add `.pdf-page-break` CSS to `PREVIEW_STYLES`**

In `src/components/Preview.tsx`, find the closing backtick of `PREVIEW_STYLES`. Add the following block immediately before that closing backtick (after the `th {...}` rule on line 84):

```css
.pdf-page-break {
  border-top: 1px dashed #b5e368;
  margin: 22px 0 0;
  padding-top: 4px;
  text-align: center;
  font-size: 11px;
  color: #888;
  letter-spacing: 0.04em;
}
.pdf-page-break::after {
  content: 'page break';
}
@media print {
  .pdf-page-break {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .pdf-page-break::after {
    content: '';
  }
}
```

(Indentation matches the existing rules in `PREVIEW_STYLES` — two-space inside the template literal.)

- [ ] **Step 4: Run the full suite**

```bash
npx vitest run
```

Expected: 89/89 pass.

- [ ] **Step 5: Verify gate**

```bash
npx tsc -b
npx eslint src/components/Preview.tsx
npx prettier --check src/components/Preview.tsx
```

All clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Preview.tsx
git commit -m "feat(ui): render page breaks in preview and apply transform before sanitize"
```

---

## Task 6: Integration tests in `App.test.tsx`

**Files:**

- Modify: `src/App.test.tsx`

Add two new test cases to the existing `describe('App full flow', () => {...})` block.

- [ ] **Step 1: Add the insertion test**

In `src/App.test.tsx`, inside `describe('App full flow', () => {...})`, append (after the last existing `it` block, just before the closing `})` of the describe):

```ts
it('inserts <!-- page-break --> at cursor when toolbar button clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    const editor = screen.getByPlaceholderText(/Write or paste/i) as HTMLTextAreaElement
    await user.type(editor, 'beforeafter')
    // place caret between 'before' and 'after'
    editor.focus()
    editor.setSelectionRange(6, 6)
    await user.click(screen.getByRole('button', {name: /insert page break/i}))
    expect(editor.value).toBe('before<!-- page-break -->after')
})

it('sends transformed page-break div in the submit body', async () => {
    let captured: {content?: string} = {}
    server.use(
        http.post(`${API}/pdf`, async ({request}) => {
            captured = (await request.json()) as typeof captured
            return HttpResponse.json(
                {message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'markdown'},
                {status: 202},
            )
        }),
    )

    const user = userEvent.setup()
    render(<App />)
    const editor = screen.getByPlaceholderText(/Write or paste/i)
    await user.type(editor, '# Hello\n\n<!-- page-break -->\n\nMore text here')
    await user.click(screen.getByRole('button', {name: /^Press/i}))
    await screen.findByRole('link', {name: /download pdf/i}, {timeout: 8000})

    expect(captured.content).toContain('class="pdf-page-break"')
    expect(captured.content).toContain('break-before: page')
    expect(captured.content).not.toContain('<!-- page-break -->')
})
```

- [ ] **Step 2: Run the full suite**

```bash
npx vitest run
```

Expected: 91/91 pass (89 from prior tasks + 2 new).

If the second test fails because `captured.content` doesn't include the markers, that means Task 4 didn't apply the transform at the submit boundary — go fix Task 4 first.

- [ ] **Step 3: Verify gate**

```bash
npx tsc -b
npx eslint src/App.test.tsx
npx prettier --check src/App.test.tsx
```

All clean.

- [ ] **Step 4: Commit**

```bash
git add src/App.test.tsx
git commit -m "test(app): cover page-break insertion and transformed submit body"
```

---

## Task 7: Final verification and PR

- [ ] **Step 1: Full gate sweep**

```bash
npm run lint
npm test
npm run format:check
npm run build
```

All four green. Build emits a `dist/` without errors.

- [ ] **Step 2: Manual smoke in dev**

```bash
npm run dev
```

Verify in the browser:

- Open the app; the editor toolbar appears above the textarea with one "⤓ Page break" button.
- Click the button → `<!-- page-break -->` is inserted at the current cursor position; cursor lands after the inserted text; focus stays on textarea.
- Click again at a different position → a second comment appears at the new cursor.
- Switch to Preview tab. After 150 ms the preview shows the content with a dashed horizontal divider labeled "page break" where the comment was.
- Switch back to Editor; submit a doc that includes one or more comments. Wait for the download link.
- Open the downloaded PDF: each page break appears at exactly the position you marked.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/page-break-controls
gh pr create --base main --title "Page break controls" --body "$(cat <<'EOF'
## Summary
- Add `transformPageBreaks` utility that replaces `<!-- page-break -->` with a CSS-page-break div Chromium honors.
- New thin editor toolbar above the textarea with one "Insert page break" button (cursor-position insertion via textarea ref).
- Preview pane shows a visible dashed divider labeled "page break" where the marker was; resets under `@media print`.
- Transform runs at two seams: `Preview.tsx` (before sanitize) and `useSubmit.ts` (before POST). Editor state remains raw user text.
- No backend changes.

## Spec
docs/superpowers/specs/2026-05-25-page-break-controls-design.md

## Test plan
- [ ] `npm run lint`, `npm test`, `npm run format:check`, `npm run build` all green
- [ ] Manual: insert button works at start / middle / end / multiple times
- [ ] Manual: preview shows dashed divider in correct position after debounce
- [ ] Manual: produced PDF actually splits pages at each marker

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Mark plan complete**

The PR URL is returned by `gh pr create`. Squash-merge when ready.

---

## Self-review notes

**Spec coverage (every requirement maps to a task):**

- Pure transform → Task 1.
- Toolbar + cursor insertion → Tasks 2, 3.
- Submit-side transform → Task 4.
- Preview-side transform + visible divider → Task 5.
- Sanitization survival → Task 1 test #7.
- Integration tests → Task 6.
- Accessibility (`role="toolbar"`, `aria-label`s, focus ring) → Task 2 component + CSS.
- Manual smoke for real PDF break → Task 7 step 2.

**Naming consistency check:**

- `transformPageBreaks` (camelCase, exported) — used in `pageBreaks.ts`, `pageBreaks.test.ts`, `Preview.tsx`, `useSubmit.ts`. Same name everywhere.
- `PAGE_BREAK_LITERAL` constant (in `Editor.tsx`) holds the canonical insertion string `<!-- page-break -->`.
- `.pdf-page-break` CSS class — used by transform output, by Preview CSS, and asserted in tests.
- `EditorToolbar` (component) — used in `Editor.tsx`.
- Prop `onInsertPageBreak` matches both ends (EditorToolbar declares, Editor passes).

**File-size sanity:**

- `pageBreaks.ts` ≈ 5 LOC. `pageBreaks.test.ts` ≈ 55 LOC. `EditorToolbar.tsx` ≈ 18 LOC. Editor.tsx grows from 30 → ~50 LOC. Preview.tsx grows by ~8 LOC of TS plus ~12 lines of CSS. theme.css grows by ~45 lines. No file becomes large.

**Out of scope (deferred per spec):**

- Keyboard shortcut for insert.
- Auto-break-before-H1 toggle.
- Code-block-aware transform.

These are deliberately not in the plan. Don't add them.
