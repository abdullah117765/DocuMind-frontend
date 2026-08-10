import { useEffect } from 'react'

export function Alert({
  autoDismissMs,
  children,
  onDismiss,
  title,
  tone = 'error',
}) {
  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return undefined

    const timer = window.setTimeout(onDismiss, autoDismissMs)

    return () => window.clearTimeout(timer)
  }, [autoDismissMs, onDismiss])

  return (
    <div
      className={`alert alert--${tone}${onDismiss ? ' alert--dismissible' : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="alert__content">
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </span>
      {onDismiss && (
        <button
          aria-label="Dismiss notification"
          className="alert__dismiss"
          onClick={onDismiss}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  )
}
