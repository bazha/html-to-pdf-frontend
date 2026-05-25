import type {RefObject} from 'react'
import {PLACEHOLDER_TOKENS} from '../../types/pdfOptions'
import {clampTemplate} from '../../utils/clampTemplate'

interface Props {
    inputRef: RefObject<HTMLInputElement | null>
    onInsert: (next: string) => void
}

const TOKENS = PLACEHOLDER_TOKENS.map((p) => p.token)

export const PlaceholderChips = ({inputRef, onInsert}: Props) => {
    const insert = (token: string) => {
        const el = inputRef.current
        if (!el) {
            onInsert(clampTemplate(token))
            return
        }
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        const next = clampTemplate(el.value.slice(0, start) + token + el.value.slice(end))
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
