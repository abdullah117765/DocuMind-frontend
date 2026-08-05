import { useEffect, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { useNavigate } from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useRouteFlashMessage } from '../../../shared/hooks/useRouteFlashMessage.js'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { PasswordResetSteps } from '../components/PasswordResetSteps.jsx'
import { validatePassword } from '../components/validation.js'
import { useAuth } from '../hooks/useAuth.js'
import {
  getPasswordResetSession,
  resetPassword,
} from '../services/authApi.js'

const TERMINAL_SESSION_CODES = new Set([409, 410, 498])

function getRemainingSeconds(expiresAt) {
  return Math.max(Math.ceil((expiresAt - Date.now()) / 1000), 0)
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function ResetPassword() {
  const [sessionStatus, setSessionStatus] = useState('loading')
  const [expiresAt, setExpiresAt] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [values, setValues] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [clientErrors, setClientErrors] = useState({})
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { dismissMessage, message } = useRouteFlashMessage()
  const { clearAuthentication } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    getPasswordResetSession()
      .then((session) => {
        if (!active) return

        const nextExpiresAt =
          Date.now() + Math.max(Number(session.expiresInSeconds) || 0, 1) * 1000
        setExpiresAt(nextExpiresAt)
        setRemainingSeconds(getRemainingSeconds(nextExpiresAt))
        setSessionStatus('active')
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError)
        setSessionStatus('expired')
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'active' || !expiresAt) return undefined

    const updateCountdown = () => {
      const nextRemaining = getRemainingSeconds(expiresAt)
      setRemainingSeconds(nextRemaining)

      if (nextRemaining <= 0) {
        setSessionStatus('expired')
      }
    }

    updateCountdown()
    const intervalId = window.setInterval(updateCountdown, 250)
    return () => window.clearInterval(intervalId)
  }, [expiresAt, sessionStatus])

  function handleChange(event) {
    const { name, value } = event.target

    setError(null)
    setClientErrors((current) => ({ ...current, [name]: undefined }))
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const passwordError = validatePassword(values.newPassword)
    const nextErrors = {
      ...(passwordError ? { newPassword: passwordError } : {}),
      ...(values.newPassword !== values.confirmPassword
        ? { confirmPassword: 'Passwords do not match.' }
        : {}),
    }

    setClientErrors(nextErrors)
    setError(null)

    if (Object.keys(nextErrors).length > 0 || remainingSeconds <= 0) return

    setIsLoading(true)

    try {
      const response = await resetPassword({
        newPassword: values.newPassword,
      })
      clearAuthentication()
      navigate('/login', {
        replace: true,
        state: { message: response.message },
      })
    } catch (requestError) {
      if (TERMINAL_SESSION_CODES.has(requestError?.code)) {
        setSessionStatus('expired')
      }
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <AuthLayout
        description="Checking your secure password-reset session."
        footer={<Link to="/login">Back to sign in</Link>}
        title="Preparing password reset"
      >
        <PasswordResetSteps currentStep={3} />
        <Loader label="Checking reset session…" />
      </AuthLayout>
    )
  }

  if (sessionStatus === 'expired') {
    return (
      <AuthLayout
        description="For your security, verify a fresh email code before choosing a password."
        footer={<Link to="/login">Back to sign in</Link>}
        title="Reset session expired"
      >
        <PasswordResetSteps currentStep={3} />
        <Alert>
          {error?.message ??
            'Your verified password-reset session is missing or has expired.'}
        </Alert>
        <Link
          className="button button--primary button--link"
          to="/forgot-password"
        >
          Start again securely
        </Link>
      </AuthLayout>
    )
  }

  const fieldErrors = getFieldErrors(error)

  return (
    <AuthLayout
      description="Your code is verified. Create a strong password you have not used before."
      footer={<Link to="/login">Cancel and return to sign in</Link>}
      title="Create a new password"
    >
      <PasswordResetSteps currentStep={3} />
      {message && (
        <Alert onDismiss={dismissMessage} tone="success">
          {message}
        </Alert>
      )}
      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}
      <p className="reset-session-timer" role="status">
        Reset session expires in {formatCountdown(remainingSeconds)}
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <Input
          autoComplete="new-password"
          autoFocus
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
        <Button
          disabled={isLoading || remainingSeconds <= 0}
          type="submit"
        >
          {isLoading ? 'Updating password…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
