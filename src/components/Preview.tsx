import {useEffect, useState} from 'react'
import {renderMarkdownToHtml, sanitizeHtml} from '../utils/renderMarkdown'
import {transformPageBreaks} from '../utils/pageBreaks'
import {buildPreviewSrcDoc} from '../utils/previewSrcDoc'
import type {ContentType} from '../utils/detectType'
import type {PdfOptions} from '../types/pdfOptions'

interface Props {
    content: string
    detectedType: ContentType
    options: PdfOptions
}

const DEBOUNCE_MS = 150

export const Preview = ({content, detectedType, options}: Props) => {
    const [srcDoc, setSrcDoc] = useState('')
    useEffect(() => {
        const handle = window.setTimeout(() => {
            const transformed = transformPageBreaks(content)
            const body =
                detectedType === 'markdown'
                    ? renderMarkdownToHtml(transformed)
                    : sanitizeHtml(transformed)
            setSrcDoc(buildPreviewSrcDoc({body, options}))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(handle)
    }, [content, detectedType, options])
    return (
        <iframe title="preview" className="preview-frame" sandbox="allow-scripts" srcDoc={srcDoc} />
    )
}
