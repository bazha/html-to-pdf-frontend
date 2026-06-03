import {describe, it, expect} from 'vitest'
import {PAGE_DIMENSIONS_MM, pageDimensionsMm, pageContentAreaMm} from './pageMetrics'
import type {Margins} from '../types/pdfOptions'

describe('PAGE_DIMENSIONS_MM', () => {
    it('exposes ISO and US sizes in millimetres', () => {
        expect(PAGE_DIMENSIONS_MM.A4).toEqual({w: 210, h: 297})
        expect(PAGE_DIMENSIONS_MM.A3).toEqual({w: 297, h: 420})
        expect(PAGE_DIMENSIONS_MM.A5).toEqual({w: 148, h: 210})
        expect(PAGE_DIMENSIONS_MM.Letter).toEqual({w: 215.9, h: 279.4})
        expect(PAGE_DIMENSIONS_MM.Legal).toEqual({w: 215.9, h: 355.6})
    })

    it('has width smaller than height for all portrait formats', () => {
        for (const [, dims] of Object.entries(PAGE_DIMENSIONS_MM)) {
            expect(dims.w).toBeLessThan(dims.h)
        }
    })

    it('covers all five supported formats', () => {
        const keys = Object.keys(PAGE_DIMENSIONS_MM)
        expect(keys).toContain('A4')
        expect(keys).toContain('A3')
        expect(keys).toContain('A5')
        expect(keys).toContain('Letter')
        expect(keys).toContain('Legal')
        expect(keys).toHaveLength(5)
    })
})

describe('pageDimensionsMm', () => {
    it('returns portrait dimensions when landscape is false', () => {
        expect(pageDimensionsMm('A4', false)).toEqual({w: 210, h: 297})
    })

    it('swaps width and height for landscape A4', () => {
        expect(pageDimensionsMm('A4', true)).toEqual({w: 297, h: 210})
    })

    it('swaps width and height for landscape Letter', () => {
        expect(pageDimensionsMm('Letter', true)).toEqual({w: 279.4, h: 215.9})
    })

    it('returns correct portrait dimensions for all formats', () => {
        expect(pageDimensionsMm('A3', false)).toEqual({w: 297, h: 420})
        expect(pageDimensionsMm('A5', false)).toEqual({w: 148, h: 210})
        expect(pageDimensionsMm('Legal', false)).toEqual({w: 215.9, h: 355.6})
        expect(pageDimensionsMm('Letter', false)).toEqual({w: 215.9, h: 279.4})
    })

    it('returns landscape where w > h for all formats', () => {
        const formats = ['A4', 'A3', 'A5', 'Letter', 'Legal'] as const
        for (const fmt of formats) {
            const {w, h} = pageDimensionsMm(fmt, true)
            expect(w).toBeGreaterThan(h)
        }
    })

    it('portrait and landscape are inverses of each other', () => {
        const portrait = pageDimensionsMm('A4', false)
        const landscape = pageDimensionsMm('A4', true)
        expect(portrait.w).toBe(landscape.h)
        expect(portrait.h).toBe(landscape.w)
    })
})

describe('pageContentAreaMm', () => {
    const M20: Margins = {top: 20, right: 20, bottom: 20, left: 20}

    it('subtracts default margins from A4', () => {
        expect(pageContentAreaMm('A4', false, M20)).toEqual({w: 170, h: 257})
    })

    it('returns full page when margins are zero', () => {
        const zero: Margins = {top: 0, right: 0, bottom: 0, left: 0}
        expect(pageContentAreaMm('A4', false, zero)).toEqual({w: 210, h: 297})
    })

    it('handles asymmetric margins', () => {
        const m: Margins = {top: 10, right: 15, bottom: 20, left: 25}
        expect(pageContentAreaMm('A4', false, m)).toEqual({w: 170, h: 267})
    })

    it('clamps negative content area to zero when margins exceed page', () => {
        const huge: Margins = {top: 200, right: 200, bottom: 200, left: 200}
        expect(pageContentAreaMm('A4', false, huge)).toEqual({w: 0, h: 0})
    })

    it('applies margins after landscape swap', () => {
        expect(pageContentAreaMm('A4', true, M20)).toEqual({w: 257, h: 170})
    })

    it('handles narrow margins (10mm)', () => {
        const narrow: Margins = {top: 10, right: 10, bottom: 10, left: 10}
        expect(pageContentAreaMm('A4', false, narrow)).toEqual({w: 190, h: 277})
    })

    it('handles wide margins (30mm)', () => {
        const wide: Margins = {top: 30, right: 30, bottom: 30, left: 30}
        expect(pageContentAreaMm('A4', false, wide)).toEqual({w: 150, h: 237})
    })

    it('clamps width to zero but not height when only horizontal margins exceed page', () => {
        const m: Margins = {top: 0, right: 150, bottom: 0, left: 150}
        const {w, h} = pageContentAreaMm('A4', false, m)
        expect(w).toBe(0)
        expect(h).toBe(297)
    })

    it('clamps height to zero but not width when only vertical margins exceed page', () => {
        const m: Margins = {top: 200, right: 0, bottom: 200, left: 0}
        const {w, h} = pageContentAreaMm('A4', false, m)
        expect(w).toBe(210)
        expect(h).toBe(0)
    })

    it('works correctly for Letter format', () => {
        const m: Margins = {top: 25.4, right: 25.4, bottom: 25.4, left: 25.4}
        const result = pageContentAreaMm('Letter', false, m)
        // 215.9 - 25.4 - 25.4 = 165.1; 279.4 - 25.4 - 25.4 = 228.6
        expect(result.w).toBeCloseTo(165.1, 5)
        expect(result.h).toBeCloseTo(228.6, 5)
    })

    it('content area width equals page w minus left and right margin', () => {
        const m: Margins = {top: 5, right: 7, bottom: 9, left: 11}
        const dims = pageDimensionsMm('A4', false)
        const area = pageContentAreaMm('A4', false, m)
        expect(area.w).toBe(dims.w - m.left - m.right)
        expect(area.h).toBe(dims.h - m.top - m.bottom)
    })
})