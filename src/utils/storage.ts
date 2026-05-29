// Thin localStorage wrappers that swallow access errors (private mode, disabled
// storage, quota). Callers treat in-memory state as authoritative; persistence is
// best-effort. A stateful useLocalStorage hook is deliberately avoided — consumers
// have divergent needs (versioning, debounced writes, skip-next-persist) that don't
// fit one generic hook.

export const safeGetItem = (key: string): string | null => {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

export const safeSetItem = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value)
    } catch {
        // private mode or quota; ignore.
    }
}

export const safeRemoveItem = (key: string): void => {
    try {
        localStorage.removeItem(key)
    } catch {
        // ignored
    }
}
