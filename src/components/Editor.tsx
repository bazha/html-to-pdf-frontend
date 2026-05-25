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
