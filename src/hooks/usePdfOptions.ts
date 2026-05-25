import {useCallback, useEffect, useRef, useState} from 'react'
import {
    DEFAULTS,
    MARGIN_PRESETS,
    MARGIN_PRESETS_ORDER,
    PAGE_FORMATS,
    type Margins,
    type PdfOptions,
} from '../types/pdfOptions'

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
        (PAGE_FORMATS as readonly string[]).includes(x.format) &&
        typeof x.landscape === 'boolean' &&
        typeof x.marginPreset === 'string' &&
        (MARGIN_PRESETS_ORDER as readonly string[]).includes(x.marginPreset) &&
        !!x.margins &&
        typeof (x.margins as Margins).top === 'number' &&
        typeof (x.margins as Margins).right === 'number' &&
        typeof (x.margins as Margins).bottom === 'number' &&
        typeof (x.margins as Margins).left === 'number' &&
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
    const skipNextPersist = useRef(false)

    // Debounced persist.
    useEffect(() => {
        if (skipNextPersist.current) {
            skipNextPersist.current = false
            return
        }
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
        if (timer.current !== null) window.clearTimeout(timer.current)
        timer.current = null
        skipNextPersist.current = true
        setOptions(DEFAULTS)
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            // ignored
        }
    }, [])

    return {options, set, setMargin, reset}
}
