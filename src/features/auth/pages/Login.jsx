import { LoginForm } from '../components/LoginForm.jsx'
import { useLogin } from '../hooks/useLogin.js'

export function Login() {
  const { error, isLoading, login } = useLogin()

  return (
    <main className="page page--narrow">
      <h1>Sign in</h1>
      {error && <p className="error">{error.message}</p>}
      <LoginForm isLoading={isLoading} onSubmit={login} />
    </main>
  )
}
