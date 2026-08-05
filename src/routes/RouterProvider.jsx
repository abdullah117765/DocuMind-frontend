import { useCallback, useEffect, useMemo, useState } from 'react'
import { RouterContext } from './routerContext.js'

function readLocation() {
  return {
    hash: window.location.hash,
    pathname: window.location.pathname,
    search: window.location.search,
    state: window.history.state,
  }
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation())
    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((target, options = {}) => {
    if (typeof target === 'number') {
      window.history.go(target)
      return
    }

    const nextUrl = new URL(target, window.location.href)

    if (nextUrl.origin !== window.location.origin) {
      throw new Error('Programmatic navigation is limited to this application.')
    }

    const method = options.replace ? 'replaceState' : 'pushState'
    window.history[method](
      options.state ?? null,
      '',
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    )
    setLocation(readLocation())
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const value = useMemo(
    () => ({ location, navigate }),
    [location, navigate],
  )

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  )
}
