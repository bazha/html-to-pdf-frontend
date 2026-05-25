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

    it('reset() cancels the pending debounce so storage stays cleared', () => {
        const {result} = renderHook(() => usePdfOptions())
        act(() => result.current.set('format', 'Letter'))
        act(() => result.current.reset())
        act(() => vi.advanceTimersByTime(500))
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
