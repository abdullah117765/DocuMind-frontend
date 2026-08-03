import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { normalizeEmail, validateEmail } from './validation.js'

export function LoginForm({
  fieldErrors = {},
  onChange,
  onSubmit,
  isLoading = false,
}) {
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [clientErrors, setClientErrors] = useState({})

  function handleChange(event) {
    const { name, value } = event.target

    setCredentials((current) => ({
      ...current,
      [name]: value,
    }))
    setClientErrors((current) => ({ ...current, [name]: undefined }))
    onChange?.()
  }

  function handleSubmit(event) {
    event.preventDefault()
    const email = normalizeEmail(credentials.email)
    const emailError = validateEmail(email)

    setClientErrors(emailError ? { email: emailError } : {})

    if (emailError) return

    void onSubmit({ ...credentials, email }).catch(() => {})
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Input
        autoComplete="email"
        error={clientErrors.email || fieldErrors.email}
        label="Email"
        name="email"
        onChange={handleChange}
        placeholder="you@example.com"
        required
        type="email"
        value={credentials.email}
      />
      <Input
        autoComplete="current-password"
        error={fieldErrors.password}
        label="Password"
        name="password"
        onChange={handleChange}
        placeholder="Enter your password"
        required
        type="password"
        value={credentials.password}
      />
      <Button disabled={isLoading} type="submit">
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
