import { useEffect, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { useRouteFlashMessage } from '../../../shared/hooks/useRouteFlashMessage.js'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { PasswordResetSteps } from '../components/PasswordResetSteps.jsx'
import { normalizeEmail, validateEmail } from '../components/validation.js'
import {
  requestPasswordReset,
  verifyPasswordResetOtp,
} from '../services/authApi.js'

function getRemainingSeconds(cooldownEndsAt) {
  return Math.max(Math.ceil((cooldownEndsAt - Date.now()) / 1000), 0)
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function VerifyResetCode() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryEmail = normalizeEmail(searchParams.get('email') ?? '')
  const email = normalizeEmail(location.state?.email ?? queryEmail)
  const [otp, setOtp] = useState('')
  const [clientError, setClientError] = useState('')
  const [error, setError] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldownEndsAt, setCooldownEndsAt] = useState(
    () => Number(location.state?.cooldownEndsAt) || 0,
  )
  const [cooldownSeconds, setCooldownSeconds] = useState(() =>
    getRemainingSeconds(Number(location.state?.cooldownEndsAt) || 0),
  )
  const [otpExpiresAt, setOtpExpiresAt] = useState(
    () => Number(location.state?.otpExpiresAt) || 0,
  )
  const [otpSeconds, setOtpSeconds] = useState(() =>
    getRemainingSeconds(Number(location.state?.otpExpiresAt) || 0),
  )
  const { dismissMessage, message, setMessage } = useRouteFlashMessage()

  useEffect(() => {
    const updateCountdown = () => {
      setCooldownSeconds(getRemainingSeconds(cooldownEndsAt))
    }

    updateCountdown()

    if (!cooldownEndsAt || cooldownEndsAt <= Date.now()) return undefined

    const intervalId = window.setInterval(updateCountdown, 250)

    return () => window.clearInterval(intervalId)
  }, [cooldownEndsAt])

  useEffect(() => {
    const updateCountdown = () => {
      setOtpSeconds(getRemainingSeconds(otpExpiresAt))
    }

    updateCountdown()

    if (!otpExpiresAt || otpExpiresAt <= Date.now()) return undefined

    const intervalId = window.setInterval(updateCountdown, 250)
    return () => window.clearInterval(intervalId)
  }, [otpExpiresAt])

  useEffect(() => {
    if (!queryEmail || location.state?.email) return

    navigate('/verify-reset-code', {
      replace: true,
      state: { ...location.state, email: queryEmail },
    })
  }, [location.state, navigate, queryEmail])

  async function handleVerify(event) {
    event.preventDefault()
    const emailError = validateEmail(email)
    const otpError =
      otpSeconds <= 0
        ? 'This code has expired. Request a new code.'
        : otp.length === 6
          ? ''
          : 'Enter the complete six-digit code.'

    setClientError(emailError || otpError)
    setError(null)

    if (emailError || otpError) return

    setIsVerifying(true)

    try {
      const response = await verifyPasswordResetOtp({ email, otp })
      navigate('/reset-password', {
        replace: true,
        state: { message: response.message },
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    const emailError = validateEmail(email)

    setClientError(emailError)
    setError(null)

    if (emailError) return

    setIsResending(true)

    try {
      const response = await requestPasswordReset(email)
      setCooldownEndsAt(
        Date.now() + Math.max(response.cooldownSeconds, 1) * 1000,
      )
      setOtpExpiresAt(
        Date.now() + Math.max(response.expiresInSeconds, 1) * 1000,
      )
      setOtp('')
      setMessage(response.message)
    } catch (requestError) {
      const retryAfterSeconds = Number(
        requestError?.details?.retryAfterSeconds,
      )

      if (retryAfterSeconds > 0) {
        setCooldownEndsAt(Date.now() + retryAfterSeconds * 1000)
      }

      setError(requestError)
    } finally {
      setIsResending(false)
    }
  }

  if (!email || validateEmail(email)) {
    return (
      <AuthLayout
        description="Start again so we know where to send your verification code."
        footer={<Link to="/login">Back to sign in</Link>}
        title="Verification link is incomplete"
      >
        <PasswordResetSteps currentStep={2} />
        <Alert>Enter your account email before verifying a code.</Alert>
        <Link
          className="button button--primary button--link"
          to="/forgot-password"
        >
          Start password reset
        </Link>
      </AuthLayout>
    )
  }

  const fieldErrors = getFieldErrors(error)

  return (
    <AuthLayout
      description="Enter the six-digit code from your email. The code can only be used once."
      footer={
        <>
          <Button
            className="resend-button"
            disabled={isResending || cooldownSeconds > 0}
            onClick={handleResend}
            variant="secondary"
          >
            {isResending
              ? 'Sending code...'
              : cooldownSeconds > 0
                ? `Resend code in ${cooldownSeconds}s`
                : 'Resend code'}
          </Button>{' '}
          · <Link to="/forgot-password">Use a different email</Link>
        </>
      }
      title="Verify your identity"
    >
      <PasswordResetSteps currentStep={2} />
      {message && (
        <Alert onDismiss={dismissMessage} tone="success">
          {message}
        </Alert>
      )}
      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}
      {otpSeconds <= 0 && (
        <Alert>
          This code has expired. Use the resend button to receive a fresh
          two-minute code.
        </Alert>
      )}
      <div className="reset-identity">
        <span>Verification code sent to</span>
        <strong>{email}</strong>
        <span>
          {otpSeconds > 0
            ? `Code expires in ${formatCountdown(otpSeconds)}`
            : 'Code expired'}
        </span>
      </div>
      <form className="form" onSubmit={handleVerify}>
        <Input
          autoComplete="one-time-code"
          autoFocus
          className="otp-input"
          error={clientError || fieldErrors.otp}
          inputMode="numeric"
          label="Six-digit verification code"
          maxLength={6}
          name="otp"
          onChange={(event) => {
            setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
            setClientError('')
            setError(null)
          }}
          placeholder="000000"
          required
          value={otp}
        />
        <Button disabled={isVerifying || otpSeconds <= 0} type="submit">
          {isVerifying ? 'Verifying...' : 'Verify code'}
        </Button>
      </form>
    </AuthLayout>
  )
}
