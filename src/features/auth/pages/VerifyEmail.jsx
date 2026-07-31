import { useEffect, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { useSearchParams } from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { verifyEmail } from '../services/authApi.js'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [result, setResult] = useState({
    status: token ? 'loading' : 'error',
    message: token ? '' : 'The verification link is missing its token.',
  })

  useEffect(() => {
    if (!token) return

    let active = true

    verifyEmail(token)
      .then((response) => {
        if (active) {
          setResult({ status: 'success', message: response.message })
        }
      })
      .catch((error) => {
        if (active) {
          setResult({ status: 'error', message: error.message })
        }
      })

    return () => {
      active = false
    }
  }, [token])

  return (
    <AuthLayout
      description="We are securely confirming your email address."
      footer={<Link to="/login">Continue to sign in</Link>}
      title="Email verification"
    >
      {result.status === 'loading' && (
        <Loader label="Verifying your email…" />
      )}
      {result.status === 'success' && (
        <Alert tone="success">{result.message}</Alert>
      )}
      {result.status === 'error' && <Alert>{result.message}</Alert>}
    </AuthLayout>
  )
}
