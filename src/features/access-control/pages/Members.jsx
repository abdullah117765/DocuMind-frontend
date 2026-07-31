import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { MemberForm } from '../components/MemberForm.jsx'
import { OrganizationPermissionBoundary } from '../components/OrganizationPermissionBoundary.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'
import {
  addMember,
  getMembers,
  getRoles,
  removeMember,
  replaceMemberRoles,
  updateMemberStatus,
} from '../services/accessControlApi.js'

function MembersContent() {
  const { refreshAccess, selectedOrganization } = useAccessControl()
  const organizationId = selectedOrganization.organization.id
  const [actionError, setActionError] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [members, setMembers] = useState([])
  const [notice, setNotice] = useState('')
  const [roles, setRoles] = useState([])

  const loadData = useCallback(async () => {
    setActionError(null)
    setIsLoading(true)

    try {
      const [nextMembers, nextRoles] = await Promise.all([
        getMembers(organizationId),
        getRoles(organizationId),
      ])

      setMembers(nextMembers)
      setRoles(nextRoles)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    setEditingMember(null)
    setIsAddOpen(false)
    setMemberToRemove(null)
    setNotice('')
    void loadData()
  }, [loadData])

  async function completeMutation(message) {
    setNotice(message)
    await loadData()
    await refreshAccess().catch(() => {})
  }

  async function handleAddMember(values) {
    setActionError(null)
    setIsSaving(true)

    try {
      await addMember(organizationId, values)
      setIsAddOpen(false)
      await completeMutation(`${values.email} was added to the organization.`)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateRoles({ roleIds }) {
    if (!editingMember) return

    setActionError(null)
    setIsSaving(true)

    try {
      await replaceMemberRoles(organizationId, editingMember.id, roleIds)
      const email = editingMember.user.email
      setEditingMember(null)
      await completeMutation(`Roles for ${email} were updated.`)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(member) {
    const nextStatus = member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'

    setActionError(null)
    setIsSaving(true)

    try {
      await updateMemberStatus(organizationId, member.id, nextStatus)
      await completeMutation(
        `${member.user.email} is now ${nextStatus.toLowerCase()}.`,
      )
    } catch (error) {
      setActionError(error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return

    setActionError(null)
    setIsSaving(true)

    try {
      await removeMember(organizationId, memberToRemove.id)
      const email = memberToRemove.user.email
      setMemberToRemove(null)
      await completeMutation(`${email} was removed from the organization.`)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <Loader label="Loading organization members…" />
      </main>
    )
  }

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">User management</p>
          <h1>Organization members</h1>
          <p>
            Add verified users, assign one or more roles, and control workspace
            access for {selectedOrganization.organization.name}.
          </p>
        </div>
        <Button
          onClick={() => {
            setActionError(null)
            setIsAddOpen(true)
          }}
        >
          Add member
        </Button>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert>{actionError.message}</Alert>}

      <section className="member-list" aria-label="Organization members">
        {members.length ? (
          members.map((member) => (
            <article className="member-card" key={member.id}>
              <div className="member-card__identity">
                <span aria-hidden="true" className="member-avatar">
                  {member.user.email.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h2>{member.user.email}</h2>
                  <div className="member-card__meta">
                    <span
                      className={`status-badge ${
                        member.status === 'ACTIVE'
                          ? 'status-badge--success'
                          : 'status-badge--warning'
                      }`}
                    >
                      {member.status}
                    </span>
                    {member.user.isVerified && (
                      <span className="verified-label">Verified account</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="member-card__roles">
                <span className="card__label">Assigned roles</span>
                {member.roles.length ? (
                  <div className="chip-list">
                    {member.roles.map((role) => (
                      <span className="role-chip" key={role.id}>
                        {role.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="muted-copy">No roles assigned</span>
                )}
              </div>

              <div className="member-card__actions">
                <Button
                  disabled={isSaving}
                  onClick={() => {
                    setActionError(null)
                    setEditingMember(member)
                  }}
                  variant="secondary"
                >
                  Edit roles
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={() => void handleStatusChange(member)}
                  variant="secondary"
                >
                  {member.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={() => {
                    setActionError(null)
                    setMemberToRemove(member)
                  }}
                  variant="danger"
                >
                  Remove
                </Button>
              </div>
            </article>
          ))
        ) : (
          <section className="empty-state">
            <div>
              <h2>No members found</h2>
              <p>Add a verified account to start assigning roles.</p>
            </div>
          </section>
        )}
      </section>

      <Modal
        isOpen={isAddOpen}
        onClose={() => !isSaving && setIsAddOpen(false)}
        title="Add organization member"
      >
        {actionError && <Alert>{actionError.message}</Alert>}
        {isAddOpen && (
          <MemberForm
            isSaving={isSaving}
            key="new-member"
            onCancel={() => setIsAddOpen(false)}
            onSubmit={handleAddMember}
            roles={roles}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editingMember)}
        onClose={() => !isSaving && setEditingMember(null)}
        title="Edit member roles"
      >
        {actionError && <Alert>{actionError.message}</Alert>}
        {editingMember && (
          <MemberForm
            isSaving={isSaving}
            key={editingMember.id}
            member={editingMember}
            onCancel={() => setEditingMember(null)}
            onSubmit={handleUpdateRoles}
            roles={roles}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(memberToRemove)}
        onClose={() => !isSaving && setMemberToRemove(null)}
        title="Remove organization member?"
      >
        {actionError && <Alert>{actionError.message}</Alert>}
        <p>
          Removing <strong>{memberToRemove?.user.email}</strong> revokes every
          assigned organization role. They can be added again later.
        </p>
        <div className="form-actions">
          <Button
            disabled={isSaving}
            onClick={() => setMemberToRemove(null)}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => void handleRemoveMember()}
            variant="danger"
          >
            {isSaving ? 'Removing…' : 'Remove member'}
          </Button>
        </div>
      </Modal>
    </main>
  )
}

export function Members() {
  return (
    <OrganizationPermissionBoundary permission="users.manage">
      <MembersContent />
    </OrganizationPermissionBoundary>
  )
}
