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
  getOrganizationInvites,
  getMembers,
  getRoles,
  inviteOrganizationMember,
  removeMember,
  replaceMemberRoles,
  resendOrganizationInvite,
  revokeOrganizationInvite,
  updateMemberStatus,
} from '../services/accessControlApi.js'

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getMemberRole(member) {
  return member.roles?.[0] ?? null
}

function getRoleDisplayName(role) {
  return role?.name ?? 'this role'
}

function MembersContent() {
  const { refreshAccess, selectedOrganization } = useAccessControl()
  const { user } = useAuth()
  const notifications = useNotifications()
  const organizationId = selectedOrganization.organization.id
  const [actionError, setActionError] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
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
      const [membersResult, rolesResult, invitesResult] = await Promise.allSettled([
        getMembers(organizationId),
        getRoles(organizationId),
        getOrganizationInvites(organizationId),
      ])

      if (membersResult.status === 'rejected') {
        throw membersResult.reason
      }

      setMembers(membersResult.value)

      const softErrors = []

      if (rolesResult.status === 'fulfilled') {
        setRoles(rolesResult.value)
      } else {
        setRoles([])
        softErrors.push(
          'Roles could not be loaded, so invitations and role changes are disabled.',
        )
      }

      if (invitesResult.status === 'fulfilled') {
        setInvites(invitesResult.value)
      } else {
        setInvites([])
        softErrors.push('Invitations could not be loaded.')
      }

      if (softErrors.length > 0) {
        setActionError(new Error(softErrors.join(' ')))
      }
    } catch (error) {
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    setEditingMember(null)
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

  async function handleInviteMember(values) {
    setActionError(null)
    setIsSaving(true)

    try {
      await inviteOrganizationMember(organizationId, values)
      setIsInviteOpen(false)
      await completeMutation(`Invitation sent to ${values.name}.`)
    } catch (error) {
      setActionError(error)
      if (error?.details?.reason === 'INVITE_EMAIL_DELIVERY_FAILED') {
        setIsInviteOpen(false)
        notifications.error(
          'Invite was saved, but email delivery failed. Fix SMTP and use Resend.',
        )
        await loadData().catch(() => {})
      } else {
        notifications.error(error.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateRole({ roleIds }) {
    if (!editingMember) return

    setActionError(null)
    setIsSaving(true)

    try {
      await replaceMemberRoles(organizationId, editingMember.id, roleIds)
      const email = editingMember.user.email
      setEditingMember(null)
      await completeMutation(`Role for ${email} was updated.`)
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

  async function handleResendInvite(invite) {
    setActionError(null)
    setIsSaving(true)

    try {
      await resendOrganizationInvite(organizationId, invite.id)
      await completeMutation(`Invitation resent to ${invite.email}.`)
    } catch (error) {
      setActionError(error)
      notifications.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const activeMembers = members.filter((member) => member.status === 'ACTIVE')
  const pendingInvites = invites.filter((invite) => invite.status === 'PENDING')
  const failedInvites = invites.filter((invite) => invite.lastSendFailureAt)
  const assignableRoles = roles.filter((role) => role.canAssign !== false)
  const hasAssignableRoles = assignableRoles.length > 0

  if (isLoading) {
    return (
      <main className="page">
        <Loader label="Loading organization members..." />
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
            Invite members, assign exactly one role, and control access for{' '}
            {selectedOrganization.organization.name}.
          </p>
        </div>
        <div className="inline-actions">
          <Button
            disabled={!hasAssignableRoles}
            onClick={() => {
              setActionError(null)
              setIsInviteOpen(true)
            }}
            title={
              hasAssignableRoles
                ? undefined
                : 'No assignable roles are available. Run the backend seed or ask Super Admin to configure roles.'
            }
          >
            Invite member
          </Button>
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert>{actionError.message}</Alert>}

      <section className="metric-grid" aria-label="Member management summary">
        <article>
          <span>Active members</span>
          <strong>{activeMembers.length}</strong>
        </article>
        <article>
          <span>Pending invites</span>
          <strong>{pendingInvites.length}</strong>
        </article>
        <article>
          <span>Email issues</span>
          <strong>{failedInvites.length}</strong>
        </article>
      </section>

      <section className="member-list" aria-label="Organization members">
        {members.length ? (
          members.map((member) => {
            const isCurrentUser = member.user.id === user.id
            const role = getMemberRole(member)
            const availableCurrentRole = role
              ? roles.find((availableRole) => availableRole.id === role.id)
              : null
            const canManageTargetRole =
              !role ||
              Boolean(
                availableCurrentRole &&
                  availableCurrentRole.canAssign !== false,
              )
            const protectedRoleMessage = `Only Super Admin can manage members with ${getRoleDisplayName(role)}.`

            return (
              <article className="member-card" key={member.id}>
                <div className="member-card__identity">
                  <span aria-hidden="true" className="member-avatar">
                    {(member.user.name ?? member.user.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h2>{member.user.name ?? member.user.email}</h2>
                    <div className="member-card__meta">
                      {member.user.name && (
                        <span className="muted-copy">{member.user.email}</span>
                      )}
                      <span
                        className={`status-badge ${
                          member.status === 'ACTIVE'
                            ? 'status-badge--success'
                            : 'status-badge--warning'
                        }`}
                      >
                        {member.status}
                      </span>
                      {isCurrentUser && (
                        <span className="member-label">This is you</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="member-card__roles">
                  <span className="card__label">Current role</span>
                  {role ? (
                    <span className="role-chip">{role.name}</span>
                  ) : (
                    <span className="muted-copy">No role assigned</span>
                  )}
                </div>

                <div className="member-card__actions">
                  <Button
                    disabled={
                      isSaving ||
                      isCurrentUser ||
                      !hasAssignableRoles ||
                      !canManageTargetRole
                    }
                    onClick={() => {
                      setActionError(null)
                      setEditingMember(member)
                    }}
                    title={
                      isCurrentUser
                        ? 'You cannot change your own organization role.'
                        : !canManageTargetRole
                          ? protectedRoleMessage
                          : !hasAssignableRoles
                            ? 'No assignable roles are available.'
                        : undefined
                    }
                    variant="secondary"
                  >
                    Edit role
                  </Button>
                  <Button
                    disabled={isSaving || isCurrentUser || !canManageTargetRole}
                    onClick={() => void handleStatusChange(member)}
                    title={
                      isCurrentUser
                        ? 'You cannot suspend or reactivate your own membership.'
                        : !canManageTargetRole
                          ? protectedRoleMessage
                        : undefined
                    }
                    variant="secondary"
                  >
                    {member.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                  </Button>
                  <Button
                    disabled={isSaving || isCurrentUser || !canManageTargetRole}
                    onClick={() => {
                      setActionError(null)
                      setMemberToRemove(member)
                    }}
                    title={
                      isCurrentUser
                        ? 'You cannot remove your own membership.'
                        : !canManageTargetRole
                          ? protectedRoleMessage
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
              <p>Invite the first organization member to begin onboarding.</p>
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
                  <h3>{invite.name ?? invite.email}</h3>
                  {invite.name && (
                    <p className="muted-copy">{invite.email}</p>
                  )}
                  <p className="muted-copy">
                    Expires {formatDate(invite.expiresAt)}
                  </p>
                  {invite.lastSentAt && (
                    <p className="muted-copy">
                      Last sent {formatDate(invite.lastSentAt)}
                    </p>
                  )}
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
                <div className="member-card__roles">
                  <span className="card__label">Invited role</span>
                  {invite.roles?.[0] ? (
                    <span className="role-chip">{invite.roles[0].name}</span>
                  ) : (
                    <span className="muted-copy">No role assigned</span>
                  )}
                </div>
                {invite.lastSendFailureAt && (
                  <Alert tone="warning" title="Email delivery failed">
                    Last failed {formatDate(invite.lastSendFailureAt)}
                    {invite.lastSendFailureReason
                      ? ` - ${invite.lastSendFailureReason}`
                      : '. Fix SMTP settings, then resend or revoke this invite.'}
                  </Alert>
                )}
                <div className="member-card__actions">
                  <Button
                    disabled={
                      isSaving ||
                      !['PENDING', 'EXPIRED'].includes(invite.status)
                    }
                    onClick={() => void handleResendInvite(invite)}
                    variant="secondary"
                  >
                    Resend
                  </Button>
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
        isOpen={Boolean(editingMember)}
        onClose={() => !isSaving && setEditingMember(null)}
        title="Edit member role"
      >
        {actionError && <Alert>{actionError.message}</Alert>}
        {editingMember && (
          <MemberForm
            isSaving={isSaving}
            key={editingMember.id}
            member={editingMember}
            onCancel={() => setEditingMember(null)}
            onSubmit={handleUpdateRole}
            roles={assignableRoles}
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
            roles={assignableRoles}
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
          Removing <strong>{memberToRemove?.user.email}</strong> revokes their
          organization role. They can be invited again later.
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
            {isSaving ? 'Removing...' : 'Remove member'}
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
    <OrganizationPermissionBoundary permission="members.manage">
      <MembersContent />
    </OrganizationPermissionBoundary>
  )
}
