import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSubmit } from './useSubmit';
import { ApiError } from '../api/pdfClient';

vi.mock('../api/pdfClient', async () => {
  const actual = await vi.importActual<typeof import('../api/pdfClient')>(
    '../api/pdfClient',
  );
  return {
    ...actual,
    submitContent: vi.fn(),
  };
});

const { submitContent } = await import('../api/pdfClient');
const submitContentMock = submitContent as unknown as ReturnType<typeof vi.fn>;

describe('useSubmit', () => {
  afterEach(() => {
    vi.useRealTimers();
    submitContentMock.mockReset();
  });

  it('returns idle initially', () => {
    const { result } = renderHook(() => useSubmit());
    expect(result.current.state).toEqual({ phase: 'idle' });
  });

  it('transitions to submitting then success', async () => {
    submitContentMock.mockResolvedValue({
      jobId: 'j1',
      file: 'f.pdf',
      detectedType: 'html',
    });
    const { result } = renderHook(() => useSubmit());
    const onResult = vi.fn();
    act(() => {
      result.current.submit('hello world ten plus chars', onResult);
    });
    expect(result.current.state.phase).toBe('submitting');
    await waitFor(() => expect(result.current.state.phase).toBe('idle'));
    expect(onResult).toHaveBeenCalledWith({
      jobId: 'j1',
      file: 'f.pdf',
      detectedType: 'html',
    });
  });

  it('exposes rate_limit cooldown from Retry-After', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    submitContentMock.mockRejectedValue(
      new ApiError('rate_limit', 'Rate limited', 429, 5),
    );
    const { result } = renderHook(() => useSubmit());
    act(() => {
      result.current.submit('content long enough', vi.fn());
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({ phase: 'rate_limited', retryAfter: 5 }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await waitFor(() => expect(result.current.state.phase).toBe('idle'));
  });

  it('surfaces validation errors', async () => {
    submitContentMock.mockRejectedValue(
      new ApiError('validation', 'Validation error: Content too short'),
    );
    const { result } = renderHook(() => useSubmit());
    act(() => {
      result.current.submit('short', vi.fn());
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        phase: 'error',
        code: 'validation',
        message: expect.stringContaining('too short'),
      }),
    );
  });
});
