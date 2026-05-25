import type {PollState} from '../hooks/usePoll'
import type {SubmitState} from '../hooks/useSubmit'
import type {ReactNode} from 'react'

interface Props {
    pollState: PollState
    submitState: SubmitState
    canSubmit: boolean
    cooldownSeconds: number | null
    fileError?: string | null
    onSubmit: () => void
}

type Status =
    | 'file_error'
    | 'rate_limited'
    | 'submit_error'
    | 'submitting'
    | 'rendering'
    | 'ready'
    | 'failed'
    | 'poll_error'
    | 'idle'

const deriveStatus = (
    pollState: PollState,
    submitState: SubmitState,
    fileError: string | null | undefined,
): Status => {
    if (fileError) return 'file_error'
    if (submitState.phase === 'rate_limited') return 'rate_limited'
    if (submitState.phase === 'error') return 'submit_error'
    if (submitState.phase === 'submitting') return 'submitting'
    if (pollState.phase === 'polling') return 'rendering'
    if (pollState.phase === 'completed') return 'ready'
    if (pollState.phase === 'failed') return 'failed'
    if (pollState.phase === 'error') return 'poll_error'
    return 'idle'
}

const KBD = <span className="kbd">⌘↵</span>

interface View {
    cls: 'idle' | 'busy' | 'done' | 'err'
    message: (ctx: ViewCtx) => ReactNode
    button: (ctx: ViewCtx) => ReactNode
}

interface ViewCtx {
    pollState: PollState
    submitState: SubmitState
    cooldownSeconds: number | null
    fileError: string | null | undefined
}

const STATUS_VIEW: Record<Status, View> = {
    file_error: {
        cls: 'err',
        message: ({fileError}) => (
            <span>
                <strong>File error.</strong> <span className="dim">{fileError}</span>
            </span>
        ),
        button: () => <>Press {KBD}</>,
    },
    rate_limited: {
        cls: 'err',
        message: ({submitState, cooldownSeconds}) => {
            const left =
                cooldownSeconds ??
                (submitState.phase === 'rate_limited' ? submitState.retryAfter : 0)
            return (
                <span>
                    <strong>Rate limited.</strong> <span className="dim">Wait </span>
                    <code>{left}s</code>
                </span>
            )
        },
        button: ({submitState, cooldownSeconds}) => {
            const left =
                cooldownSeconds ??
                (submitState.phase === 'rate_limited' ? submitState.retryAfter : 0)
            return `Wait ${left}s`
        },
    },
    submit_error: {
        cls: 'err',
        message: ({submitState}) => (
            <span>
                <strong>Error.</strong>{' '}
                <span className="dim">
                    {submitState.phase === 'error' ? submitState.message : ''}
                </span>
            </span>
        ),
        button: () => <>Press {KBD}</>,
    },
    submitting: {
        cls: 'busy',
        message: () => (
            <span>
                <strong>Submitting.</strong> <span className="dim">Sending content.</span>
            </span>
        ),
        button: () => 'Submitting…',
    },
    rendering: {
        cls: 'busy',
        message: () => (
            <span>
                <strong>Rendering.</strong>{' '}
                <span className="dim">Generating PDF on the server.</span>
            </span>
        ),
        button: () => 'Rendering…',
    },
    ready: {
        cls: 'done',
        message: ({pollState}) => (
            <span>
                <strong>Ready.</strong> <span className="dim">PDF generated · </span>
                <a
                    className="link"
                    href={pollState.phase === 'completed' ? pollState.url : '#'}
                    target="_blank"
                    rel="noreferrer"
                >
                    download pdf
                </a>
            </span>
        ),
        button: () => <>Press again {KBD}</>,
    },
    failed: {
        cls: 'err',
        message: ({pollState}) => (
            <span>
                <strong>Failed.</strong>{' '}
                <span className="dim">{pollState.phase === 'failed' ? pollState.reason : ''}</span>
            </span>
        ),
        button: () => <>Press {KBD}</>,
    },
    poll_error: {
        cls: 'err',
        message: ({pollState}) => (
            <span>
                <strong>Error.</strong>{' '}
                <span className="dim">{pollState.phase === 'error' ? pollState.message : ''}</span>
            </span>
        ),
        button: () => <>Press {KBD}</>,
    },
    idle: {
        cls: 'idle',
        message: () => (
            <span>
                <strong>Idle.</strong> <span className="dim">Type or paste, then submit.</span>
            </span>
        ),
        button: () => <>Press {KBD}</>,
    },
}

export const ActionRow = ({
    pollState,
    submitState,
    canSubmit,
    cooldownSeconds,
    fileError,
    onSubmit,
}: Props) => {
    const status = deriveStatus(pollState, submitState, fileError)
    const view = STATUS_VIEW[status]
    const ctx: ViewCtx = {pollState, submitState, cooldownSeconds, fileError}

    return (
        <div className="actions">
            <div className={`status ${view.cls}`}>
                <span className="glyph" />
                {view.message(ctx)}
            </div>
            <button type="button" className="submit" disabled={!canSubmit} onClick={onSubmit}>
                {view.button(ctx)}
            </button>
        </div>
    )
}
