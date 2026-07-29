import { RegisterForm } from '../components/RegisterForm.jsx'
import { register } from '../services/authApi.js'

export function Register() {
  return (
    <main className="page page--narrow">
      <h1>Create account</h1>
      <RegisterForm onSubmit={register} />
    </main>
  )
}
