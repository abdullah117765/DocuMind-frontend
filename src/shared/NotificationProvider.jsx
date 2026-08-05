import { useCallback, useEffect, useMemo, useState } from 'react'
import { NotificationContext } from './notificationStore.js'

let nextNotificationId = 0

function Toast({ notification, onDismiss }) {
  useEffect(() => {
    if (!notification.durationMs) return undefined

    const timer = window.setTimeout(
      () => onDismiss(notification.id),
      notification.durationMs,
    )

    return () => window.clearTimeout(timer)
  }, [notification.durationMs, notification.id, onDismiss])

  return (
    <article
      className={`toast toast--${notification.tone}`}
      role={notification.tone === 'error' ? 'alert' : 'status'}
    >
      <div>
        {notification.title && <strong>{notification.title}</strong>}
        <p>{notification.message}</p>
      </div>
      <button
        aria-label="Dismiss notification"
        onClick={() => onDismiss(notification.id)}
        type="button"
      >
        ×
      </button>
    </article>
  )
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const dismiss = useCallback((id) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    )
  }, [])

  const notify = useCallback((message, options = {}) => {
    const id = `notification-${Date.now()}-${nextNotificationId}`
    nextNotificationId += 1

    setNotifications((current) => [
      ...current,
      {
        durationMs: options.durationMs ?? 5000,
        id,
        message,
        title: options.title ?? '',
        tone: options.tone ?? 'info',
      },
    ])

    return id
  }, [])

  const value = useMemo(
    () => ({
      dismiss,
      error: (message, options = {}) =>
        notify(message, { ...options, tone: 'error' }),
      info: (message, options = {}) =>
        notify(message, { ...options, tone: 'info' }),
      notify,
      success: (message, options = {}) =>
        notify(message, { ...options, tone: 'success' }),
    }),
    [dismiss, notify],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="notification-region">
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
