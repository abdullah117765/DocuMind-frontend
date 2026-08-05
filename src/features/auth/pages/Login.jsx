import { useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { useLocation, useNavigate } from '../../../routes/routerHooks.js'
import loginDocumentArtwork from '../../../shared/assets/login-document-3d.png'
import { Alert } from '../../../shared/components/Alert.jsx'
import { useRouteFlashMessage } from '../../../shared/hooks/useRouteFlashMessage.js'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { LoginForm } from '../components/LoginForm.jsx'
import { VerificationEmailResend } from '../components/VerificationEmailResend.jsx'
import { useLogin } from '../hooks/useLogin.js'

export function Login() {
  const { clearError, error, isLoading, login } = useLogin()
  const location = useLocation()
  const navigate = useNavigate()
  const { dismissMessage, message } = useRouteFlashMessage()
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const invitedEmail =
    typeof location.state?.email === 'string' ? location.state.email : ''

  async function handleLogin(credentials) {
    try {
      await login(credentials)
    } catch (requestError) {
      if (requestError?.details?.reason === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(credentials.email)
      }
      throw requestError
    }
    const fromLocation = location.state?.from
    const requestedPath =
      typeof fromLocation?.pathname === 'string'
        ? `${fromLocation.pathname}${fromLocation.search ?? ''}${fromLocation.hash ?? ''}`
        : undefined
    const isSafeInternalPath =
      typeof requestedPath === 'string' &&
      requestedPath.startsWith('/') &&
      !requestedPath.startsWith('//') &&
      !requestedPath.includes('\\')

    navigate(isSafeInternalPath ? requestedPath : '/dashboard', {
      replace: true,
      state: isSafeInternalPath ? fromLocation.state : null,
    })
  }

  return (
    <AuthLayout
      artwork={
        <aside
          aria-label="AI-powered document processing"
          className="login-visual"
        >
          <div className="login-visual__copy">
            <p className="eyebrow">Intelligent workspace</p>
            <h2>Turn every document into a confident decision.</h2>
          </div>
          <img
            alt=""
            className="login-visual__image"
            src={loginDocumentArtwork}
          />
          <div className="login-visual__status">
            <span aria-hidden="true">✓</span>
            Secure document verification
          </div>
        </aside>
      }
      description="Use your verified account to continue."
      footer={
        <>
          New here?{' '}
          <Link state={location.state} to="/register">
            Create an account
          </Link>
        </>
      }
      title="Welcome back"
    >
      {message && (
        <Alert onDismiss={dismissMessage} tone="success">
          {message}
        </Alert>
      )}
      {error && <Alert onDismiss={clearError}>{error.message}</Alert>}
      {unverifiedEmail && (
        <div className="auth-recovery-section">
          <p className="supporting-copy">
            Send a fresh verification link, then return here to sign in.
          </p>
          <VerificationEmailResend initialEmail={unverifiedEmail} />
        </div>
      )}
      <LoginForm
        fieldErrors={getFieldErrors(error)}
        initialEmail={invitedEmail}
        isLoading={isLoading}
        onChange={() => {
          clearError()
          setUnverifiedEmail('')
        }}
        onSubmit={handleLogin}
      />
      <div className="form-link">
        <Link to="/forgot-password">Forgot your password?</Link>
      </div>
    </AuthLayout>
  )
}
