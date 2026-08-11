import { useEffect, useRef, useState } from 'react'
import { NETWORK_ERROR_EVENT } from './networkEvents.js'
import { useNotifications } from './useNotifications.js'

const SERVER_WARNING_COOLDOWN_MS = 12000

function readOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function NetworkStatusMonitor() {
  const notifications = useNotifications()
  const [isOnline, setIsOnline] = useState(readOnlineStatus)
  const offlineNotificationIdRef = useRef(null)
  const lastServerWarningAtRef = useRef(0)

  useEffect(() => {
    function handleOffline() {
      setIsOnline(false)

      if (!offlineNotificationIdRef.current) {
        offlineNotificationIdRef.current = notifications.error(
          'You appear to be offline. Changes may not save until your connection is restored.',
          {
            durationMs: 0,
            title: 'Internet disconnected',
          },
        )
      }
    }

    function handleOnline() {
      setIsOnline(true)

      if (offlineNotificationIdRef.current) {
        notifications.dismiss(offlineNotificationIdRef.current)
        offlineNotificationIdRef.current = null
      }

      notifications.success('Internet connection restored.', {
        title: 'Back online',
      })
    }

    function handleServerWarning(event) {
      const now = Date.now()

      if (
        !readOnlineStatus() ||
        now - lastServerWarningAtRef.current < SERVER_WARNING_COOLDOWN_MS
      ) {
        return
      }

      lastServerWarningAtRef.current = now
      notifications.warning(
        event.detail?.message ||
          'The server is not responding. Please check your connection and try again.',
        {
          title: 'Connection problem',
        },
      )
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener(NETWORK_ERROR_EVENT, handleServerWarning)

    if (!readOnlineStatus()) {
      handleOffline()
    }

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener(NETWORK_ERROR_EVENT, handleServerWarning)
    }
  }, [notifications])

  if (isOnline) {
    return null
  }

  return (
    <div className="network-status-banner" role="status">
      <span aria-hidden="true" />
      <strong>Offline mode</strong>
      <p>Reconnect to continue syncing uploads, forms, and live progress.</p>
    </div>
  )
}
