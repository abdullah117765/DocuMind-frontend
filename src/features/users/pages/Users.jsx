import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  getUsers,
  updateUser,
} from '../services/userApi.js'

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function OrganizationMembershipSummary({ memberships = [] }) {
  if (memberships.length === 0) {
    return <span className="muted-copy">No organization access</span>
  }

  return (
    <div className="membership-summary">
      {memberships.map((membership) => (
        <div className="membership-summary__item" key={membership.id}>
          <strong>{membership.organization.name}</strong>
          <span className="muted-copy">{membership.status}</span>
          {membership.roles.length ? (
            <div className="chip-list">
              <span className="role-chip">{membership.roles[0].name}</span>
            </div>
          ) : (
            <span className="muted-copy">No role assigned</span>
          )}
        </div>
      ))}
    </div>
  )
}

const DEFAULT_PAGE_SIZE = 10

export function Users() {
  const { user: currentUser } = useAuth()
  const notifications = useNotifications()
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    status: 'active',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState(null)
  const [users, setUsers] = useState([])

  const updateFilters = useCallback((updater) => {
    setPage(1)
    setFilters((current) => ({ ...current, ...updater }))
  }, [])

  const loadUsers = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      const userData = await getUsers({
        page,
        pageSize,
        search: filters.search.trim(),
        status: filters.status,
      })

      if (
        userData.pagination &&
        userData.pagination.total > 0 &&
        userData.pagination.page > userData.pagination.pageCount
      ) {
        setPage(userData.pagination.pageCount)
        return
      }

      setUsers(userData.users ?? [])
      setPagination(userData.pagination ?? null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [filters.search, filters.status, page, pageSize])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadUsers()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadUsers])

  async function handleUpdateUser(targetUser, values) {
    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateUser(targetUser.id, values)
      notifications.success(`${updated.email} was updated.`)
      await loadUsers()
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page page--wide page--platform-users">
      <header className="page-header">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1>Users</h1>
          <p>
            Search accounts and control active state without exposing Super
            Admin role assignment.
          </p>
        </div>
        <RefreshIconButton
          disabled={isLoading}
          label="Refresh users"
          onClick={() => void loadUsers()}
        />
      </header>

      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}

      <section className="card filter-bar">
        <Input
          label="Search users"
          onChange={(event) =>
            updateFilters({ search: event.target.value })
          }
          placeholder="email or organization"
          value={filters.search}
        />
        <label className="field">
          <span className="field__label">Status</span>
          <select
            onChange={(event) =>
              updateFilters({ status: event.target.value })
            }
            value={filters.status}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </label>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <span className="card__label">Directory</span>
            <h2>{pagination?.total ?? users.length} users</h2>
          </div>
        </div>

        {isLoading ? (
          <Loader label="Loading users..." />
        ) : users.length ? (
          <div className="data-table data-table--users" role="table">
            <div className="data-table__row data-table__row--head" role="row">
              <span role="columnheader">User</span>
              <span role="columnheader">State</span>
              <span role="columnheader">Platform role</span>
              <span role="columnheader">Organizations</span>
              <span role="columnheader">Actions</span>
            </div>
            {users.map((managedUser) => {
              const isSelf = managedUser.id === currentUser.id

              return (
                <article className="data-table__row" key={managedUser.id} role="row">
                  <span role="cell">
                    <strong>{managedUser.name ?? managedUser.email}</strong>
                    {managedUser.name && <small>{managedUser.email}</small>}
                    <small>Created {formatDate(managedUser.createdAt)}</small>
                  </span>
                  <span role="cell">
                    <span
                      className={`status-badge ${
                        managedUser.isActive
                          ? 'status-badge--success'
                          : 'status-badge--warning'
                      }`}
                    >
                      {managedUser.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </span>
                  <span className="chip-list" role="cell">
                    {managedUser.platformRoles.length ? (
                      <span className="role-chip">
                        {managedUser.platformRoles[0].name}
                      </span>
                    ) : (
                      <span className="muted-copy">No platform role</span>
                    )}
                  </span>
                  <span role="cell">
                    <OrganizationMembershipSummary
                      memberships={managedUser.memberships}
                    />
                  </span>
                  <span className="inline-actions" role="cell">
                    <Button
                      disabled={isSaving || isSelf}
                      onClick={() =>
                        void handleUpdateUser(managedUser, {
                          isActive: !managedUser.isActive,
                        })
                      }
                      title={isSelf ? 'You cannot deactivate yourself.' : undefined}
                      variant={managedUser.isActive ? 'danger' : 'secondary'}
                    >
                      {managedUser.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </span>
                </article>
              )
            })}
          </div>
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No users found</h2>
              <p>Adjust filters or create a user.</p>
            </div>
          </section>
        )}

        <ListPagination
          label="User pagination"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPage(1)
          }}
          pageSize={pageSize}
          pagination={pagination}
        />
      </section>
    </main>
  )
}
