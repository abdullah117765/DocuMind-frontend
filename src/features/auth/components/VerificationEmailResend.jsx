import { useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { normalizeEmail, validateEmail } from './validation.js'
import { resendVerificationEmail } from '../services/authApi.js'

function getRemainingSeconds(endsAt) {
  return Math.max(Math.ceil((endsAt - Date.now()) / 1000), 0)
}

export function VerificationEmailResend({ initialEmail = '' }) {
  const normalizedInitialEmail = normalizeEmail(initialEmail)
  const [email, setEmail] = useState(normalizedInitialEmail)
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    setEmail(normalizedInitialEmail)
  }, [normalizedInitialEmail])

  useEffect(() => {
    const updateCountdown = () => {
      setCooldownSeconds(getRemainingSeconds(cooldownEndsAt))
    }

    updateCountdown()

    if (!cooldownEndsAt || cooldownEndsAt <= Date.now()) return undefined

    const intervalId = window.setInterval(updateCountdown, 250)
    return () => window.clearInterval(intervalId)
  }, [cooldownEndsAt])

  async function handleSubmit(event) {
    event.preventDefault()
    const normalizedEmail = normalizeEmail(email)
    const validationError = validateEmail(normalizedEmail)

    setEmailError(validationError)
    setError(null)
    setMessage('')

    if (validationError) return

    setIsSending(true)

    try {
      const response = await resendVerificationEmail(normalizedEmail)
      setMessage(response.message)
      setCooldownEndsAt(
        Date.now() + Math.max(response.cooldownSeconds, 1) * 1000,
      )
    } catch (requestError) {
      const retryAfterSeconds = Number(
        requestError?.details?.retryAfterSeconds,
      )

      if (retryAfterSeconds > 0) {
        setCooldownEndsAt(Date.now() + retryAfterSeconds * 1000)
      }
      setError(requestError)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form className="form verification-resend" onSubmit={handleSubmit}>
      {!normalizedInitialEmail && (
        <Input
          autoComplete="email"
          error={emailError}
          label="Account email"
          name="verificationEmail"
          onChange={(event) => {
            setEmail(event.target.value)
            setEmailError('')
            setError(null)
            setMessage('')
          }}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      )}
      {message && (
        <Alert onDismiss={() => setMessage('')} tone="success">
          {message}
        </Alert>
      )}
      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}
      <Button disabled={isSending || cooldownSeconds > 0} type="submit">
        {isSending
          ? 'Sending verification email…'
          : cooldownSeconds > 0
            ? `Send another link in ${cooldownSeconds}s`
            : 'Send a new verification link'}
      </Button>
    </form>
  )
}
