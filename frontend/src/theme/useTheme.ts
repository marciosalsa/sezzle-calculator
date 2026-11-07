import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'calculator-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Theme the user picked explicitly, if any. Storage may be unavailable (private mode). */
export function getStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function getSystemTheme(): Theme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Light/dark theme with three rules:
 * 1. Until the user chooses, follow the operating system (and its changes).
 * 2. Once the user toggles, remember the choice across visits.
 * 3. Expose the theme as `data-theme` on <html> so CSS tokens switch.
 */
export function useTheme() {
  const [stored, setStored] = useState<Theme | null>(getStoredTheme)
  const [system, setSystem] = useState<Theme>(getSystemTheme)
  const theme = stored ?? system

  useEffect(() => {
    const media = window.matchMedia?.(DARK_QUERY)
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setStored(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Ignore: the theme still changes for this visit.
    }
  }, [theme])

  return { theme, toggle }
}
