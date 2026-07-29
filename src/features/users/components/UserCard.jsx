export function UserCard({ user }) {
  return (
    <article className="card">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </article>
  )
}
