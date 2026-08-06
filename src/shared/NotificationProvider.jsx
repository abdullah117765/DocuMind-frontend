import { useCallback, useEffect, useMemo, useState } from 'react'
import { NotificationContext } from './notificationStore.js'

let nextNotificationId = 0

const DEFAULT_DURATIONS = {
  error: 6500,
  info: 4200,
  success: 3600,
  warning: 6000,
}

const toastIcons = {
  error: '!',
  info: 'i',
  success: '✓',
  warning: '!',
}

function getDefaultDuration(tone) {
  return DEFAULT_DURATIONS[tone] ?? DEFAULT_DURATIONS.info
}

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
      <span aria-hidden="true" className="toast__icon">
        {toastIcons[notification.tone] ?? toastIcons.info}
      </span>
      <div className="toast__content">
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
    const tone = options.tone ?? 'info'
    const id = `notification-${Date.now()}-${nextNotificationId}`
    nextNotificationId += 1
    const nextNotification = {
      durationMs: options.durationMs ?? getDefaultDuration(tone),
      id,
      message,
      title: options.title ?? '',
      tone,
    }

    setNotifications((current) => {
      const withoutDuplicate = current.filter(
        (notification) =>
          notification.message !== nextNotification.message ||
          notification.tone !== nextNotification.tone ||
          notification.title !== nextNotification.title,
      )

      return [...withoutDuplicate, nextNotification].slice(-3)
    })

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
      warning: (message, options = {}) =>
        notify(message, { ...options, tone: 'warning' }),
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
