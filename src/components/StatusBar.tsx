import type { PollState } from '../hooks/usePoll';
import type { SubmitState } from '../hooks/useSubmit';

interface Props {
  pollState: PollState;
  submitState: SubmitState;
}

export const StatusBar = ({ pollState, submitState }: Props) => {
  if (submitState.phase === 'error') {
    return <div className="statusbar error">⚠ {submitState.message}</div>;
  }
  if (submitState.phase === 'rate_limited') {
    return <div className="statusbar error">⚠ Rate limited — retrying in {submitState.retryAfter}s</div>;
  }
  if (submitState.phase === 'submitting') {
    return <div className="statusbar">Submitting…</div>;
  }
  if (pollState.phase === 'polling') {
    return <div className="statusbar">Job state: {pollState.state}…</div>;
  }
  if (pollState.phase === 'completed') {
    return (
      <div className="statusbar success">
        ✓ Ready — <a href={pollState.url} target="_blank" rel="noreferrer">download PDF</a>
      </div>
    );
  }
  if (pollState.phase === 'failed') {
    return <div className="statusbar error">✗ Failed: {pollState.reason}</div>;
  }
  if (pollState.phase === 'error') {
    return <div className="statusbar error">⚠ {pollState.message}</div>;
  }
  return <div className="statusbar">Idle</div>;
};
