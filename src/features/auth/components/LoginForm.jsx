import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'

export function LoginForm({ onSubmit, isLoading = false }) {
  const [credentials, setCredentials] = useState({ email: '', password: '' })

  function handleChange(event) {
    setCredentials((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit(credentials)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Input
        label="Email"
        name="email"
        onChange={handleChange}
        required
        type="email"
        value={credentials.email}
      />
      <Input
        label="Password"
        name="password"
        onChange={handleChange}
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
