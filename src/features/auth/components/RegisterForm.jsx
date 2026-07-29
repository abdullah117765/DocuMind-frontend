import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'

export function RegisterForm({ onSubmit, isLoading = false }) {
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
  })

  function handleChange(event) {
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit(values)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Input label="Name" name="name" onChange={handleChange} required value={values.name} />
      <Input label="Email" name="email" onChange={handleChange} required type="email" value={values.email} />
      <Input label="Password" name="password" onChange={handleChange} required type="password" value={values.password} />
      <Button disabled={isLoading} type="submit">
        {isLoading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
