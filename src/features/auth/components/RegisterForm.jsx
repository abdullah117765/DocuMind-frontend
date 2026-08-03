import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from './validation.js'

export function RegisterForm({ fieldErrors = {}, onSubmit, isLoading = false }) {
  const [values, setValues] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [clientErrors, setClientErrors] = useState({})

  function handleChange(event) {
    const { name, value } = event.target

    setValues((current) => ({
      ...current,
      [name]: value,
    }))
    setClientErrors((current) => ({ ...current, [name]: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const email = normalizeEmail(values.email)
    const emailError = validateEmail(email)
    const passwordError = validatePassword(values.password)
    const nextErrors = {
      ...(emailError ? { email: emailError } : {}),
      ...(passwordError ? { password: passwordError } : {}),
      ...(values.password !== values.confirmPassword
        ? { confirmPassword: 'Passwords do not match.' }
        : {}),
    }

    setClientErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    void onSubmit({
      email,
      password: values.password,
    }).catch(() => {})
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
        value={values.email}
      />
      <Input
        autoComplete="new-password"
        error={clientErrors.password || fieldErrors.password}
        hint="8–64 characters with upper/lowercase, a number, and @ # $ % ^ & * !"
        label="Password"
        maxLength={64}
        minLength={8}
        name="password"
        onChange={handleChange}
        required
        type="password"
        value={values.password}
      />
      <Input
        autoComplete="new-password"
        error={clientErrors.confirmPassword}
        label="Confirm password"
        maxLength={64}
        name="confirmPassword"
        onChange={handleChange}
        required
        type="password"
        value={values.confirmPassword}
      />
      <Button disabled={isLoading} type="submit">
        {isLoading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
