import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { OrganizationPermissionBoundary } from '../components/OrganizationPermissionBoundary.jsx'
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

function RolesContent() {
  const { refreshAccess, selectedOrganization } = useAccessControl()
  const notifications = useNotifications()
  const organizationId = selectedOrganization.organization.id
  const [actionError, setActionError] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [permissions, setPermissions] = useState([])
  const [roleToDelete, setRoleToDelete] = useState(null)
  const [roles, setRoles] = useState([])

  const loadData = useCallback(async () => {
    setActionError(null)
    setIsLoading(true)

    try {
      const [nextPermissions, nextRoles] = await Promise.all([
        getPermissions(organizationId),
        getRoles(organizationId),
      ])

      setPermissions(nextPermissions)
      setRoles(nextRoles)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

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
      notifications.error(error.message)
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
      notifications.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <Loader label="Loading roles and permissions…" />
      </main>
    )
  }

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Access control</p>
          <h1>Roles and permissions</h1>
          <p>
            Manage custom roles for {selectedOrganization.organization.name}.
            System roles stay read-only and update through backend policy.
          </p>
        </div>
        <Button onClick={openCreateRole}>Create custom role</Button>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert>{actionError.message}</Alert>}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Role directory</p>
            <h2>{roles.length} available roles</h2>
          </div>
        </div>
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
                  <span className="muted-copy">No permissions assigned</span>
                )}
              </div>
              <footer className="role-card__footer">
                <span className="muted-copy">
                  {role.permissions.length} permission
                  {role.permissions.length === 1 ? '' : 's'}
                </span>
                {role.isSystem ? (
                  <span className="read-only-note">Managed by the system</span>
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
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dynamic catalog</p>
            <h2>Permission reference</h2>
            <p>
              This catalog is returned by the backend; new active permissions
              appear here without frontend role-name changes.
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
                    const roleCount = roles.filter((role) =>
                      role.permissions.some(({ code }) => code === permission.code),
                    ).length

                    return (
                      <div className="permission-catalog__item" key={permission.code}>
                        <div>
                          <strong>{permission.name}</strong>
                          <p>{permission.description}</p>
                          <code>{permission.code}</code>
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
        {actionError && <Alert>{actionError.message}</Alert>}
        {isFormOpen && (
          <RoleForm
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
        {actionError && <Alert>{actionError.message}</Alert>}
        <p>
          Deleting <strong>{roleToDelete?.name}</strong> deactivates the role
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
  return (
    <OrganizationPermissionBoundary permission="roles.manage">
      <RolesContent />
    </OrganizationPermissionBoundary>
  )
}
