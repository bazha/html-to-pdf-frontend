import {afterEach, describe, expect, it, vi} from 'vitest'
import {safeGetItem, safeRemoveItem, safeSetItem} from './storage'

afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
})

describe('safeGetItem', () => {
    it('returns the stored value', () => {
        localStorage.setItem('k', 'v')
        expect(safeGetItem('k')).toBe('v')
    })

    it('returns null for a missing key', () => {
        expect(safeGetItem('missing')).toBeNull()
    })

    it('returns null when getItem throws (private mode / disabled)', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        expect(safeGetItem('k')).toBeNull()
    })
})

describe('safeSetItem', () => {
    it('writes the value', () => {
        safeSetItem('k', 'v')
        expect(localStorage.getItem('k')).toBe('v')
    })

    it('swallows errors when setItem throws (quota / disabled)', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota')
        })
        expect(() => safeSetItem('k', 'v')).not.toThrow()
    })
})

describe('safeRemoveItem', () => {
    it('removes the value', () => {
        localStorage.setItem('k', 'v')
        safeRemoveItem('k')
        expect(localStorage.getItem('k')).toBeNull()
    })

    it('swallows errors when removeItem throws', () => {
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        expect(() => safeRemoveItem('k')).not.toThrow()
    })
})
