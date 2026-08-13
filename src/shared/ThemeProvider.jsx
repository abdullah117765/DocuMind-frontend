import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './themeStore.js'

const STORAGE_KEY = 'ai-doc-intel-theme'
const NAV_LAYOUT_STORAGE_KEY = 'ai-doc-intel-nav-layout'

function getInitialTheme() {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY)

    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getInitialNavLayout() {
  try {
    const storedLayout = window.localStorage.getItem(NAV_LAYOUT_STORAGE_KEY)

    if (storedLayout === 'sidebar' || storedLayout === 'topbar') {
      return storedLayout
    }
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }

  return 'sidebar'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  const [navLayout, setNavLayout] = useState(getInitialNavLayout)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Theme still applies for this session even if persistence is unavailable.
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.navLayout = navLayout

    try {
      window.localStorage.setItem(NAV_LAYOUT_STORAGE_KEY, navLayout)
    } catch {
      // Layout still applies for this session even if persistence is unavailable.
    }
  }, [navLayout])

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) =>
      currentTheme === 'dark' ? 'light' : 'dark',
    )
  }, [])

  const toggleNavLayout = useCallback(() => {
    setNavLayout((currentLayout) =>
      currentLayout === 'sidebar' ? 'topbar' : 'sidebar',
    )
  }, [])

  const value = useMemo(
    () => ({
      setTheme,
      setNavLayout,
      navLayout,
      theme,
      toggleNavLayout,
      toggleTheme,
    }),
    [navLayout, theme, toggleNavLayout, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
