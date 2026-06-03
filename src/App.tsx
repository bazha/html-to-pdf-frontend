import {useEffect, useState} from 'react'
import {Editor} from './components/Editor'
import {Preview} from './components/Preview'
import {Tabs} from './components/Tabs'
import {Header} from './components/Header'
import {ActionRow} from './components/ActionRow'
import {Footer} from './components/Footer'
import {LoadFileButton} from './components/LoadFileButton'
import {OptionsBar} from './components/OptionsBar'
import {useSubmit} from './hooks/useSubmit'
import {usePoll} from './hooks/usePoll'
import {usePdfOptions} from './hooks/usePdfOptions'
import {useCooldown} from './hooks/useCooldown'
import {useDropZone} from './hooks/useDropZone'
import {detectType} from './utils/detectType'
import {loadFileAsText} from './utils/loadFile'
import {CSS_MAX_LENGTH} from './types/pdfOptions'
import {API_BASE_URL_DEFAULT, CONTENT_MAX, CONTENT_MIN} from './constants'

const VERSION = 'v1.0'
const FILE_ERROR_TTL_MS = 4000

const App = () => {
    const [content, setContent] = useState('')
    const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')
    const [jobId, setJobId] = useState<string | null>(null)
    const [fileError, setFileError] = useState<string | null>(null)

    const detectedType = detectType(content)
    const submit = useSubmit()
    const poll = usePoll(jobId)
    const pdfOptions = usePdfOptions()

    const handlePickedFile = async (file: File) => {
        setFileError(null)
        const result = await loadFileAsText(file)
        if (!result.ok) {
            setFileError(result.error)
            return
        }
        setContent(result.content)
        setActiveTab('editor')
    }

    const cooldownLeft = useCooldown(submit.state)
    const dropZone = useDropZone(handlePickedFile)

    const lengthValid = content.length >= CONTENT_MIN && content.length <= CONTENT_MAX
    const cssWithinCap = pdfOptions.options.css.length <= CSS_MAX_LENGTH
    const canSubmit =
        lengthValid &&
        cssWithinCap &&
        submit.state.phase !== 'submitting' &&
        submit.state.phase !== 'rate_limited' &&
        poll.phase !== 'polling'

    // auto-clear file error after a few seconds
    useEffect(() => {
        if (!fileError) return
        const id = window.setTimeout(() => setFileError(null), FILE_ERROR_TTL_MS)
        return () => window.clearTimeout(id)
    }, [fileError])

    const handleSubmit = () => {
        if (!canSubmit) return
        submit.submit(content, pdfOptions.options, (res) => setJobId(res.jobId))
    }

    const apiBaseUrl =
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? API_BASE_URL_DEFAULT

    // Badge warns only when the count is genuinely outside the submit window
    // (over the cap). Under-MIN is left silent — the disabled Submit button is
    // already feedback enough and flashing amber on every first keystroke
    // reads as punitive.
    const charCount = content.length
    const badgeWarn = charCount > CONTENT_MAX
    const badgeText = `${charCount.toLocaleString()} · ${detectedType}`

    return (
        <div className="shell">
            <Header apiBaseUrl={apiBaseUrl} version={VERSION} />

            <div className="tab-row">
                <Tabs active={activeTab} onChange={setActiveTab} />
                <div className="spacer" />
                <LoadFileButton onPick={handlePickedFile} />
                <span className={`badge${badgeWarn ? ' warn' : ''}`}>{badgeText}</span>
            </div>

            <OptionsBar pdf={pdfOptions} />

            <div
                className={`surface${dropZone.isDragOver ? ' dragover' : ''}${poll.phase === 'polling' || submit.state.phase === 'submitting' ? ' surface--running' : ''}`}
                {...dropZone.bind}
            >
                {activeTab === 'editor' ? (
                    <Editor value={content} onChange={setContent} onSubmitShortcut={handleSubmit} />
                ) : (
                    <Preview
                        content={content}
                        detectedType={detectedType}
                        options={pdfOptions.options}
                    />
                )}
                {dropZone.isDragOver && <div className="drop-overlay">Drop to load</div>}
            </div>

            <ActionRow
                pollState={poll}
                submitState={submit.state}
                canSubmit={canSubmit}
                cooldownSeconds={cooldownLeft}
                fileError={fileError}
                onSubmit={handleSubmit}
            />

            <Footer />
        </div>
    )
}

export default App
