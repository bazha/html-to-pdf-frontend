import {useEffect, useState} from 'react'
import {STORAGE_KEYS} from '../constants'
import {safeGetItem, safeSetItem} from '../utils/storage'

type Theme = 'auto' | 'light' | 'dark'

const readStored = (): Theme => {
    const v = safeGetItem(STORAGE_KEYS.theme)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
    return 'auto'
}

const apply = (theme: Theme): void => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
}

const SunIcon = () => (
    <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
    >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </svg>
)
const AutoIcon = () => (
    <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M9 21h6M12 17v4" />
    </svg>
)
const MoonIcon = () => (
    <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
)

const OPTIONS: {value: Theme; label: string; Icon: React.FC}[] = [
    {value: 'light', label: 'Light theme', Icon: SunIcon},
    {value: 'auto', label: 'Match system', Icon: AutoIcon},
    {value: 'dark', label: 'Dark theme', Icon: MoonIcon},
]

export const ThemeSwitcher = () => {
    const [theme, setTheme] = useState<Theme>(readStored)

    useEffect(() => {
        apply(theme)
        safeSetItem(STORAGE_KEYS.theme, theme)
    }, [theme])

    const activeIdx = OPTIONS.findIndex((o) => o.value === theme)

    return (
        <div className="segmented segmented--icons" role="radiogroup" aria-label="Theme">
            <span
                className="segmented__indicator"
                style={{transform: `translateX(${activeIdx * 26}px)`}}
                aria-hidden="true"
            />
            {OPTIONS.map(({value, label, Icon}) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={theme === value}
                    aria-label={label}
                    title={label}
                    className={`segmented__opt${theme === value ? ' is-active' : ''}`}
                    onClick={() => setTheme(value)}
                >
                    <Icon />
                </button>
            ))}
        </div>
    )
}
