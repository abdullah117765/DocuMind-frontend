import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { UserTable } from '../components/UserTable.jsx'
import { useUsers } from '../hooks/useUsers.js'

export function Users() {
  const { error, isLoading, users } = useUsers()

  if (isLoading) return <Loader />

  return (
    <main className="page">
      <h1>Users</h1>
      {error ? <p className="error">{error.message}</p> : <UserTable users={users} />}
    </main>
  )
}
