import { Link } from '../../../routes/RouterElements.jsx'
import { useLocation, useNavigate } from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { LoginForm } from '../components/LoginForm.jsx'
import { useLogin } from '../hooks/useLogin.js'

export function Login() {
  const { error, isLoading, login } = useLogin()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleLogin(credentials) {
    await login(credentials)
    const requestedPath = location.state?.from?.pathname
    const isSafeInternalPath =
      typeof requestedPath === 'string' &&
      requestedPath.startsWith('/') &&
      !requestedPath.startsWith('//') &&
      !requestedPath.includes('\\')

    navigate(isSafeInternalPath ? requestedPath : '/dashboard', {
      replace: true,
    })
  }

  return (
    <AuthLayout
      description="Use your verified account to continue."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
      title="Welcome back"
    >
      {location.state?.message && (
        <Alert tone="success">{location.state.message}</Alert>
      )}
      {error && <Alert>{error.message}</Alert>}
      <LoginForm
        fieldErrors={getFieldErrors(error)}
        isLoading={isLoading}
        onSubmit={handleLogin}
      />
      <div className="form-link">
        <Link to="/forgot-password">Forgot your password?</Link>
      </div>
    </AuthLayout>
  )
}
