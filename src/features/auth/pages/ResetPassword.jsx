import { useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import {
  useNavigate,
  useSearchParams,
} from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { validatePassword } from '../components/validation.js'
import { useAuth } from '../hooks/useAuth.js'
import { resetPassword } from '../services/authApi.js'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [values, setValues] = useState({
    email: searchParams.get('email') ?? '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [clientErrors, setClientErrors] = useState({})
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { clearAuthentication } = useAuth()
  const navigate = useNavigate()

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({
      ...current,
      [name]: name === 'otp' ? value.replace(/\D/g, '').slice(0, 6) : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const passwordError = validatePassword(values.newPassword)
    const nextErrors = {
      ...(values.otp.length !== 6
        ? { otp: 'Enter the complete six-digit code.' }
        : {}),
      ...(passwordError ? { newPassword: passwordError } : {}),
      ...(values.newPassword !== values.confirmPassword
        ? { confirmPassword: 'Passwords do not match.' }
        : {}),
    }

    setClientErrors(nextErrors)
    setError(null)

    if (Object.keys(nextErrors).length > 0) return

    setIsLoading(true)

    try {
      const response = await resetPassword({
        email: values.email,
        otp: values.otp,
        newPassword: values.newPassword,
      })
      clearAuthentication()
      navigate('/login', {
        replace: true,
        state: { message: response.message },
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }

  const fieldErrors = getFieldErrors(error)

  return (
    <AuthLayout
      description="Enter the code exactly as shown in the email, including any leading zero."
      footer={
        <>
          Need another code? <Link to="/forgot-password">Request one</Link>
        </>
      }
      title="Choose a new password"
    >
      {error && <Alert>{error.message}</Alert>}
      <form className="form" onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          error={fieldErrors.email}
          label="Account email"
          name="email"
          onChange={handleChange}
          required
          type="email"
          value={values.email}
        />
        <Input
          autoComplete="one-time-code"
          error={clientErrors.otp || fieldErrors.otp}
          inputMode="numeric"
          label="Six-digit code"
          maxLength={6}
          name="otp"
          onChange={handleChange}
          placeholder="000000"
          required
          value={values.otp}
        />
        <Input
          autoComplete="new-password"
          error={clientErrors.newPassword || fieldErrors.newPassword}
          hint="8–64 characters with upper/lowercase, a number, and @ # $ % ^ & * !"
          label="New password"
          maxLength={64}
          minLength={8}
          name="newPassword"
          onChange={handleChange}
          required
          type="password"
          value={values.newPassword}
        />
        <Input
          autoComplete="new-password"
          error={clientErrors.confirmPassword}
          label="Confirm new password"
          maxLength={64}
          name="confirmPassword"
          onChange={handleChange}
          required
          type="password"
          value={values.confirmPassword}
        />
        <Button disabled={isLoading} type="submit">
          {isLoading ? 'Updating password…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
