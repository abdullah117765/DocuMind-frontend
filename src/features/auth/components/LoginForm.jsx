import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'

export function LoginForm({ fieldErrors = {}, onSubmit, isLoading = false }) {
  const [credentials, setCredentials] = useState({ email: '', password: '' })

  function handleChange(event) {
    setCredentials((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    void onSubmit(credentials).catch(() => {})
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Input
        autoComplete="email"
        error={fieldErrors.email}
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
