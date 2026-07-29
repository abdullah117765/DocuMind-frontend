export function Loader({ label = 'Loading' }) {
  return (
    <div aria-live="polite" className="loader" role="status">
      <span className="loader__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
