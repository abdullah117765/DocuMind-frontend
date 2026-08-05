import { useEffect, useState } from 'react'
import {
  useLocation,
  useNavigate,
} from '../../routes/routerHooks.js'

const DEFAULT_DURATION_MS = 5000

export function useRouteFlashMessage(durationMs = DEFAULT_DURATION_MS) {
  const location = useLocation()
  const navigate = useNavigate()
  const [message, setMessage] = useState(
    () => location.state?.message ?? '',
  )

  useEffect(() => {
    if (!location.state?.message) return

    const nextState = { ...location.state }
    delete nextState.message
    const target = `${location.pathname}${location.search}${location.hash}`

    navigate(target, {
      replace: true,
      state: Object.keys(nextState).length > 0 ? nextState : null,
    })
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ])

  useEffect(() => {
    if (!message) return undefined

    const timeoutId = window.setTimeout(() => setMessage(''), durationMs)

    return () => window.clearTimeout(timeoutId)
  }, [durationMs, message])

  return {
    dismissMessage: () => setMessage(''),
    message,
    setMessage,
  }
}
