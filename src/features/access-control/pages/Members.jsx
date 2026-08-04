import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { MemberForm } from '../components/MemberForm.jsx'
import { OrganizationPermissionBoundary } from '../components/OrganizationPermissionBoundary.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'
import {
  addMember,
  getOrganizationInvites,
  getMembers,
  getRoles,
  inviteOrganizationMember,
  removeMember,
  replaceMemberRoles,
  revokeOrganizationInvite,
  updateMemberStatus,
} from '../services/accessControlApi.js'

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function MembersContent() {
  const { refreshAccess, selectedOrganization } = useAccessControl()
  const { user } = useAuth()
  const notifications = useNotifications()
  const organizationId = selectedOrganization.organization.id
  const [actionError, setActionError] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [inviteToRevoke, setInviteToRevoke] = useState(null)
  const [invites, setInvites] = useState([])
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [members, setMembers] = useState([])
  const [notice, setNotice] = useState('')
  const [roles, setRoles] = useState([])

  const loadData = useCallback(async () => {
    setActionError(null)
    setIsLoading(true)

    try {
      const [nextMembers, nextRoles, nextInvites] = await Promise.all([
        getMembers(organizationId),
        getRoles(organizationId),
        getOrganizationInvites(organizationId),
      ])

      setMembers(nextMembers)
      setRoles(nextRoles)
      setInvites(nextInvites)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    setEditingMember(null)
    setIsAddOpen(false)
    setIsInviteOpen(false)
    setInviteToRevoke(null)
    setMemberToRemove(null)
    setNotice('')
    void loadData()
  }, [loadData])

  async function completeMutation(message) {
    setNotice(message)
    notifications.success(message)
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
      notifications.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleInviteMember(values) {
    setActionError(null)
    setIsSaving(true)

    try {
      await inviteOrganizationMember(organizationId, values)
      setIsInviteOpen(false)
      await completeMutation(`Invitation sent to ${values.email}.`)
    } catch (error) {
      setActionError(error)
      notifications.error(error.message)
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
      notifications.error(error.message)
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
      notifications.error(error.message)
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
      notifications.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRevokeInvite() {
    if (!inviteToRevoke) return

    setActionError(null)
    setIsSaving(true)

    try {
      await revokeOrganizationInvite(organizationId, inviteToRevoke.id)
      const email = inviteToRevoke.email
      setInviteToRevoke(null)
      await completeMutation(`Invitation for ${email} was revoked.`)
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
        <div className="inline-actions">
          <Button
            onClick={() => {
              setActionError(null)
              setIsInviteOpen(true)
            }}
            variant="secondary"
          >
            Invite member
          </Button>
          <Button
            onClick={() => {
              setActionError(null)
              setIsAddOpen(true)
            }}
          >
            Add member
          </Button>
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert>{actionError.message}</Alert>}

      <section className="member-list" aria-label="Organization members">
        {members.length ? (
          members.map((member) => {
            const isCurrentUser = member.user.id === user.id

            return (
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
                    {isCurrentUser && (
                      <span className="verified-label">This is you</span>
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
                  disabled={isSaving || isCurrentUser}
                  onClick={() => {
                    setActionError(null)
                    setEditingMember(member)
                  }}
                  title={
                    isCurrentUser
                      ? 'You cannot change your own organization roles.'
                      : undefined
                  }
                  variant="secondary"
                >
                  Edit roles
                </Button>
                <Button
                  disabled={isSaving || isCurrentUser}
                  onClick={() => void handleStatusChange(member)}
                  title={
                    isCurrentUser
                      ? 'You cannot suspend or reactivate your own membership.'
                      : undefined
                  }
                  variant="secondary"
                >
                  {member.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                </Button>
                <Button
                  disabled={isSaving || isCurrentUser}
                  onClick={() => {
                    setActionError(null)
                    setMemberToRemove(member)
                  }}
                  title={
                    isCurrentUser
                      ? 'You cannot remove your own membership.'
                      : undefined
                  }
                  variant="danger"
                >
                  Remove
                </Button>
              </div>
            </article>
            )
          })
        ) : (
          <section className="empty-state">
            <div>
              <h2>No members found</h2>
              <p>Add a verified account to start assigning roles.</p>
            </div>
          </section>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Invitations</p>
            <h2>Member invites</h2>
          </div>
        </div>

        {invites.length ? (
          <div className="invite-list">
            {invites.map((invite) => (
              <article className="invite-card" key={invite.id}>
                <div>
                  <h3>{invite.email}</h3>
                  <p className="muted-copy">
                    Expires {formatDate(invite.expiresAt)}
                  </p>
                </div>
                <span
                  className={`status-badge ${
                    invite.status === 'PENDING'
                      ? 'status-badge--warning'
                      : invite.status === 'ACCEPTED'
                        ? 'status-badge--success'
                        : ''
                  }`}
                >
                  {invite.status}
                </span>
                <div className="chip-list">
                  {invite.roles.length ? (
                    invite.roles.map((role) => (
                      <span className="role-chip" key={role.id}>
                        {role.name}
                      </span>
                    ))
                  ) : (
                    <span className="muted-copy">No roles assigned</span>
                  )}
                </div>
                <div className="member-card__actions">
                  <Button
                    disabled={isSaving || invite.status !== 'PENDING'}
                    onClick={() => setInviteToRevoke(invite)}
                    variant="danger"
                  >
                    Revoke
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No invites found</h2>
              <p>Send an invitation to onboard someone by email.</p>
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
        isOpen={isInviteOpen}
        onClose={() => !isSaving && setIsInviteOpen(false)}
        title="Invite organization member"
      >
        {actionError && <Alert>{actionError.message}</Alert>}
        {isInviteOpen && (
          <MemberForm
            isSaving={isSaving}
            key="new-invite"
            mode="invite"
            onCancel={() => setIsInviteOpen(false)}
            onSubmit={handleInviteMember}
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

      <Modal
        isOpen={Boolean(inviteToRevoke)}
        onClose={() => !isSaving && setInviteToRevoke(null)}
        title="Revoke invitation?"
      >
        {actionError && <Alert>{actionError.message}</Alert>}
        <p>
          Revoking <strong>{inviteToRevoke?.email}</strong> prevents that invite
          link from being accepted.
        </p>
        <div className="form-actions">
          <Button
            disabled={isSaving}
            onClick={() => setInviteToRevoke(null)}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => void handleRevokeInvite()}
            variant="danger"
          >
            {isSaving ? 'Revoking...' : 'Revoke invite'}
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
