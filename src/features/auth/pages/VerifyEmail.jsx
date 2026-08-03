import { useEffect, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import {
  useLocation,
  useNavigate,
} from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { VerificationEmailResend } from '../components/VerificationEmailResend.jsx'
import { verifyEmail } from '../services/authApi.js'

const TERMINAL_REASONS = new Set([
  'VERIFICATION_LINK_EXPIRED',
  'INVALID_VERIFICATION_LINK',
  'VERIFICATION_LINK_USED',
])

export function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const fragmentParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const legacyQueryParams = new URLSearchParams(location.search)
  const urlToken =
    fragmentParams.get('token')?.trim() ??
    legacyQueryParams.get('token')?.trim() ??
    ''
  const [token] = useState(
    () => urlToken || location.state?.verificationToken || '',
  )
  const [result, setResult] = useState({
    status: token ? 'ready' : 'error',
    message: token
      ? ''
      : 'This verification link is incomplete. Request a fresh link below.',
    reason: token ? '' : 'INVALID_VERIFICATION_LINK',
  })

  useEffect(() => {
    if (!urlToken) return

    navigate('/verify-email', {
      replace: true,
      state: { verificationToken: urlToken },
    })
  }, [navigate, urlToken])

  async function handleVerification() {
    if (!token) return

    setResult({ status: 'loading', message: '', reason: '' })

    try {
      const response = await verifyEmail(token)
      navigate('/verify-email', { replace: true })
      setResult({
        status: 'success',
        message: response.message,
        reason: response.data?.state ?? 'VERIFIED',
      })
    } catch (error) {
      const reason = error?.details?.reason ?? ''

      if (TERMINAL_REASONS.has(reason)) {
        navigate('/verify-email', { replace: true })
      }

      setResult({ status: 'error', message: error.message, reason })
    }
  }

  const canResend =
    result.status === 'error' &&
    (!result.reason || TERMINAL_REASONS.has(result.reason))

  return (
    <AuthLayout
      description="Confirm the request, then continue securely to sign in."
      footer={<Link to="/login">Return to sign in</Link>}
      title={
        result.reason === 'VERIFICATION_LINK_EXPIRED'
          ? 'Verification link expired'
          : 'Email verification'
      }
    >
      {result.status === 'ready' && (
        <>
          <Alert tone="info">
            Select confirm to verify the email address associated with this
            secure link.
          </Alert>
          <Button onClick={handleVerification}>Confirm email address</Button>
        </>
      )}
      {result.status === 'loading' && (
        <Button disabled>Verifying email…</Button>
      )}
      {result.status === 'success' && (
        <Alert tone="success">{result.message}</Alert>
      )}
      {result.status === 'error' && <Alert>{result.message}</Alert>}
      {canResend && (
        <div className="auth-recovery-section">
          <p className="supporting-copy">
            Enter your account email and we will send a new, single-use link.
          </p>
          <VerificationEmailResend />
        </div>
      )}
    </AuthLayout>
  )
}
