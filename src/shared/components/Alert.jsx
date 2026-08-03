export function Alert({ children, onDismiss, title, tone = 'error' }) {
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
