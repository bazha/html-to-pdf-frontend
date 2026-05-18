import { useEffect, useState } from 'react';
import { ApiError, pollJob } from '../api/pdfClient';

export type PollState =
  | { phase: 'idle' }
  | { phase: 'polling'; state: string }
  | { phase: 'completed'; url: string }
  | { phase: 'failed'; reason: string }
  | {
      phase: 'error';
      code: 'timeout' | 'not_found' | 'http' | 'network';
      message: string;
    };

const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 120_000;
const BACKOFF_INTERVAL_MS = 3000;

export const usePoll = (
  jobId: string | null,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): PollState => {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const initial = (id: string | null): PollState =>
    id ? { phase: 'polling', state: 'waiting' } : { phase: 'idle' };
  const [state, setState] = useState<PollState>(() => initial(jobId));
  const [prevJobId, setPrevJobId] = useState(jobId);
  if (jobId !== prevJobId) {
    setPrevJobId(jobId);
    setState(initial(jobId));
  }

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const deadline = Date.now() + timeoutMs;
    let currentInterval = intervalMs;

    const schedule = (delay: number) => {
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() >= deadline) {
        setState({
          phase: 'error',
          code: 'timeout',
          message: `Polling exceeded ${timeoutMs}ms`,
        });
        return;
      }
      try {
        const res = await pollJob(jobId);
        if (cancelled) return;
        if (res.kind === 'completed') {
          setState({ phase: 'completed', url: res.url });
          return;
        }
        if (res.kind === 'failed') {
          setState({ phase: 'failed', reason: res.reason });
          return;
        }
        if (res.kind === 'not_found') {
          setState({
            phase: 'error',
            code: 'not_found',
            message: 'Job not found — Redis may have evicted it. Resubmit.',
          });
          return;
        }
        setState({ phase: 'polling', state: res.state });
        currentInterval = intervalMs;
        schedule(currentInterval);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'rate_limit') {
          currentInterval = BACKOFF_INTERVAL_MS;
          schedule(currentInterval);
          return;
        }
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setState({
          phase: 'error',
          code: err instanceof ApiError && err.code === 'network' ? 'network' : 'http',
          message: msg,
        });
      }
    };

    schedule(0);

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [jobId, intervalMs, timeoutMs]);

  return state;
};
