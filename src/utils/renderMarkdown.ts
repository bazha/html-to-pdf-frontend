import {Lexer, Parser} from 'marked'
import DOMPurify, {type Config} from 'dompurify'

const MARKED_OPTIONS = {gfm: true, breaks: true, async: false} as const

const PURIFY_OPTIONS: Config = {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
}

export const renderMarkdownToHtml = (markdown: string): string => {
    const tokens = new Lexer(MARKED_OPTIONS).lex(markdown)
    const rawHtml = new Parser(MARKED_OPTIONS).parse(tokens) as string
    return DOMPurify.sanitize(rawHtml, PURIFY_OPTIONS)
}

export const sanitizeHtml = (html: string): string => DOMPurify.sanitize(html, PURIFY_OPTIONS)
