import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { getFriendlyErrorMessage } from '../../../shared/utils/errorMessages.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { getUsers, updateUser } from '../../users/services/userApi.js'
import { MemberForm } from '../components/MemberForm.jsx'
import { OrganizationPermissionBoundary } from '../components/OrganizationPermissionBoundary.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'
import {
  acceptOrganizationJoinRequest,
  getOrganizationPeopleAccess,
  getPlatformOrganizations,
  getRoles,
  inviteOrganizationMember,
  rejectOrganizationJoinRequest,
  removeMember,
  replaceMemberRoles,
  resendOrganizationInvite,
  revokeOrganizationInvite,
  updateMemberStatus,
} from '../services/accessControlApi.js'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 50]
const ALL_SOURCE = 'all'

function formatDate(value) {
  if (!value) return 'Not available'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getMemberRole(member) {
  return member.roles?.[0] ?? null
}

function getRoleDisplayName(role) {
  return role?.name ?? 'No role'
}

function getStatusTone(status) {
  const normalized = String(status ?? '').toUpperCase()

  if (['ACTIVE', 'ACCEPTED'].includes(normalized)) return 'success'
  if (['PENDING', 'SUSPENDED', 'EXPIRED', 'CANCELED'].includes(normalized)) {
    return 'warning'
  }

  return 'danger'
}

function AccessIcon({ name, size = 16 }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
  }

  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {name === 'edit' && (
        <>
          <path d="M12 20h9" {...commonProps} />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" {...commonProps} />
        </>
      )}
      {name === 'pause' && (
        <>
          <rect height="14" rx="1" width="4" x="6" y="5" {...commonProps} />
          <rect height="14" rx="1" width="4" x="14" y="5" {...commonProps} />
        </>
      )}
      {name === 'play' && <path d="m7 4 13 8-13 8Z" {...commonProps} />}
      {name === 'trash' && (
        <>
          <path d="M4 7h16" {...commonProps} />
          <path d="M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" {...commonProps} />
        </>
      )}
      {name === 'mail' && (
        <>
          <rect height="16" rx="2" width="20" x="2" y="4" {...commonProps} />
          <path d="m22 7-10 6L2 7" {...commonProps} />
        </>
      )}
      {name === 'ban' && (
        <>
          <circle cx="12" cy="12" r="9" {...commonProps} />
          <path d="m5.6 5.6 12.8 12.8" {...commonProps} />
        </>
      )}
      {name === 'check' && (
        <>
          <circle cx="12" cy="12" r="9" {...commonProps} />
          <path d="m8 12 2.5 2.5L16 9" {...commonProps} />
        </>
      )}
      {name === 'x' && (
        <>
          <circle cx="12" cy="12" r="9" {...commonProps} />
          <path d="m9 9 6 6M15 9l-6 6" {...commonProps} />
        </>
      )}
      {name === 'info' && (
        <>
          <circle cx="12" cy="12" r="9" {...commonProps} />
          <path d="M12 11v5M12 8h.01" {...commonProps} />
        </>
      )}
      {name === 'user' && (
        <>
          <circle cx="12" cy="8" r="4" {...commonProps} />
          <path d="M4 21a8 8 0 0 1 16 0" {...commonProps} />
        </>
      )}
    </svg>
  )
}

