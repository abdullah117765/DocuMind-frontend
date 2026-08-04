import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './themeStore.js'

const STORAGE_KEY = 'ai-doc-intel-theme'

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

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Theme still applies for this session even if persistence is unavailable.
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) =>
      currentTheme === 'dark' ? 'light' : 'dark',
    )
  }, [])

  const value = useMemo(
    () => ({
      setTheme,
      theme,
      toggleTheme,
    }),
    [theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
