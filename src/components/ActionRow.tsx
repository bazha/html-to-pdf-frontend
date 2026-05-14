import type { PollState } from '../hooks/usePoll';
import type { SubmitState } from '../hooks/useSubmit';

interface Props {
  pollState: PollState;
  submitState: SubmitState;
  canSubmit: boolean;
  cooldownSeconds: number | null;
  fileError?: string | null;
  onSubmit: () => void;
}

interface Display {
  cls: 'idle' | 'busy' | 'done' | 'err';
  node: React.ReactNode;
}

const renderStatus = (
  pollState: PollState,
  submitState: SubmitState,
  cooldownSeconds: number | null,
  fileError: string | null | undefined,
): Display => {
  if (fileError) {
    return {
      cls: 'err',
      node: (
        <span>
          <strong>File error.</strong> <span className="dim">{fileError}</span>
        </span>
      ),
    };
  }
  if (submitState.phase === 'rate_limited') {
    const left = cooldownSeconds ?? submitState.retryAfter;
    return {
      cls: 'err',
      node: (
        <span>
          <strong>Rate limited.</strong>{' '}
          <span className="dim">Wait </span>
          <code>{left}s</code>
        </span>
      ),
    };
  }
  if (submitState.phase === 'error') {
    return {
      cls: 'err',
      node: (
        <span>
          <strong>Error.</strong> <span className="dim">{submitState.message}</span>
        </span>
      ),
    };
  }
  if (submitState.phase === 'submitting') {
    return {
      cls: 'busy',
      node: (
        <span>
          <strong>Setting.</strong> <span className="dim">Sending the manuscript.</span>
        </span>
      ),
    };
  }
  if (pollState.phase === 'polling') {
    return {
      cls: 'busy',
      node: (
        <span>
          <strong>Running.</strong>{' '}
          <span className="dim">On the press.</span>
        </span>
      ),
    };
  }
  if (pollState.phase === 'completed') {
    return {
      cls: 'done',
      node: (
        <span>
          <strong>Done.</strong> <span className="dim">Press ready · </span>
          <a className="link" href={pollState.url} target="_blank" rel="noreferrer">
            download pdf
          </a>
        </span>
      ),
    };
  }
  if (pollState.phase === 'failed') {
    return {
      cls: 'err',
      node: (
        <span>
          <strong>Failed.</strong>{' '}
          <span className="dim">{pollState.reason}</span>
        </span>
      ),
    };
  }
  if (pollState.phase === 'error') {
    return {
      cls: 'err',
      node: (
        <span>
          <strong>Error.</strong> <span className="dim">{pollState.message}</span>
        </span>
      ),
    };
  }
  return {
    cls: 'idle',
    node: (
      <span>
        <strong>Ready.</strong>{' '}
        <span className="dim">Type or paste, then press.</span>
      </span>
    ),
  };
};

const submitLabel = (
  submitState: SubmitState,
  pollState: PollState,
  cooldownSeconds: number | null,
): React.ReactNode => {
  if (submitState.phase === 'rate_limited') {
    const left = cooldownSeconds ?? submitState.retryAfter;
    return `Wait ${left}s`;
  }
  if (submitState.phase === 'submitting') return 'Setting…';
  if (pollState.phase === 'polling') return 'Running…';
  if (pollState.phase === 'completed') {
    return (
      <>
        Press again <span className="kbd">⌘↵</span>
      </>
    );
  }
  return (
    <>
      Press <span className="kbd">⌘↵</span>
    </>
  );
};

export const ActionRow = ({
  pollState,
  submitState,
  canSubmit,
  cooldownSeconds,
  fileError,
  onSubmit,
}: Props) => {
  const { cls, node } = renderStatus(pollState, submitState, cooldownSeconds, fileError);
  return (
    <div className="actions">
      <div className={`status ${cls}`}>
        <span className="glyph" />
        {node}
      </div>
      <button
        type="button"
        className="submit"
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel(submitState, pollState, cooldownSeconds)}
      </button>
    </div>
  );
};
