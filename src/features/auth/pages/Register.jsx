import { useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { useLocation } from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { RegisterForm } from '../components/RegisterForm.jsx'
import { VerificationEmailResend } from '../components/VerificationEmailResend.jsx'
import { normalizeEmail } from '../components/validation.js'
import { registerAccount } from '../services/authApi.js'

export function Register() {
  const location = useLocation()
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const invitedEmail =
    typeof location.state?.email === 'string' ? location.state.email : ''
  const loginState = {
    ...(location.state ?? {}),
    email: registeredEmail || invitedEmail,
  }

  async function handleRegister(values) {
    setError(null)
    setIsLoading(true)

    try {
      const response = await registerAccount(values)
      setRegisteredEmail(normalizeEmail(values.email))
      setSuccessMessage(response.message)
    } catch (requestError) {
      if (
        ['EMAIL_NOT_VERIFIED', 'VERIFICATION_DELIVERY_FAILED'].includes(
          requestError?.details?.reason,
        )
      ) {
        setRegisteredEmail(normalizeEmail(values.email))
      }
      setError(requestError)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }

  if (successMessage) {
    return (
      <AuthLayout
        description="We sent a secure verification link to your inbox."
        footer={
          <Link state={loginState} to="/login">
            Return to sign in
          </Link>
        }
        title="Check your email"
      >
        <Alert tone="success">{successMessage}</Alert>
        <p className="supporting-copy">
          Open the link in the email to activate your account. Check your spam
          folder if it does not arrive shortly.
        </p>
        {location.state?.from?.pathname === '/accept-invite' && (
          <p className="supporting-copy">
            After verification, sign in with this email and we will return you
            to the invitation.
          </p>
        )}
        <VerificationEmailResend initialEmail={registeredEmail} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      description="Create your account, then verify it from your inbox."
      footer={
        <>
          Already registered? <Link to="/login">Sign in</Link>
        </>
      }
      title="Create your account"
    >
      {error && <Alert>{error.message}</Alert>}
      {registeredEmail && (
        <div className="auth-recovery-section">
          <p className="supporting-copy">
            Your account can be recovered safely. Send a fresh verification
            link to continue.
          </p>
          <VerificationEmailResend initialEmail={registeredEmail} />
        </div>
      )}
      <RegisterForm
        fieldErrors={getFieldErrors(error)}
        initialEmail={invitedEmail}
        isLoading={isLoading}
        onSubmit={handleRegister}
      />
    </AuthLayout>
  )
}
