import { useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { requestPasswordReset } from '../services/authApi.js'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await requestPasswordReset(email)
      setMessage(response.message)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }

  if (message) {
    return (
      <AuthLayout
        description="If this address belongs to an account, a six-digit code is on its way."
        footer={<Link to="/login">Return to sign in</Link>}
        title="Check your inbox"
      >
        <Alert tone="success">{message}</Alert>
        <Link
          className="button button--primary button--link"
          to={`/reset-password?email=${encodeURIComponent(email)}`}
        >
          Enter reset code
        </Link>
      </AuthLayout>
    )
  }

  const fieldErrors = getFieldErrors(error)

  return (
    <AuthLayout
      description="We will email a time-limited, one-time reset code."
      footer={<Link to="/login">Back to sign in</Link>}
      title="Reset your password"
    >
      {error && <Alert>{error.message}</Alert>}
      <form className="form" onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          error={fieldErrors.email}
          label="Account email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <Button disabled={isLoading} type="submit">
          {isLoading ? 'Sending code…' : 'Send reset code'}
        </Button>
      </form>
    </AuthLayout>
  )
}
