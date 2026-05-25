import { useEffect, useState } from 'react';
import type { SubmitState } from './useSubmit';

export const useCooldown = (state: SubmitState): number | null => {
  const [seconds, setSeconds] = useState<number | null>(
    state.phase === 'rate_limited' ? state.retryAfter : null,
  );

  // Sync seed on phase transitions without an effect (render-time state
  // sync is React's recommended pattern for prop-derived state).
  const [prevPhase, setPrevPhase] = useState(state.phase);
  if (state.phase !== prevPhase) {
    setPrevPhase(state.phase);
    setSeconds(state.phase === 'rate_limited' ? state.retryAfter : null);
  }

  useEffect(() => {
    if (state.phase !== 'rate_limited') return;
    const until = state.until;
    const id = window.setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(id);
  }, [state]);

  return seconds;
};
