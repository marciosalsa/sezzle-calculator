import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'
import { THEME_STORAGE_KEY, getStoredTheme, getSystemTheme, useTheme } from './useTheme'

type Listener = (event: MediaQueryListEvent) => void

/** Minimal controllable matchMedia for "(prefers-color-scheme: dark)". */
function mockSystemTheme(initialDark: boolean) {
  const listeners = new Set<Listener>()
  const media = {
    matches: initialDark,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  return {
    change(dark: boolean) {
      media.matches = dark
      listeners.forEach((l) => l({ matches: dark } as MediaQueryListEvent))
    },
    listenerCount: () => listeners.size,
  }
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useTheme', () => {
  it('follows the system theme when nothing is stored', () => {
    mockSystemTheme(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('reacts to system changes until the user chooses', () => {
    const system = mockSystemTheme(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => system.change(true))
    expect(result.current.theme).toBe('dark')
  })

  it('toggles, persists the choice and then ignores system changes', () => {
    const system = mockSystemTheme(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => system.change(false))
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('light')
  })

  it('restores a stored theme over the system one', () => {
    mockSystemTheme(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('removes the system listener on unmount', () => {
    const system = mockSystemTheme(false)
    const { unmount } = renderHook(() => useTheme())
    expect(system.listenerCount()).toBe(1)
    unmount()
    expect(system.listenerCount()).toBe(0)
  })

  it('still toggles when storage is unavailable', () => {
    mockSystemTheme(false)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
  })
})

describe('theme helpers', () => {
  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    expect(getStoredTheme()).toBeNull()
  })

  it('returns null when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getStoredTheme()).toBeNull()
  })

  it('defaults to light when matchMedia is not supported', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(getSystemTheme()).toBe('light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })
})

describe('<ThemeToggle />', () => {
  it('describes the theme it switches to and calls onToggle', async () => {
    const onToggle = vi.fn()
    const { rerender } = render(<ThemeToggle theme="light" onToggle={onToggle} />)

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(onToggle).toHaveBeenCalledOnce()

    rerender(<ThemeToggle theme="dark" onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })
})
