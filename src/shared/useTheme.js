import { useContext } from 'react'
import { ThemeContext } from './themeStore.js'

export function useTheme() {
  const value = useContext(ThemeContext)

  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return value
}
