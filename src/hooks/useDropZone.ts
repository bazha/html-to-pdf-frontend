import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';

interface Bind {
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

export interface UseDropZone {
  isDragOver: boolean;
  bind: Bind;
}

export const useDropZone = (onFile: (file: File) => void): UseDropZone => {
  const [isDragOver, setIsDragOver] = useState(false);
  const depth = useRef(0);

  const reset = useCallback(() => {
    depth.current = 0;
    setIsDragOver(false);
  }, []);

  // Window-level safety net. `dragend` only fires for in-page drag sources,
  // so it does NOT cover the common case of dragging a file in from Finder
  // and back out of the window. `dragleave` on the window with no
  // relatedTarget (cursor left the document) plus a window `drop` listener
  // covers both external-leave and drops outside our zone.
  useEffect(() => {
    const onWindowDragLeave = (e: globalThis.DragEvent) => {
      if (e.relatedTarget === null) reset();
    };
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('drop', reset);
    return () => {
      window.removeEventListener('dragleave', onWindowDragLeave);
      window.removeEventListener('drop', reset);
    };
  }, [reset]);

  const bind: Bind = {
    onDragEnter: (e) => {
      e.preventDefault();
      depth.current += 1;
      setIsDragOver(true);
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      reset();
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
  };

  return { isDragOver, bind };
};
