import {useRef} from 'react'

interface Props {
    onPick: (file: File) => void
}

export const LoadFileButton = ({onPick}: Props) => {
    const ref = useRef<HTMLInputElement>(null)
    return (
        <>
            <input
                ref={ref}
                type="file"
                accept=".html,.htm,.md,.markdown,.txt,.text,text/*"
                aria-hidden="true"
                tabIndex={-1}
                style={{display: 'none'}}
                onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onPick(f)
                    // reset so re-picking the same file re-fires onChange
                    e.target.value = ''
                }}
            />
            <button
                type="button"
                className="load-file"
                onClick={() => ref.current?.click()}
                aria-label="Load file from computer"
            >
                Open file
            </button>
        </>
    )
}
