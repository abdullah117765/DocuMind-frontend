import { useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { Alert } from '../../../shared/components/Alert.jsx'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { RegisterForm } from '../components/RegisterForm.jsx'
import { registerAccount } from '../services/authApi.js'

export function Register() {
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  async function handleRegister(values) {
    setError(null)
    setIsLoading(true)

    try {
      const response = await registerAccount(values)
      setSuccessMessage(response.message)
    } catch (requestError) {
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
        footer={<Link to="/login">Return to sign in</Link>}
        title="Check your email"
      >
        <Alert tone="success">{successMessage}</Alert>
        <p className="supporting-copy">
          Open the link in the email to activate your account. Check your spam
          folder if it does not arrive shortly.
        </p>
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
      <RegisterForm
        fieldErrors={getFieldErrors(error)}
        isLoading={isLoading}
        onSubmit={handleRegister}
      />
    </AuthLayout>
  )
}
