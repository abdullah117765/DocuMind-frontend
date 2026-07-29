import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'

export function UserForm({ onSubmit }) {
  function handleSubmit(event) {
    event.preventDefault()
    onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Input label="Name" name="name" required />
      <Input label="Email" name="email" required type="email" />
      <Button type="submit">Save user</Button>
    </form>
  )
}
