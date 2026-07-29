import { useId } from 'react'

export function Input({ id, label, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label className="field" htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} {...props} />
    </label>
  )
}
