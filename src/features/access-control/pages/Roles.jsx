import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { getFriendlyErrorMessage } from '../../../shared/utils/errorMessages.js'
import { isSuperAdminAccess } from '../../../shared/utils/accessDisplay.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { RoleForm } from '../components/RoleForm.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'
import {
  createRole,
  deleteRole as deleteOrganizationRole,
  getPermissions,
  getRoles,
  replaceRolePermissions,
  updateRole,
} from '../services/accessControlApi.js'

function groupPermissions(permissions) {
  return permissions.reduce((groups, permission) => {
    const category = permission.category || 'Other'

    if (!groups[category]) groups[category] = []
    groups[category].push(permission)

    return groups
  }, {})
}

const DEFAULT_PAGE_SIZE = 10

function RolesContent() {
  const { refreshAccess, selectedOrganization } = useAccessControl()
  const notifications = useNotifications()
  const organizationId = selectedOrganization.organization.id
  const [actionError, setActionError] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
  })
  const [notice, setNotice] = useState('')
  const [allRoles, setAllRoles] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [roleToDelete, setRoleToDelete] = useState(null)
  const [roles, setRoles] = useState([])

  const updateFilters = useCallback((updater) => {
    setPage(1)
    setFilters((current) => ({ ...current, ...updater }))
  }, [])

  const loadData = useCallback(async () => {
    setActionError(null)
    setIsLoading(true)

    try {
      const [nextPermissions, rolePage, allRoleData] = await Promise.all([
        getPermissions(organizationId),
        getRoles(organizationId, {
          page,
          pageSize,
          search: filters.search.trim(),
          type: filters.type,
        }),
        getRoles(organizationId, { page: 1, pageSize: 100 }),
      ])

      if (
        rolePage.pagination &&
        rolePage.pagination.total > 0 &&
        rolePage.pagination.page > rolePage.pagination.pageCount
      ) {
        setPage(rolePage.pagination.pageCount)
        return
      }

      setPermissions(nextPermissions)
      setRoles(rolePage.roles ?? [])
      setAllRoles(allRoleData.roles ?? [])
      setPagination(rolePage.pagination ?? null)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [filters.search, filters.type, organizationId, page, pageSize])

  useEffect(() => {
    setIsFormOpen(false)
    setRoleToDelete(null)
    setNotice('')
    void loadData()
  }, [loadData])

  const permissionGroups = useMemo(
    () => groupPermissions(permissions),
    [permissions],
  )
  const selfAssignedRoleIds = useMemo(
    () => new Set((selectedOrganization.roles ?? []).map((role) => role.id)),
    [selectedOrganization.roles],
  )

  function openCreateRole() {
    setActionError(null)
    setEditingRole(null)
    setIsFormOpen(true)
  }

  function openEditRole(role) {
    setActionError(null)
    setEditingRole(role)
    setIsFormOpen(true)
  }

  async function handleSaveRole(values) {
    setActionError(null)
    setIsSaving(true)

    try {
      if (editingRole) {
        await updateRole(organizationId, editingRole.id, {
          description: values.description,
          name: values.name,
        })
        await replaceRolePermissions(
          organizationId,
          editingRole.id,
          values.permissionCodes,
        )
        setNotice(`${values.name} was updated.`)
        notifications.success(`${values.name} was updated.`)
      } else {
        await createRole(organizationId, values)
        setNotice(`${values.name} was created.`)
        notifications.success(`${values.name} was created.`)
      }

      setIsFormOpen(false)
      setEditingRole(null)
      await loadData()
      await refreshAccess().catch(() => {})
    } catch (error) {
      setActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteRole() {
    if (!roleToDelete) return

    setActionError(null)
    setIsSaving(true)

    try {
      await deleteOrganizationRole(organizationId, roleToDelete.id)
      setNotice(`${roleToDelete.name} was deleted.`)
      notifications.success(`${roleToDelete.name} was deleted.`)
      setRoleToDelete(null)
      await loadData()
      await refreshAccess().catch(() => {})
    } catch (error) {
      setActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <Loader label="Loading access roles…" />
      </main>
    )
  }

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <h1>Roles</h1>
          <p>
            Manage custom roles for {selectedOrganization.organization.name}.
            Built-in roles stay read-only so core access remains protected.
          </p>
        </div>
        <Button onClick={openCreateRole}>Create custom role</Button>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}

      <section className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="table-toolbar">
          <div className="table-toolbar__search">
            <input
              aria-label="Search roles"
              className="table-toolbar__input"
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder="Search roles or permissions..."
              type="search"
              value={filters.search}
            />
          </div>
          <div className="table-toolbar__filters">
            <select
              aria-label="Filter role type"
              className="table-toolbar__select"
              onChange={(event) => updateFilters({ type: event.target.value })}
              value={filters.type}
            >
              <option value="all">All roles</option>
              <option value="system">System roles</option>
              <option value="custom">Custom roles</option>
            </select>
            <span className="table-toolbar__counter">
              {pagination?.total ?? roles.length} available roles
            </span>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="role-grid">
          {roles.map((role) => {
            const assignedToCurrentUser = selfAssignedRoleIds.has(role.id)

            return (
            <article className="role-card" key={role.id}>
              <header className="role-card__header">
                <div>
                  <div className="role-card__title">
                    <h3>{role.name}</h3>
                    <span
                      className={`type-badge ${
                        role.isSystem
                          ? 'type-badge--system'
                          : 'type-badge--custom'
                      }`}
                    >
                      {role.isSystem ? 'System' : 'Custom'}
                    </span>
                    {assignedToCurrentUser && (
                      <span className="type-badge type-badge--self">
                        Assigned to you
                      </span>
                    )}
                  </div>
                  <p>
                    {role.description ?? 'No description has been provided.'}
                  </p>
                </div>
                <span className="assignment-count">
                  {role.assignedMembersCount} member
                  {role.assignedMembersCount === 1 ? '' : 's'}
                </span>
              </header>
              <div className="permission-chip-list">
                {role.permissions.length ? (
                  role.permissions.map((permission) => (
                    <span className="permission-chip" key={permission.code}>
                      {permission.name}
                    </span>
                  ))
                ) : (
                  <span className="muted-copy">No access selected</span>
                )}
              </div>
              <footer className="role-card__footer">
                <span className="muted-copy">
                  {role.permissions.length} access item
                  {role.permissions.length === 1 ? '' : 's'}
                </span>
                {role.isSystem ? (
                  <span className="read-only-note">Built-in role</span>
                ) : assignedToCurrentUser ? (
                  <span className="read-only-note">
                    Locked because it affects your own access
                  </span>
                ) : (
                  <div className="inline-actions">
                    <Button onClick={() => openEditRole(role)} variant="secondary">
                      Edit
                    </Button>
                    <Button
                      onClick={() => setRoleToDelete(role)}
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </footer>
            </article>
            )
          })}
        </div>

        <ListPagination
          label="Role pagination"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPage(1)
          }}
          pageSize={pageSize}
          pagination={pagination}
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Available access</p>
            <h2>Access reference</h2>
            <p>
              Use this reference to understand what each role can allow.
            </p>
          </div>
        </div>
        <div className="permission-catalog">
          {Object.entries(permissionGroups)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([category, categoryPermissions]) => (
              <article className="permission-category-card" key={category}>
                <header>
                  <h3>{category}</h3>
                  <span>{categoryPermissions.length}</span>
                </header>
                <div>
                  {categoryPermissions.map((permission) => {
                    const roleCount = allRoles.filter((role) =>
                      role.permissions.some(({ code }) => code === permission.code),
                    ).length

                    return (
                      <div className="permission-catalog__item" key={permission.code}>
                        <div>
                          <strong>{permission.name}</strong>
                          <p>{permission.description}</p>
                        </div>
                        <span>
                          {roleCount} role{roleCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
        </div>
      </section>

      <Modal
        isOpen={isFormOpen}
        onClose={() => !isSaving && setIsFormOpen(false)}
        title={editingRole ? `Edit ${editingRole.name}` : 'Create custom role'}
      >
        {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}
        {isFormOpen && (
          <RoleForm
            existingRoleNames={allRoles.map((role) => role.name)}
            isSaving={isSaving}
            key={editingRole?.id ?? 'new-role'}
            onCancel={() => setIsFormOpen(false)}
            onSubmit={handleSaveRole}
            permissions={permissions}
            role={editingRole}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(roleToDelete)}
        onClose={() => !isSaving && setRoleToDelete(null)}
        title="Delete custom role?"
      >
        {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}
        <p>
          Deleting <strong>{roleToDelete?.name}</strong> removes the role
          and removes it from {roleToDelete?.assignedMembersCount ?? 0} assigned
          member
          {roleToDelete?.assignedMembersCount === 1 ? '' : 's'}.
        </p>
        <div className="form-actions">
          <Button
            disabled={isSaving}
            onClick={() => setRoleToDelete(null)}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => void handleDeleteRole()}
            variant="danger"
          >
            {isSaving ? 'Deleting…' : 'Delete role'}
          </Button>
        </div>
      </Modal>
    </main>
  )
}

export function Roles() {
  const { access, selectedOrganization, status } = useAccessControl()
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminAccess(user, access)

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Checking role access..." />
      </main>
    )
  }

  if (!isSuperAdmin) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Super Admin only</p>
            <h1>Custom roles are restricted</h1>
            <p>
              Organization admins can assign existing roles to members, but only
              the Super Admin can create, edit, or delete custom roles.
            </p>
          </div>
        </section>
      </main>
    )
  }

  if (!selectedOrganization) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Organization required</p>
            <h1>Select an organization</h1>
            <p>Create or select an organization before managing its roles.</p>
          </div>
        </section>
      </main>
    )
  }

  return <RolesContent />
}
