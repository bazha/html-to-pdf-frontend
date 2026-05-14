import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePoll } from './usePoll';

vi.mock('../api/pdfClient', async () => {
  const actual = await vi.importActual<typeof import('../api/pdfClient')>(
    '../api/pdfClient',
  );
  return {
    ...actual,
    pollJob: vi.fn(),
  };
});

const { pollJob } = await import('../api/pdfClient');
const pollJobMock = pollJob as unknown as ReturnType<typeof vi.fn>;

describe('usePoll', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    pollJobMock.mockReset();
  });

  it('returns idle when jobId is null', () => {
    const { result } = renderHook(() => usePoll(null));
    expect(result.current).toMatchObject({ phase: 'idle' });
  });

  it('polls until completed', async () => {
    pollJobMock
      .mockResolvedValueOnce({ kind: 'active', state: 'waiting' })
      .mockResolvedValueOnce({ kind: 'active', state: 'active' })
      .mockResolvedValueOnce({ kind: 'completed', url: 'https://s3/x.pdf' });
    const { result } = renderHook(() => usePoll('job-1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        phase: 'completed',
        url: 'https://s3/x.pdf',
      }),
    );
    expect(pollJobMock).toHaveBeenCalledTimes(3);
  });

  it('stops on failed', async () => {
    pollJobMock.mockResolvedValue({ kind: 'failed', reason: 'oops' });
    const { result } = renderHook(() => usePoll('job-1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({ phase: 'failed', reason: 'oops' }),
    );
  });

  it('stops on not_found', async () => {
    pollJobMock.mockResolvedValue({ kind: 'not_found' });
    const { result } = renderHook(() => usePoll('job-x'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({ phase: 'error', code: 'not_found' }),
    );
  });

  it('times out after max wall-clock', async () => {
    pollJobMock.mockResolvedValue({ kind: 'active', state: 'waiting' });
    const { result } = renderHook(() =>
      usePoll('job-1', { intervalMs: 100, timeoutMs: 300 }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({ phase: 'error', code: 'timeout' }),
    );
  });
});