function ActionIconButton({
  disabled,
  icon,
  label,
  onClick,
  tone = 'neutral',
}) {
  return (
    <button
      aria-label={label}
      className={`access-icon-button access-icon-button--${tone}`}
      data-tooltip={label}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <AccessIcon name={icon} />
    </button>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-badge--${getStatusTone(status)}`}>
      {String(status ?? 'UNKNOWN').replace(/_/g, ' ')}
    </span>
  )
}

function CellText({ children, muted, title }) {
  return (
    <span className={muted ? 'access-cell-text muted-copy' : 'access-cell-text'} title={title ?? children}>
      {children}
    </span>
  )
}

function toPlatformUserRow(user, selectedOrganizationId) {
  const memberships = selectedOrganizationId
    ? user.memberships.filter(
        (membership) => membership.organization.id === selectedOrganizationId,
      )
    : user.memberships
  const primaryMembership = memberships[0] ?? null
  const role =
    primaryMembership?.roles?.[0] ?? user.platformRoles?.[0] ?? null
  const organizationSummary = selectedOrganizationId
    ? primaryMembership?.organization
    : memberships.length === 1
      ? memberships[0].organization
      : null
  const manageableMember =
    primaryMembership && organizationSummary
      ? {
          id: primaryMembership.id,
          organization: primaryMembership.organization,
          roles: primaryMembership.roles,
          status: primaryMembership.status,
          user: {
            email: user.email,
            id: user.id,
            name: user.name,
          },
        }
      : null

  return {
    id: `user:${user.id}`,
    raw: user,
    source: 'platform-user',
    sourceLabel: 'User',
    name: user.name ?? user.email,
    email: user.email,
    member: manageableMember,
    organization: organizationSummary,
    organizationCount: memberships.length,
    role,
    roleName: getRoleDisplayName(role),
    status: user.isActive ? 'ACTIVE' : 'INACTIVE',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    detail: primaryMembership
      ? `${primaryMembership.organization.name} · ${primaryMembership.status}`
      : user.platformRoles?.length
        ? 'Platform level account.'
        : 'No organization membership.',
  }
}

function DetailsModal({ item, onClose }) {
  if (!item) return null

  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} title="Access details">
      <div className="access-details">
        <div>
          <span className="card__label">Person</span>
          <h2>{item.name}</h2>
          <p className="muted-copy">{item.email}</p>
        </div>
        <dl>
          <div>
            <dt>Type</dt>
            <dd>{item.sourceLabel}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={item.status} />
            </dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{item.organization?.name ?? 'Platform / none'}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{item.roleName}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDate(item.createdAt)}</dd>
          </div>
          <div>
            <dt>Last update</dt>
            <dd>{formatDate(item.updatedAt)}</dd>
          </div>
        </dl>
        <section className="access-details__note">
          <span className="card__label">
            {item.source === 'request' && item.status === 'REJECTED'
              ? 'Rejection reason'
              : item.source === 'invite' && item.status === 'REVOKED'
                ? 'Revocation detail'
                : 'Detail'}
          </span>
          <p>{item.detail || 'No additional details were recorded.'}</p>
        </section>
      </div>
    </Modal>
  )
}

function PeopleAccessTable({
  canManageMembers,
  currentUserId,
  isPlatform,
  isSaving,
  onAcceptRequest,
  onDetails,
  onEditMember,
  onPlatformEditMember,
  onPlatformMemberRemove,
  onPlatformMemberStatusChange,
  onPlatformToggle,
  onRejectRequest,
  onRemoveMember,
  onResendInvite,
  onRevokeInvite,
  onStatusChange,
  roles,
  rows,
}) {
  return (
    <div
      className={`access-table ${isPlatform ? 'access-table--platform' : ''}`}
      role="table"
    >
      <div className="access-table__row access-table__row--head" role="row">
        <span role="columnheader">Person</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Organization</span>
        <span role="columnheader">Role</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Updated</span>
        <span role="columnheader">Actions</span>
      </div>

      {rows.map((row) => {
        const memberForActions =
          row.source === 'member'
            ? row.raw
            : row.source === 'platform-user'
              ? row.member
              : null
        const isSelf =
          row.source === 'member'
            ? row.raw.user.id === currentUserId
            : row.source === 'platform-user'
              ? row.raw.id === currentUserId
              : row.raw.userId === currentUserId
        const role =
          row.source === 'member'
            ? getMemberRole(row.raw)
            : row.source === 'platform-user'
              ? row.member?.roles?.[0] ?? null
              : null
        const availableCurrentRole = role
          ? roles.find((availableRole) => availableRole.id === role.id)
          : null
        const canManageTargetRole =
          isPlatform
            ? Boolean(row.member)
            : row.source !== 'member' ||
              !role ||
              Boolean(availableCurrentRole && availableCurrentRole.canAssign !== false)
        const protectedRoleMessage = `Only Super Admin can manage ${getRoleDisplayName(role)}.`

        return (
          <article className="access-table__row" key={row.id} role="row">
            <span className="access-person" data-label="Person" role="cell">
              <span aria-hidden="true" className="member-avatar">
                {(row.name ?? row.email).slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong title={row.name}>{row.name}</strong>
                <small title={row.email}>{row.email}</small>
              </span>
            </span>
            <span data-label="Type" role="cell">
              <span className={`access-source access-source--${row.source}`}>
                {row.sourceLabel}
              </span>
            </span>
            <span data-label="Organization" role="cell">
              {row.organization ? (
                <>
                  <CellText title={row.organization.name}>
                    {row.organization.name}
                  </CellText>
                  {row.organization.slug && (
                    <CellText muted title={row.organization.slug}>
                      {row.organization.slug}
                    </CellText>
                  )}
                </>
              ) : row.organizationCount > 1 ? (
                <CellText>{row.organizationCount} organizations</CellText>
              ) : (
                <CellText muted>Platform / none</CellText>
              )}
            </span>
            <span data-label="Role" role="cell">
              <span className="role-chip" title={row.roleName}>
                {row.roleName}
              </span>
            </span>
            <span data-label="Status" role="cell">
              <StatusBadge status={row.status} />
            </span>
            <span data-label="Updated" role="cell">
              <CellText muted>{formatDate(row.updatedAt)}</CellText>
              <CellText muted title={row.detail}>
                {row.detail}
              </CellText>
            </span>
            <span className="access-actions" data-label="Actions" role="cell">
              <ActionIconButton
                icon="info"
                label="View details"
                onClick={() => onDetails(row)}
              />
              {isPlatform && row.source === 'platform-user' && (
                <>
                  {memberForActions && (
                    <>
                      <ActionIconButton
                        disabled={isSaving || isSelf || !canManageTargetRole}
                        icon="edit"
                        label={
                          isSelf
                            ? 'You cannot change your own role'
                            : 'Edit organization role'
                        }
                        onClick={() => onPlatformEditMember(row)}
                      />
                      <ActionIconButton
                        disabled={isSaving || isSelf || !canManageTargetRole}
                        icon={memberForActions.status === 'ACTIVE' ? 'pause' : 'play'}
                        label={
                          memberForActions.status === 'ACTIVE'
                            ? 'Suspend membership'
                            : 'Reactivate membership'
                        }
                        onClick={() => onPlatformMemberStatusChange(row)}
                        tone={memberForActions.status === 'ACTIVE' ? 'danger' : 'success'}
                      />
                      <ActionIconButton
                        disabled={isSaving || isSelf || !canManageTargetRole}
                        icon="trash"
                        label="Remove membership"
                        onClick={() => onPlatformMemberRemove(row)}
                        tone="danger"
                      />
                    </>
                  )}
                  <ActionIconButton
                    disabled={isSaving || isSelf}
                    icon={row.raw.isActive ? 'pause' : 'play'}
                    label={row.raw.isActive ? 'Deactivate account' : 'Reactivate account'}
                    onClick={() => onPlatformToggle(row.raw)}
                    tone={row.raw.isActive ? 'danger' : 'success'}
                  />
                </>
              )}
              {!isPlatform && row.source === 'member' && canManageMembers && (
                <>
                  <ActionIconButton
                    disabled={isSaving || isSelf || !canManageTargetRole}
                    icon="edit"
                    label={
                      isSelf
                        ? 'You cannot change your own role'
                        : !canManageTargetRole
                          ? protectedRoleMessage
                          : 'Edit role'
                    }
                    onClick={() => onEditMember(row.raw)}
                  />
                  <ActionIconButton
                    disabled={isSaving || isSelf || !canManageTargetRole}
                    icon={row.raw.status === 'ACTIVE' ? 'pause' : 'play'}
                    label={
                      row.raw.status === 'ACTIVE'
                        ? 'Suspend member'
                        : 'Reactivate member'
                    }
                    onClick={() => onStatusChange(row.raw)}
                    tone={row.raw.status === 'ACTIVE' ? 'danger' : 'success'}
                  />
                  <ActionIconButton
                    disabled={isSaving || isSelf || !canManageTargetRole}
                    icon="trash"
                    label="Remove member"
                    onClick={() => onRemoveMember(row.raw)}
                    tone="danger"
                  />
                </>
              )}
              {!isPlatform && row.source === 'invite' && canManageMembers && (
                <>
                  <ActionIconButton
                    disabled={isSaving || !['PENDING', 'EXPIRED'].includes(row.raw.status)}
                    icon="mail"
                    label="Resend invite"
                    onClick={() => onResendInvite(row.raw)}
                  />
                  <ActionIconButton
                    disabled={isSaving || row.raw.status !== 'PENDING'}
                    icon="ban"
                    label="Revoke invite"
                    onClick={() => onRevokeInvite(row.raw)}
                    tone="danger"
                  />
                </>
              )}
              {!isPlatform && row.source === 'request' && canManageMembers && (
                <>
                  <ActionIconButton
                    disabled={isSaving || row.raw.status !== 'PENDING' || isSelf}
                    icon="check"
                    label="Accept request"
                    onClick={() => onAcceptRequest(row.raw)}
                    tone="success"
                  />
                  <ActionIconButton
                    disabled={isSaving || row.raw.status !== 'PENDING' || isSelf}
                    icon="x"
                    label="Reject request"
                    onClick={() => onRejectRequest(row.raw)}
                    tone="danger"
                  />
                </>
              )}
            </span>
          </article>
        )
      })}
    </div>
  )
}

function OrganizationPeopleAccess() {
  const { hasPermission, refreshAccess, selectedOrganization } = useAccessControl()
  const { user } = useAuth()
  const notifications = useNotifications()
  const organizationId = selectedOrganization.organization.id
  const organization = selectedOrganization.organization
  const canManageMembers = hasPermission('members.manage')
  const [actionError, setActionError] = useState(null)
  const [detailsItem, setDetailsItem] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [inviteToRevoke, setInviteToRevoke] = useState(null)
  const [inviteRevocationReason, setInviteRevocationReason] = useState('')
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [requestDecision, setRequestDecision] = useState(null)
  const [requestRoleId, setRequestRoleId] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [roles, setRoles] = useState([])
  const [rows, setRows] = useState([])
  const [rowsPage, setRowsPage] = useState(1)
  const [rowsPageSize, setRowsPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [rowsPagination, setRowsPagination] = useState(null)
  const [summary, setSummary] = useState({
    invites: 0,
    members: 0,
    requests: 0,
    total: 0,
  })
  const [filters, setFilters] = useState({
    roleId: '',
    search: '',
    source: ALL_SOURCE,
    status: 'all',
  })

  const updateFilters = useCallback((updater) => {
    setRowsPage(1)
    setFilters((current) => ({ ...current, ...updater }))
  }, [])

  useEffect(() => {
    if (
      !canManageMembers &&
      filters.source !== ALL_SOURCE &&
      filters.source !== 'member'
    ) {
      updateFilters({ source: ALL_SOURCE })
    }
  }, [canManageMembers, filters.source, updateFilters])

  const loadData = useCallback(async () => {
    setActionError(null)
    setIsLoading(true)

    try {
      const [peopleResult, rolesResult] = await Promise.allSettled([
        getOrganizationPeopleAccess(organizationId, {
          page: rowsPage,
          pageSize: rowsPageSize,
          roleId: filters.roleId,
          search: filters.search.trim(),
          source: filters.source,
          status: filters.status,
        }),
        canManageMembers
          ? getRoles(organizationId, { page: 1, pageSize: 100 })
          : Promise.resolve({ roles: [] }),
      ])

      if (peopleResult.status === 'rejected') throw peopleResult.reason

      if (
        peopleResult.value.pagination &&
        peopleResult.value.pagination.total > 0 &&
        peopleResult.value.pagination.page > peopleResult.value.pagination.pageCount
      ) {
        setRowsPage(peopleResult.value.pagination.pageCount)
        return
      }

      setRows(peopleResult.value.rows ?? [])
      setRowsPagination(peopleResult.value.pagination ?? null)
      setSummary(
        peopleResult.value.summary ?? {
          invites: 0,
          members: 0,
          requests: 0,
          total: 0,
        },
      )
      setRoles(rolesResult.status === 'fulfilled' ? rolesResult.value.roles ?? [] : [])

      if (rolesResult.status === 'rejected') {
        setActionError(new Error('Roles could not be loaded.'))
      }
    } catch (error) {
      setRows([])
      setRowsPagination(null)
      setSummary({
        invites: 0,
        members: 0,
        requests: 0,
        total: 0,
      })
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [
    canManageMembers,
    filters.roleId,
    filters.search,
    filters.source,
    filters.status,
    organizationId,
    rowsPage,
    rowsPageSize,
  ])

  useEffect(() => {
    setEditingMember(null)
    setInviteToRevoke(null)
    setInviteRevocationReason('')
    setMemberToRemove(null)
    setRequestDecision(null)
    void loadData()
  }, [loadData])

  const assignableRoles = roles.filter((role) => role.canAssign !== false)
  const requestCount = summary.requests

  async function completeMutation(message) {
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
      notifications.error(getFriendlyErrorMessage(error))
      if (error?.details?.reason === 'INVITE_EMAIL_DELIVERY_FAILED') {
        setIsInviteOpen(false)
        await loadData().catch(() => {})
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
      notifications.error(getFriendlyErrorMessage(error))
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
      await completeMutation(`${member.user.email} is now ${nextStatus.toLowerCase()}.`)
    } catch (error) {
      setActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
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
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRevokeInvite() {
    if (!inviteToRevoke) return
    setActionError(null)
    setIsSaving(true)

    try {
      await revokeOrganizationInvite(
        organizationId,
        inviteToRevoke.id,
        inviteRevocationReason.trim(),
      )
      const email = inviteToRevoke.email
      setInviteToRevoke(null)
      setInviteRevocationReason('')
      await completeMutation(`Invitation for ${email} was revoked.`)
    } catch (error) {
      setActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
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
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  function openRequestDecision(request, action) {
    setRequestDecision({ action, request })
    setRequestRoleId(assignableRoles[0]?.id ?? '')
    setRejectionReason('')
    setActionError(null)
  }

  async function handleAcceptRequest() {
    if (!requestDecision?.request || !requestRoleId) return
    setActionError(null)
    setIsSaving(true)

    try {
      await acceptOrganizationJoinRequest(organizationId, requestDecision.request.id, [
        requestRoleId,
      ])
      const email = requestDecision.request.user.email
      setRequestDecision(null)
      await completeMutation(`${email} was accepted as an organization member.`)
    } catch (error) {
      setActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRejectRequest() {
    if (!requestDecision?.request) return
    setActionError(null)
    setIsSaving(true)

    try {
      await rejectOrganizationJoinRequest(
        organizationId,
        requestDecision.request.id,
        rejectionReason.trim(),
      )
      const email = requestDecision.request.user.email
      setRequestDecision(null)
      await completeMutation(`${email}'s access request was rejected.`)
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
        <Loader label="Loading people access..." />
      </main>
    )
  }

  return (
    <main className="page page--wide page--people-access">
      <header className="page-header">
        <div>
          <h1>{canManageMembers ? 'People access' : 'My team'}</h1>
          <p>
            {canManageMembers
              ? `Manage members, invitations, and access requests for ${organization.name} in one place.`
              : `Review employees visible to your role in ${organization.name}.`}
          </p>
        </div>
        <div className="inline-actions">
          <RefreshIconButton
            disabled={isLoading}
            label="Refresh people access"
            onClick={() => void loadData()}
          />
          {canManageMembers && (
            <Button
              disabled={!assignableRoles.length}
              onClick={() => setIsInviteOpen(true)}
            >
              Invite member
            </Button>
          )}
        </div>
      </header>

      {actionError && (
        <Alert onDismiss={() => setActionError(null)}>
          {getFriendlyErrorMessage(actionError)}
        </Alert>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div className="table-toolbar__search">
            <input
              aria-label="Search members"
              className="table-toolbar__input"
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder="Search by name, email..."
              type="search"
              value={filters.search}
            />
          </div>
          <div className="table-toolbar__filters">
            <select
              aria-label="Filter record type"
              className="table-toolbar__select"
              onChange={(event) => updateFilters({ source: event.target.value })}
              value={filters.source}
            >
              <option value={ALL_SOURCE}>All records</option>
              <option value="member">Members</option>
              {canManageMembers && <option value="invite">Invites</option>}
              {canManageMembers && <option value="request">Requests</option>}
            </select>
            <select
              aria-label="Filter status"
              className="table-toolbar__select"
              onChange={(event) => updateFilters({ status: event.target.value })}
              value={filters.status}
            >
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="REVOKED">Revoked</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELED">Canceled</option>
            </select>
            <select
              aria-label="Filter role"
              className="table-toolbar__select"
              onChange={(event) => updateFilters({ roleId: event.target.value })}
              value={filters.roleId}
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <span className="table-toolbar__counter">
              {summary.total} records · {summary.members} members
            </span>
          </div>
        </div>

        {rows.length ? (
          <PeopleAccessTable
            canManageMembers={canManageMembers}
            currentUserId={user.id}
            isPlatform={false}
            isSaving={isSaving}
            onAcceptRequest={(request) => openRequestDecision(request, 'accept')}
            onDetails={setDetailsItem}
            onEditMember={setEditingMember}
            onRejectRequest={(request) => openRequestDecision(request, 'reject')}
            onRemoveMember={setMemberToRemove}
            onResendInvite={handleResendInvite}
            onRevokeInvite={setInviteToRevoke}
            onStatusChange={handleStatusChange}
            roles={roles}
            rows={rows}
          />
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No access records found</h2>
              <p>Adjust filters or invite a member to start onboarding.</p>
            </div>
          </section>
        )}

        <ListPagination
          label="People access pagination"
          onPageChange={setRowsPage}
          onPageSizeChange={(nextPageSize) => {
            setRowsPageSize(nextPageSize)
            setRowsPage(1)
          }}
          pageSize={rowsPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          pagination={rowsPagination}
        />
      </section>

      <DetailsModal item={detailsItem} onClose={() => setDetailsItem(null)} />

      <Modal
        isOpen={Boolean(editingMember)}
        onClose={() => !isSaving && setEditingMember(null)}
        title="Edit member role"
      >
        {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}
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
        {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}
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
        {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}
        <p>
          Removing <strong>{memberToRemove?.user.email}</strong> revokes their
          organization access. They can be invited again later.
        </p>
        <div className="form-actions">
          <Button disabled={isSaving} onClick={() => setMemberToRemove(null)} variant="secondary">
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void handleRemoveMember()} variant="danger">
            {isSaving ? 'Removing...' : 'Remove member'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(inviteToRevoke)}
        onClose={() => {
          if (isSaving) return
          setInviteToRevoke(null)
          setInviteRevocationReason('')
        }}
        title="Revoke invitation?"
      >
        {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}
        <p>
          Revoking <strong>{inviteToRevoke?.email}</strong> prevents that invite
          link from being accepted.
        </p>
        <div className="access-details__note">
          <span className="card__label">Current invite state</span>
          <p>
            Status: {inviteToRevoke?.status}. Last sent:{' '}
            {formatDate(inviteToRevoke?.lastSentAt)}.
          </p>
        </div>
        <label className="field">
          <span className="field__label">Revocation reason</span>
          <textarea
            maxLength={500}
            onChange={(event) => setInviteRevocationReason(event.target.value)}
            placeholder="Example: Invitation sent to the wrong email address."
            rows={3}
            value={inviteRevocationReason}
          />
          <small className="muted-copy">
            This reason is saved and shown in invitation details.
          </small>
        </label>
        <div className="form-actions">
          <Button
            disabled={isSaving}
            onClick={() => {
              setInviteToRevoke(null)
              setInviteRevocationReason('')
            }}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isSaving || !inviteRevocationReason.trim()}
            onClick={() => void handleRevokeInvite()}
            variant="danger"
          >
            {isSaving ? 'Revoking...' : 'Revoke invite'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(requestDecision)}
        onClose={() => !isSaving && setRequestDecision(null)}
        title={
          requestDecision?.action === 'accept'
            ? 'Accept access request'
            : 'Reject access request'
        }
      >
        {actionError && <Alert>{getFriendlyErrorMessage(actionError)}</Alert>}
        {requestDecision?.request && (
          <div className="access-decision-form">
            <p>
              Requester:{' '}
              <strong>{requestDecision.request.user.email}</strong>
            </p>
            {requestDecision.request.message && (
              <p className="muted-copy">Message: {requestDecision.request.message}</p>
            )}
            {requestDecision.action === 'accept' ? (
              <label className="field">
                <span className="field__label">Assign role</span>
                <select
                  onChange={(event) => setRequestRoleId(event.target.value)}
                  value={requestRoleId}
                >
                  {assignableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span className="field__label">Rejection reason</span>
                <textarea
                  maxLength={1000}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Explain why this access request is rejected..."
                  rows={4}
                  value={rejectionReason}
                />
                <small className="muted-copy">
                  This reason is stored and shown in request details.
                </small>
              </label>
            )}
            <div className="form-actions">
              <Button
                disabled={isSaving}
                onClick={() => setRequestDecision(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  isSaving ||
                  (requestDecision.action === 'accept' && !requestRoleId) ||
                  (requestDecision.action === 'reject' &&
                    !rejectionReason.trim())
                }
                onClick={() =>
                  requestDecision.action === 'accept'
                    ? void handleAcceptRequest()
                    : void handleRejectRequest()
                }
                variant={requestDecision.action === 'accept' ? 'primary' : 'danger'}
              >
                {isSaving
                  ? 'Saving...'
                  : requestDecision.action === 'accept'
                    ? 'Accept request'
                    : 'Reject request'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  )
}

function PlatformPeopleAccess() {
  const { access, hasPlatformPermission, status } = useAccessControl()
  const { user: currentUser } = useAuth()
  const notifications = useNotifications()
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    organizationId: '',
    search: '',
    status: 'active',
  })
  const [editingMember, setEditingMember] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [memberRoles, setMemberRoles] = useState([])
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState(null)
  const [selectedDetails, setSelectedDetails] = useState(null)
  const [users, setUsers] = useState([])

  const canViewPlatformUsers = hasPlatformPermission('platform.users.manage')

  const updateFilters = useCallback((updater) => {
    setPage(1)
    setFilters((current) => ({ ...current, ...updater }))
  }, [])

  const loadData = useCallback(async () => {
    if (!canViewPlatformUsers) {
      setIsLoading(false)
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const [usersData, organizationsData] = await Promise.all([
        getUsers({
          organizationId: filters.organizationId,
          page,
          pageSize,
          search: filters.search.trim(),
          status: filters.status,
        }),
        getPlatformOrganizations({ page: 1, pageSize: 100, sort: 'name' }),
      ])

      if (
        usersData.pagination &&
        usersData.pagination.total > 0 &&
        usersData.pagination.page > usersData.pagination.pageCount
      ) {
        setPage(usersData.pagination.pageCount)
        return
      }

      setUsers(usersData.users ?? [])
      setPagination(usersData.pagination ?? null)
      setOrganizations(organizationsData.organizations ?? access?.organizations ?? [])
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [
    access?.organizations,
    canViewPlatformUsers,
    filters.organizationId,
    filters.search,
    filters.status,
    page,
    pageSize,
  ])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadData()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadData])

  async function handleToggleUser(targetUser) {
    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateUser(targetUser.id, {
        isActive: !targetUser.isActive,
      })
      notifications.success(`${updated.email} was updated.`)
      await loadData()
    } catch (requestError) {
      setError(requestError)
      notifications.error(getFriendlyErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function openEditMember(row) {
    if (!row.member || !row.organization) return
    setError(null)
    setIsSaving(true)

    try {
      const rolesData = await getRoles(row.organization.id, {
        page: 1,
        pageSize: 100,
      })
      setMemberRoles((rolesData.roles ?? []).filter((role) => role.canAssign !== false))
      setEditingMember({
        member: row.member,
        organization: row.organization,
      })
    } catch (requestError) {
      setError(requestError)
      notifications.error(getFriendlyErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateMemberRole({ roleIds }) {
    if (!editingMember) return
    setError(null)
    setIsSaving(true)

    try {
      await replaceMemberRoles(
        editingMember.organization.id,
        editingMember.member.id,
        roleIds,
      )
      notifications.success(`${editingMember.member.user.email}'s role was updated.`)
      setEditingMember(null)
      setMemberRoles([])
      await loadData()
    } catch (requestError) {
      setError(requestError)
      notifications.error(getFriendlyErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMembershipStatusChange(row) {
    if (!row.member || !row.organization) return
    const nextStatus = row.member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    setError(null)
    setIsSaving(true)

    try {
      await updateMemberStatus(row.organization.id, row.member.id, nextStatus)
      notifications.success(
        `${row.member.user.email}'s membership is now ${nextStatus.toLowerCase()}.`,
      )
      await loadData()
    } catch (requestError) {
      setError(requestError)
      notifications.error(getFriendlyErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveMembership() {
    if (!memberToRemove?.member || !memberToRemove.organization) return
    setError(null)
    setIsSaving(true)

    try {
      await removeMember(
        memberToRemove.organization.id,
        memberToRemove.member.id,
      )
      notifications.success(
        `${memberToRemove.member.user.email} was removed from ${memberToRemove.organization.name}.`,
      )
      setMemberToRemove(null)
      await loadData()
    } catch (requestError) {
      setError(requestError)
      notifications.error(getFriendlyErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Checking platform access..." />
      </main>
    )
  }

  if (!canViewPlatformUsers) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Super Admin access required</p>
            <h1>People access is restricted</h1>
            <p>Only Super Admin can review platform-wide users.</p>
          </div>
        </section>
      </main>
    )
  }

  const rows = users.map((managedUser) =>
    toPlatformUserRow(managedUser, filters.organizationId),
  )

  return (
    <main className="page page--wide page--people-access">
      <header className="page-header">
        <div>
          <h1>People access</h1>
          <p>
            Review users, organization access, role state, and account status
            across the platform.
          </p>
        </div>
        <RefreshIconButton
          disabled={isLoading}
          label="Refresh people"
          onClick={() => void loadData()}
        />
      </header>

      {error && (
        <Alert onDismiss={() => setError(null)}>
          {getFriendlyErrorMessage(error)}
        </Alert>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div className="table-toolbar__search">
            <input
              aria-label="Search users"
              className="table-toolbar__input"
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder="Search by name, email..."
              type="search"
              value={filters.search}
            />
          </div>
          <div className="table-toolbar__filters">
            <select
              aria-label="Filter organization"
              className="table-toolbar__select"
              onChange={(event) => updateFilters({ organizationId: event.target.value })}
              value={filters.organizationId}
            >
              <option value="">All organizations</option>
              {organizations.map((organizationRecord) => {
                const organization =
                  organizationRecord.organization ?? organizationRecord

                return (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                )
              })}
            </select>
            <select
              aria-label="Filter status"
              className="table-toolbar__select"
              onChange={(event) => updateFilters({ status: event.target.value })}
              value={filters.status}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All statuses</option>
            </select>
            <span className="table-toolbar__counter">
              {pagination?.total ?? users.length} users
            </span>
          </div>
        </div>

        {isLoading ? (
          <Loader label="Loading people access..." />
        ) : rows.length ? (
          <PeopleAccessTable
            canManageMembers
            currentUserId={currentUser.id}
            isPlatform
            isSaving={isSaving}
            onDetails={setSelectedDetails}
            onPlatformEditMember={openEditMember}
            onPlatformMemberRemove={setMemberToRemove}
            onPlatformMemberStatusChange={handleMembershipStatusChange}
            onPlatformToggle={handleToggleUser}
            roles={[]}
            rows={rows}
          />
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No users found</h2>
              <p>Adjust organization, status, or search filters.</p>
            </div>
          </section>
        )}

        <ListPagination
          label="Platform people pagination"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPage(1)
          }}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          pagination={pagination}
        />
      </section>

      <DetailsModal item={selectedDetails} onClose={() => setSelectedDetails(null)} />

      <Modal
        isOpen={Boolean(editingMember)}
        onClose={() => {
          if (isSaving) return
          setEditingMember(null)
          setMemberRoles([])
        }}
        title="Edit organization role"
      >
        {error && <Alert>{getFriendlyErrorMessage(error)}</Alert>}
        {editingMember && (
          <>
            <p className="muted-copy">
              Organization: <strong>{editingMember.organization.name}</strong>
            </p>
            <MemberForm
              isSaving={isSaving}
              key={editingMember.member.id}
              member={editingMember.member}
              onCancel={() => {
                setEditingMember(null)
                setMemberRoles([])
              }}
              onSubmit={handleUpdateMemberRole}
              roles={memberRoles}
            />
          </>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(memberToRemove)}
        onClose={() => !isSaving && setMemberToRemove(null)}
        title="Remove organization membership?"
      >
        {error && <Alert>{getFriendlyErrorMessage(error)}</Alert>}
        <p>
          Removing <strong>{memberToRemove?.member.user.email}</strong> from{' '}
          <strong>{memberToRemove?.organization.name}</strong> revokes only this
          organization membership. The account can still exist on the platform.
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
            onClick={() => void handleRemoveMembership()}
            variant="danger"
          >
            {isSaving ? 'Removing...' : 'Remove membership'}
          </Button>
        </div>
      </Modal>
    </main>
  )
}

export function Members({ scope = 'organization' }) {
  if (scope === 'platform') {
    return <PlatformPeopleAccess />
  }

  return (
    <OrganizationPermissionBoundary
      permissions={['members.manage', 'analytics.view']}
    >
      <OrganizationPeopleAccess />
    </OrganizationPermissionBoundary>
  )
}
