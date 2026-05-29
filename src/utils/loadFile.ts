import {CONTENT_MAX} from '../constants'

const MAX_BYTES = 1_000_000

const ACCEPT_EXT = new Set(['.html', '.htm', '.md', '.markdown', '.txt', '.text'])

const looksLikeText = (file: File): boolean => {
    if (file.type.startsWith('text/')) return true
    if (file.type === 'application/json' || file.type === 'application/xhtml+xml') return true
    const dot = file.name.lastIndexOf('.')
    if (dot === -1) return file.type === '' && file.size < MAX_BYTES
    return ACCEPT_EXT.has(file.name.slice(dot).toLowerCase())
}

type LoadResult = {ok: true; content: string; name: string} | {ok: false; error: string}

export const loadFileAsText = async (file: File): Promise<LoadResult> => {
    if (file.size > MAX_BYTES) {
        return {ok: false, error: `File is too large (${(file.size / 1024).toFixed(0)} KB).`}
    }
    if (!looksLikeText(file)) {
        return {ok: false, error: `Not a text file (${file.type || file.name}).`}
    }
    let text: string
    try {
        text = await file.text()
    } catch (err) {
        console.error('[loadFile][loadFileAsText] read failed', err)
        return {ok: false, error: 'Could not read file.'}
    }
    if (text.length > CONTENT_MAX) {
        return {
            ok: false,
            error: `Content is too long (${text.length.toLocaleString('en-US')} chars; max ${CONTENT_MAX.toLocaleString('en-US')}).`,
        }
    }
    return {ok: true, content: text, name: file.name}
}
