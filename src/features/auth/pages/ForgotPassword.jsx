import { useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { useNavigate } from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { PasswordResetSteps } from '../components/PasswordResetSteps.jsx'
import { VerificationEmailResend } from '../components/VerificationEmailResend.jsx'
import { normalizeEmail, validateEmail } from '../components/validation.js'
import { requestPasswordReset } from '../services/authApi.js'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [clientError, setClientError] = useState('')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    const normalizedEmail = normalizeEmail(email)
    const emailError = validateEmail(normalizedEmail)

    setClientError(emailError)
    setError(null)

    if (emailError) return

    setIsLoading(true)

    try {
      const response = await requestPasswordReset(normalizedEmail)
      const cooldownEndsAt =
        Date.now() + Math.max(response.cooldownSeconds, 1) * 1000
      const otpExpiresAt =
        Date.now() + Math.max(response.expiresInSeconds, 1) * 1000

      navigate('/verify-reset-code', {
        state: {
          cooldownEndsAt,
          email: normalizedEmail,
          message: response.message,
          otpExpiresAt,
        },
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
      description="We will email a time-limited, one-time reset code."
      footer={<Link to="/login">Back to sign in</Link>}
      title="Reset your password"
    >
      <PasswordResetSteps currentStep={1} />
      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}
      {error?.details?.reason === 'EMAIL_NOT_VERIFIED' && (
        <div className="auth-recovery-section">
          <p className="supporting-copy">
            Verify this account first, then return to reset its password.
          </p>
          <VerificationEmailResend initialEmail={normalizeEmail(email)} />
        </div>
      )}
      <form className="form" onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          error={clientError || fieldErrors.email}
          label="Account email"
          name="email"
          onChange={(event) => {
            setEmail(event.target.value)
            setClientError('')
            setError(null)
          }}
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
