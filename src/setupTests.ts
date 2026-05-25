import '@testing-library/jest-dom';

// jsdom does not implement DragEvent; provide a minimal polyfill so tests
// that construct `new DragEvent(...)` work correctly.
if (typeof DragEvent === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DragEvent = class DragEvent extends MouseEvent {
    dataTransfer: DataTransfer | null;
    constructor(type: string, init: DragEventInit = {}) {
      super(type, init);
      this.dataTransfer = init.dataTransfer ?? null;
    }
  };
}
