export function Alert({ children, title, tone = 'error' }) {
  return (
    <div
      className={`alert alert--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {title && <strong>{title}</strong>}
      <span>{children}</span>
    </div>
  )
}
