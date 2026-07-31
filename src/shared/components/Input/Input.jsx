import { useId } from 'react'

export function Input({ error, hint, id, label, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = `${inputId}-description`

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <input
        aria-describedby={error || hint ? descriptionId : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        {...props}
      />
      {(error || hint) && (
        <span
          className={error ? 'field__error' : 'field__hint'}
          id={descriptionId}
        >
          {error || hint}
        </span>
      )}
    </label>
  )
}
