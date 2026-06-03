import {describe, it, expect} from 'vitest'
import {PAGE_DIMENSIONS_MM, pageDimensionsMm, pageContentAreaMm} from './pageMetrics'

describe('PAGE_DIMENSIONS_MM', () => {
    it('exposes ISO and US sizes in millimetres', () => {
        expect(PAGE_DIMENSIONS_MM.A4).toEqual({w: 210, h: 297})
        expect(PAGE_DIMENSIONS_MM.A3).toEqual({w: 297, h: 420})
        expect(PAGE_DIMENSIONS_MM.A5).toEqual({w: 148, h: 210})
        expect(PAGE_DIMENSIONS_MM.Letter).toEqual({w: 215.9, h: 279.4})
        expect(PAGE_DIMENSIONS_MM.Legal).toEqual({w: 215.9, h: 355.6})
    })
})

describe('pageDimensionsMm', () => {
    it('returns portrait dimensions when landscape is false', () => {
        expect(pageDimensionsMm('A4', false)).toEqual({w: 210, h: 297})
    })

    it('swaps width and height for landscape', () => {
        expect(pageDimensionsMm('A4', true)).toEqual({w: 297, h: 210})
        expect(pageDimensionsMm('Letter', true)).toEqual({w: 279.4, h: 215.9})
    })
})

describe('pageContentAreaMm', () => {
    const M20 = {top: 20, right: 20, bottom: 20, left: 20}

    it('subtracts default margins from A4', () => {
        expect(pageContentAreaMm('A4', false, M20)).toEqual({w: 170, h: 257})
    })

    it('returns full page when margins are zero', () => {
        const zero = {top: 0, right: 0, bottom: 0, left: 0}
        expect(pageContentAreaMm('A4', false, zero)).toEqual({w: 210, h: 297})
    })

    it('handles asymmetric margins', () => {
        const m = {top: 10, right: 15, bottom: 20, left: 25}
        expect(pageContentAreaMm('A4', false, m)).toEqual({w: 170, h: 267})
    })

    it('clamps negative content area to zero when margins exceed page', () => {
        const huge = {top: 200, right: 200, bottom: 200, left: 200}
        expect(pageContentAreaMm('A4', false, huge)).toEqual({w: 0, h: 0})
    })

    it('applies margins after landscape swap', () => {
        expect(pageContentAreaMm('A4', true, M20)).toEqual({w: 257, h: 170})
    })
})
