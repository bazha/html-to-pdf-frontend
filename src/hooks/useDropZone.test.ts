import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDropZone } from './useDropZone';

const file = new File(['hi'], 'x.md', { type: 'text/markdown' });
const dt = () => ({ files: [file], dropEffect: 'none' as DataTransfer['dropEffect'] });
const ev = (overrides: object = {}) => ({
  preventDefault: vi.fn(),
  dataTransfer: dt(),
  ...overrides,
});

describe('useDropZone', () => {
  it('starts not-dragging', () => {
    const { result } = renderHook(() => useDropZone(vi.fn()));
    expect(result.current.isDragOver).toBe(false);
  });

  it('sets isDragOver on first dragEnter, clears on drop', () => {
    const onFile = vi.fn();
    const { result } = renderHook(() => useDropZone(onFile));
    act(() => result.current.bind.onDragEnter(ev() as never));
    expect(result.current.isDragOver).toBe(true);
    act(() => result.current.bind.onDrop(ev() as never));
    expect(result.current.isDragOver).toBe(false);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('handles nested enter/leave via depth counting', () => {
    const { result } = renderHook(() => useDropZone(vi.fn()));
    act(() => result.current.bind.onDragEnter(ev() as never)); // depth 1
    act(() => result.current.bind.onDragEnter(ev() as never)); // depth 2 (entering a child)
    act(() => result.current.bind.onDragLeave(ev() as never)); // depth 1 — still over
    expect(result.current.isDragOver).toBe(true);
    act(() => result.current.bind.onDragLeave(ev() as never)); // depth 0 — leaving
    expect(result.current.isDragOver).toBe(false);
  });

  it('resets when window dragleave fires with null relatedTarget (cursor left window)', () => {
    const { result } = renderHook(() => useDropZone(vi.fn()));
    act(() => result.current.bind.onDragEnter(ev() as never));
    expect(result.current.isDragOver).toBe(true);
    act(() => {
      window.dispatchEvent(
        new DragEvent('dragleave', { bubbles: true }),
      );
    });
    expect(result.current.isDragOver).toBe(false);
  });

  it('resets on window drop (drop landed outside the zone)', () => {
    const { result } = renderHook(() => useDropZone(vi.fn()));
    act(() => result.current.bind.onDragEnter(ev() as never));
    act(() => {
      window.dispatchEvent(new DragEvent('drop', { bubbles: true }));
    });
    expect(result.current.isDragOver).toBe(false);
  });

  it('does not call onFile if drop has no files', () => {
    const onFile = vi.fn();
    const { result } = renderHook(() => useDropZone(onFile));
    act(() =>
      result.current.bind.onDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: [] },
      } as never),
    );
    expect(onFile).not.toHaveBeenCalled();
  });
});
