import { UserCard } from '../components/UserCard.jsx'

export function UserDetails({ user }) {
  return (
    <main className="page">
      <h1>User details</h1>
      <UserCard user={user} />
    </main>
  )
}
