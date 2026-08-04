import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  EMAIL_PATTERN,
  PASSWORD_PATTERN,
  normalizeEmail,
} from '../../auth/components/validation.js'
import {
  createUser,
  getPlatformRoles,
  getUsers,
  replacePlatformRoles,
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
              {membership.roles.map((role) => (
                <span className="role-chip" key={role.id}>
                  {role.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="muted-copy">No roles assigned</span>
          )}
        </div>
      ))}
    </div>
  )
}

function validateCreateForm(form) {
  const errors = {}
  const email = normalizeEmail(form.email)

  if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!PASSWORD_PATTERN.test(form.password)) {
    errors.password =
      'Use 8-64 chars with uppercase, lowercase, number, and @ # $ % ^ & * !.'
  }

  return errors
}

function CreateUserModal({ isOpen, isSaving, onClose, onSubmit }) {
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    email: '',
    isVerified: true,
    password: '',
  })

  useEffect(() => {
    if (isOpen) {
      setErrors({})
      setForm({ email: '', isVerified: true, password: '' })
    }
  }, [isOpen])

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCreateForm(form)

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    void onSubmit({
      email: normalizeEmail(form.email),
      isVerified: form.isVerified,
      password: form.password,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create platform user">
      <form className="form" onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          disabled={isSaving}
          error={errors.email}
          label="Email"
          onChange={(event) =>
            setForm((current) => ({ ...current, email: event.target.value }))
          }
          placeholder="member@example.com"
          required
          type="email"
          value={form.email}
        />
        <Input
          autoComplete="new-password"
          disabled={isSaving}
          error={errors.password}
          label="Temporary password"
          onChange={(event) =>
            setForm((current) => ({ ...current, password: event.target.value }))
          }
          required
          type="password"
          value={form.password}
        />
        <label className="check-row">
          <input
            checked={form.isVerified}
            disabled={isSaving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isVerified: event.target.checked,
              }))
            }
            type="checkbox"
          />
          <span>Create as verified</span>
        </label>
        <div className="form-actions">
          <Button disabled={isSaving} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button disabled={isSaving} type="submit">
            {isSaving ? 'Creating...' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PlatformRoleModal({
  currentUserId,
  isOpen,
  isSaving,
  onClose,
  onSubmit,
  roles,
  user,
}) {
  const [roleIds, setRoleIds] = useState([])
  const selectedRoles = useMemo(() => new Set(roleIds), [roleIds])
  const isSelf = user?.id === currentUserId

  useEffect(() => {
    if (user) {
      setRoleIds(user.platformRoles.map((role) => role.id))
    }
  }, [user])

  function toggleRole(roleId) {
    const nextRoles = new Set(selectedRoles)

    if (nextRoles.has(roleId)) {
      nextRoles.delete(roleId)
    } else {
      nextRoles.add(roleId)
    }

    setRoleIds([...nextRoles])
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Platform roles">
      {user && (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit(user.id, roleIds)
          }}
        >
          <div className="member-identity">
            <span className="field__label">User</span>
            <strong>{user.email}</strong>
          </div>
          {isSelf && (
            <Alert tone="info">
              You cannot change your own platform roles. This protects the last
              Super Admin from accidental lockout.
            </Alert>
          )}
          <fieldset className="role-options">
            <legend className="field__label">Assignable platform roles</legend>
            <div className="role-options__list">
              {roles.map((role) => (
                <label className="role-option" key={role.id}>
                  <input
                    checked={selectedRoles.has(role.id)}
                    disabled={isSaving || isSelf}
                    onChange={() => toggleRole(role.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{role.name}</strong>
                    <small>
                      {role.permissionCodes.length} permission
                      {role.permissionCodes.length === 1 ? '' : 's'}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-actions">
            <Button disabled={isSaving} onClick={onClose} variant="secondary">
              Close
            </Button>
            <Button disabled={isSaving || isSelf} type="submit">
              {isSaving ? 'Saving...' : 'Save roles'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export function Users() {
  const { user: currentUser } = useAuth()
  const notifications = useNotifications()
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    status: 'active',
    verified: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pagination, setPagination] = useState(null)
  const [platformRoles, setPlatformRoles] = useState([])
  const [roleUser, setRoleUser] = useState(null)
  const [users, setUsers] = useState([])

  const loadUsers = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      const [userData, roleData] = await Promise.all([
        getUsers({
          page: 1,
          pageSize: 50,
          search: filters.search.trim(),
          status: filters.status,
          verified: filters.verified,
        }),
        getPlatformRoles(),
      ])

      setUsers(userData.users ?? [])
      setPagination(userData.pagination ?? null)
      setPlatformRoles(roleData)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [filters.search, filters.status, filters.verified])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadUsers()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadUsers])

  async function handleCreateUser(values) {
    setIsSaving(true)
    setError(null)

    try {
      const created = await createUser(values)
      notifications.success(`${created.email} was created.`)
      setCreateOpen(false)
      await loadUsers()
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

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

  async function handleReplaceRoles(userId, roleIds) {
    setIsSaving(true)
    setError(null)

    try {
      const updated = await replacePlatformRoles(userId, roleIds)
      notifications.success(`Platform roles for ${updated.email} were updated.`)
      setRoleUser(null)
      await loadUsers()
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1>Users</h1>
          <p>
            Search accounts, manage verification and active state, and assign
            platform roles without allowing self-demotion.
          </p>
        </div>
        <div className="inline-actions">
          <Button onClick={() => void loadUsers()} variant="secondary">
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Create user</Button>
        </div>
      </header>

      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}

      <section className="card filter-bar">
        <Input
          label="Search users"
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder="email or organization"
          value={filters.search}
        />
        <label className="field">
          <span className="field__label">Status</span>
          <select
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
            value={filters.status}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Verification</span>
          <select
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                verified: event.target.value,
              }))
            }
            value={filters.verified}
          >
            <option value="">Any</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
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
              <span role="columnheader">Platform roles</span>
              <span role="columnheader">Organizations</span>
              <span role="columnheader">Actions</span>
            </div>
            {users.map((managedUser) => {
              const isSelf = managedUser.id === currentUser.id

              return (
                <article className="data-table__row" key={managedUser.id} role="row">
                  <span role="cell">
                    <strong>{managedUser.email}</strong>
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
                    <span
                      className={`status-badge ${
                        managedUser.isVerified
                          ? 'status-badge--success'
                          : 'status-badge--warning'
                      }`}
                    >
                      {managedUser.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
                    </span>
                  </span>
                  <span className="chip-list" role="cell">
                    {managedUser.platformRoles.length ? (
                      managedUser.platformRoles.map((role) => (
                        <span className="role-chip" key={role.id}>
                          {role.name}
                        </span>
                      ))
                    ) : (
                      <span className="muted-copy">No platform roles</span>
                    )}
                  </span>
                  <span role="cell">
                    <OrganizationMembershipSummary
                      memberships={managedUser.memberships}
                    />
                  </span>
                  <span className="inline-actions" role="cell">
                    <Button
                      disabled={isSaving}
                      onClick={() => setRoleUser(managedUser)}
                      variant="secondary"
                    >
                      Roles
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() =>
                        void handleUpdateUser(managedUser, {
                          isVerified: !managedUser.isVerified,
                        })
                      }
                      variant="secondary"
                    >
                      {managedUser.isVerified ? 'Unverify' : 'Verify'}
                    </Button>
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
      </section>

      <CreateUserModal
        isOpen={createOpen}
        isSaving={isSaving}
        onClose={() => !isSaving && setCreateOpen(false)}
        onSubmit={handleCreateUser}
      />

      <PlatformRoleModal
        currentUserId={currentUser.id}
        isOpen={Boolean(roleUser)}
        isSaving={isSaving}
        onClose={() => !isSaving && setRoleUser(null)}
        onSubmit={handleReplaceRoles}
        roles={platformRoles}
        user={roleUser}
      />
    </main>
  )
}
