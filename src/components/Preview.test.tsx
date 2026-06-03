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
