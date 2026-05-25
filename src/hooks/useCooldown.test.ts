import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCooldown } from './useCooldown';
import type { SubmitState } from './useSubmit';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const idle: SubmitState = { phase: 'idle' };
const rateLimited = (retryAfter: number): SubmitState => ({
  phase: 'rate_limited',
  retryAfter,
  until: Date.now() + retryAfter * 1000,
});

describe('useCooldown', () => {
  it('returns null when not rate_limited', () => {
    const { result } = renderHook(() => useCooldown(idle));
    expect(result.current).toBeNull();
  });

  it('seeds with retryAfter when entering rate_limited', () => {
    const { result, rerender } = renderHook(({ s }) => useCooldown(s), {
      initialProps: { s: idle as SubmitState },
    });
    rerender({ s: rateLimited(30) });
    expect(result.current).toBe(30);
  });

  it('ticks down each second', () => {
    const { result, rerender } = renderHook(({ s }) => useCooldown(s), {
      initialProps: { s: idle as SubmitState },
    });
    rerender({ s: rateLimited(5) });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(4);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(1);
  });

  it('clamps to 0 and does not go negative', () => {
    const { result, rerender } = renderHook(({ s }) => useCooldown(s), {
      initialProps: { s: idle as SubmitState },
    });
    rerender({ s: rateLimited(2) });
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current).toBe(0);
  });

  it('returns to null when phase leaves rate_limited', () => {
    const { result, rerender } = renderHook(({ s }) => useCooldown(s), {
      initialProps: { s: rateLimited(10) },
    });
    rerender({ s: idle });
    expect(result.current).toBeNull();
  });
});
