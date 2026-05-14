import { useEffect, useRef, useState } from 'react';
import { ApiError, submitContent, type SubmitResult } from '../api/pdfClient';

export type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'rate_limited'; retryAfter: number; until: number }
  | { phase: 'error'; code: 'validation' | 'http' | 'network'; message: string };

export interface UseSubmit {
  state: SubmitState;
  submit: (content: string, onSuccess: (r: SubmitResult) => void) => void;
}

export const useSubmit = (): UseSubmit => {
  const [state, setState] = useState<SubmitState>({ phase: 'idle' });
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const submit = (content: string, onSuccess: (r: SubmitResult) => void) => {
    setState({ phase: 'submitting' });
    submitContent(content)
      .then((res) => {
        setState({ phase: 'idle' });
        onSuccess(res);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 'rate_limit') {
          const retryAfter = err.retryAfter ?? 60;
          const until = Date.now() + retryAfter * 1000;
          setState({ phase: 'rate_limited', retryAfter, until });
          timeoutRef.current = window.setTimeout(() => {
            setState({ phase: 'idle' });
            timeoutRef.current = null;
          }, retryAfter * 1000);
          return;
        }
        if (err instanceof ApiError) {
          setState({
            phase: 'error',
            code: err.code === 'validation' ? 'validation' : err.code === 'network' ? 'network' : 'http',
            message: err.message,
          });
          return;
        }
        setState({ phase: 'error', code: 'network', message: 'Unknown error' });
      });
  };

  return { state, submit };
};
