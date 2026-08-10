import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import {
  getDisplayName,
  getInitialsFromUser,
  getPrimaryRoleName,
  isSuperAdminAccess,
} from '../../../shared/utils/accessDisplay.js'
import {
  getMembers,
  getOrganizationInvites,
  getPlatformOrganizations,
} from '../../access-control/services/accessControlApi.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  listOrganizationDocuments,
  listPlatformDocuments,
} from '../../documents/services/documentsApi.js'
import { getAuditLogs } from '../../users/services/auditApi.js'
import { getUsers } from '../../users/services/userApi.js'

function DashboardIcon({ name }) {
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
      height="18"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      {name === 'building' && (
        <>
          <path d="M4 21V7a2 2 0 0 1 2-2h5v16" {...commonProps} />
          <path d="M11 21V3h7a2 2 0 0 1 2 2v16" {...commonProps} />
          <path d="M8 9h1M8 13h1M8 17h1M15 7h1M15 11h1M15 15h1" {...commonProps} />
        </>
      )}
      {name === 'trend' && (
        <>
          <path d="m3 17 6-6 4 4 8-8" {...commonProps} />
          <path d="M14 7h7v7" {...commonProps} />
        </>
      )}
      {name === 'users' && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" {...commonProps} />
          <circle cx="9.5" cy="7" r="4" {...commonProps} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...commonProps} />
        </>
      )}
      {name === 'file' && (
        <>
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" {...commonProps} />
          <path d="M14 2v5h5M9 13h6M9 17h4" {...commonProps} />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="7" {...commonProps} />
          <path d="m20 20-3.5-3.5" {...commonProps} />
        </>
      )}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="9" {...commonProps} />
          <path d="M12 7v5l3 2" {...commonProps} />
        </>
      )}
      {name === 'arrow' && <path d="M5 12h14m-6-6 6 6-6 6" {...commonProps} />}
      {name === 'plus' && <path d="M12 5v14M5 12h14" {...commonProps} />}
    </svg>
  )
}

function formatCount(value) {
  return Number.isFinite(value) ? value : '—'
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getStatusTone(status) {
  const normalized = String(status ?? '').toLowerCase()

  if (['processed', 'active', 'success', 'accepted'].includes(normalized)) {
    return 'success'
  }

  if (['failed', 'revoked', 'deleted', 'inactive', 'suspended'].includes(normalized)) {
    return 'danger'
  }

  return 'warning'
}

function getActor(log) {
  return log?.actor ?? log?.metadata?.actor ?? null
}

function getActorName(log) {
  const actor = getActor(log)

  return actor?.name ?? actor?.email ?? 'System'
}

function getInitials(label) {
  return String(label || 'SY')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function StatCard({ icon, label, sub, value }) {
  return (
    <article className="dashboard-stat-card">
      <span aria-hidden="true" className="dashboard-stat-card__icon">
        <DashboardIcon name={icon} />
      </span>
      <strong>{formatCount(value)}</strong>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </article>
  )
}

function DashboardPanel({ children, linkTo, title }) {
  return (
    <section className="card dashboard-panel">
      <header className="dashboard-panel__header">
        <h2>{title}</h2>
        {linkTo && (
          <Link className="dashboard-panel__link" to={linkTo}>
            View all <DashboardIcon name="arrow" />
          </Link>
        )}
      </header>
      {children}
    </section>
  )
}

function EmptyDashboardList({ message }) {
  return <p className="dashboard-empty-copy">{message}</p>
}

function AuditList({ logs }) {
  if (!logs.length) {
    return <EmptyDashboardList message="No recent audit activity yet." />
  }

  return (
    <div className="dashboard-list">
      {logs.slice(0, 4).map((log) => {
        const actorName = getActorName(log)

        return (
          <article className="dashboard-row" key={log.id}>
            <span className="dashboard-row__avatar">{getInitials(actorName)}</span>
            <span className="dashboard-row__content">
              <strong>{actorName}</strong>
              <small>{log.action ?? 'Activity recorded'}</small>
            </span>
            <span className="dashboard-row__date">
              <DashboardIcon name="clock" />
              {formatDate(log.createdAt)}
            </span>
          </article>
        )
      })}
    </div>
  )
}

function DocumentList({ documents }) {
  if (!documents.length) {
    return <EmptyDashboardList message="No document uploads found." />
  }

  return (
    <div className="dashboard-list">
      {documents.slice(0, 4).map((document) => (
        <article className="dashboard-row" key={document.id}>
          <span className="dashboard-row__file">
            <DashboardIcon name="file" />
          </span>
          <span className="dashboard-row__content">
            <strong>{document.name ?? document.originalFilename}</strong>
            <small>
              {document.organization?.name ??
                document.createdBy?.name ??
                document.createdBy?.email ??
                'Document'}
              {document.sizeBytes ? ` · ${formatBytes(document.sizeBytes)}` : ''}
            </small>
          </span>
          <span
            className={`status-badge status-badge--${getStatusTone(
              document.status,
            )}`}
          >
            {String(document.status ?? 'pending').toLowerCase()}
          </span>
        </article>
      ))}
    </div>
  )
}

export function Dashboard() {
  const {
    access,
    effectiveRoles,
    hasPermission,
    hasPlatformPermission,
    selectedOrganization,
    status,
  } = useAccessControl()
  const { user } = useAuth()
  const [dashboardError, setDashboardError] = useState(null)
  const [dashboardState, setDashboardState] = useState({
    auditLogs: [],
    documents: [],
    invites: [],
    members: [],
    organizations: [],
    totalDocuments: null,
    totalUsers: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const displayName = getDisplayName(user)
  const isSuperAdmin = isSuperAdminAccess(user, access)
  const organizationId = selectedOrganization?.organization.id
  const canReadDocuments = hasPermission('documents.read')
  const canManageMembers = hasPermission('members.manage')
  const canViewPlatformOrganizations = hasPlatformPermission(
    'platform.organizations.manage',
  )
  const canViewPlatformUsers = hasPlatformPermission('platform.users.manage')
  const canViewPlatformAudit = hasPlatformPermission('platform.audit_logs.view')
  const canViewPlatformDocuments =
    isSuperAdmin || hasPlatformPermission('platform.documents.manage')

  const currentRoleName = useMemo(() => {
    const roles = selectedOrganization ? effectiveRoles : access?.platform?.roles

    return getPrimaryRoleName(roles ?? [])
  }, [access?.platform?.roles, effectiveRoles, selectedOrganization])

  const loadDashboard = useCallback(async () => {
    if (status !== 'ready') return

    setIsLoading(true)
    setDashboardError(null)

    const nextState = {
      auditLogs: [],
      documents: [],
      invites: [],
      members: [],
      organizations: [],
      totalDocuments: null,
      totalOrganizations: null,
      totalUsers: null,
    }

    try {
      if (isSuperAdmin) {
        const requests = await Promise.allSettled([
          canViewPlatformOrganizations
            ? getPlatformOrganizations({ page: 1, pageSize: 100 })
            : Promise.resolve({ organizations: [], pagination: null }),
          canViewPlatformUsers
            ? getUsers({ page: 1, pageSize: 5, status: 'all' })
            : Promise.resolve({ pagination: null, users: [] }),
          canViewPlatformDocuments
            ? listPlatformDocuments({ page: 1, pageSize: 5 })
            : Promise.resolve({ documents: [], pagination: null }),
          canViewPlatformAudit
            ? getAuditLogs({ page: 1, pageSize: 5 })
            : Promise.resolve({ logs: [], pagination: null }),
        ])

        if (requests[0].status === 'fulfilled') {
          nextState.organizations = requests[0].value?.organizations ?? []
          nextState.totalOrganizations =
            requests[0].value?.pagination?.total ??
            nextState.organizations.length
        }

        if (requests[1].status === 'fulfilled') {
          nextState.totalUsers =
            requests[1].value?.pagination?.total ??
            requests[1].value?.users?.length ??
            null
        }

        if (requests[2].status === 'fulfilled') {
          nextState.documents = requests[2].value?.documents ?? []
          nextState.totalDocuments =
            requests[2].value?.pagination?.total ?? nextState.documents.length
        }

        if (requests[3].status === 'fulfilled') {
          nextState.auditLogs = requests[3].value?.logs ?? []
        }
      } else if (organizationId) {
        const requests = await Promise.allSettled([
          canManageMembers
            ? getMembers(organizationId, { page: 1, pageSize: 100 })
            : Promise.resolve({ members: [], pagination: null }),
          canManageMembers
            ? getOrganizationInvites(organizationId, { page: 1, pageSize: 100 })
            : Promise.resolve({ invites: [], pagination: null }),
          canReadDocuments
            ? listOrganizationDocuments(organizationId, { page: 1, pageSize: 5 })
            : Promise.resolve({ documents: [], pagination: null }),
          canManageMembers
            ? getAuditLogs({ organizationId, page: 1, pageSize: 5 })
            : Promise.resolve({ logs: [], pagination: null }),
        ])

        if (requests[0].status === 'fulfilled') {
          nextState.members = requests[0].value?.members ?? []
        }

        if (requests[1].status === 'fulfilled') {
          nextState.invites = requests[1].value?.invites ?? []
        }

        if (requests[2].status === 'fulfilled') {
          nextState.documents = requests[2].value?.documents ?? []
          nextState.totalDocuments =
            requests[2].value?.pagination?.total ?? nextState.documents.length
        }

        if (requests[3].status === 'fulfilled') {
          nextState.auditLogs = requests[3].value?.logs ?? []
        }
      }

      setDashboardState(nextState)
    } catch (requestError) {
      setDashboardError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [
    canManageMembers,
    canReadDocuments,
    canViewPlatformAudit,
    canViewPlatformDocuments,
    canViewPlatformOrganizations,
    canViewPlatformUsers,
    isSuperAdmin,
    organizationId,
    status,
  ])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Loading dashboard..." />
      </main>
    )
  }

  const activeOrganizations = dashboardState.organizations.filter(
    (organization) => String(organization.status).toUpperCase() === 'ACTIVE',
  ).length
  const suspendedOrganizations = dashboardState.organizations.filter(
    (organization) => String(organization.status).toUpperCase() === 'SUSPENDED',
  ).length
  const recentActiveDocuments = dashboardState.documents.filter(
    (document) => String(document.status).toUpperCase() === 'ACTIVE',
  ).length
  const pendingInvites = dashboardState.invites.filter(
    (invite) => String(invite.status).toUpperCase() === 'PENDING',
  ).length

  if (isSuperAdmin) {
    return (
      <main className="page page--wide dashboard-page">
        <header className="page-header">
          <div>
            <h1>Platform Dashboard</h1>
            <p>Overview of all organizations and platform activity.</p>
          </div>
          <RefreshIconButton
            disabled={isLoading}
            label="Refresh dashboard"
            onClick={() => void loadDashboard()}
          />
        </header>

        {dashboardError && (
          <Alert onDismiss={() => setDashboardError(null)}>
            {dashboardError.message}
          </Alert>
        )}

        {isLoading && <Loader label="Refreshing dashboard..." />}

        <section className="metric-grid dashboard-metric-grid">
          <StatCard
            icon="building"
            label="Total Organizations"
            value={dashboardState.totalOrganizations}
          />
          <StatCard
            icon="trend"
            label="Active Organizations"
            sub={`${suspendedOrganizations} suspended`}
            value={activeOrganizations}
          />
          <StatCard
            icon="users"
            label="Platform Users"
            value={dashboardState.totalUsers}
          />
          <StatCard
            icon="file"
            label="Documents Stored"
            sub={
              dashboardState.totalDocuments === null
                ? ''
                : `${recentActiveDocuments} recent active`
            }
            value={dashboardState.totalDocuments}
          />
        </section>

        <section className="card dashboard-quick-actions">
          <h2>Quick Actions</h2>
          <div className="inline-actions">
            <Link className="button button--primary button--link" to="/platform/organizations">
              <DashboardIcon name="plus" /> Organization
            </Link>
            {selectedOrganization && canReadDocuments && (
              <Link className="button button--secondary button--link" to="/documents">
                Upload
              </Link>
            )}
            {selectedOrganization && canReadDocuments && (
              <Link className="button button--secondary button--link" to="/documents/search">
                <DashboardIcon name="search" /> Ask
              </Link>
            )}
            <Link className="button button--secondary button--link" to="/audit-logs">
              Audit Logs
            </Link>
          </div>
        </section>

        <section className="dashboard-panel-grid">
          <DashboardPanel linkTo="/audit-logs" title="Recent Audit Activity">
            <AuditList logs={dashboardState.auditLogs} />
          </DashboardPanel>
          <DashboardPanel
            linkTo="/platform/documents"
            title="Recent Document Uploads"
          >
            <DocumentList documents={dashboardState.documents} />
          </DashboardPanel>
        </section>
      </main>
    )
  }

  if (!selectedOrganization) {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <h1>Welcome back, {displayName}</h1>
            <p>You do not have an organization assigned yet.</p>
          </div>
        </header>
        <section className="empty-state">
          <div>
            <span className="profile-avatar profile-avatar--xl">
              {getInitialsFromUser(user)}
            </span>
            <h2>No organization access</h2>
            <p>Ask an administrator to invite your account to an organization.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page page--wide dashboard-page">
      <header className="page-header">
        <div>
          <h1>{selectedOrganization.organization.name} Dashboard</h1>
          <p className="dashboard-page__subtitle">
            Your organization overview{currentRoleName ? ` · ${currentRoleName}` : ''}.
          </p>
          <p>
            Your organization overview{currentRoleName ? ` · ${currentRoleName}` : ''}.
          </p>
          <p hidden>
            Your organization overview
            {currentRoleName ? ` · ${currentRoleName}` : ''}.
          </p>
        </div>
        <RefreshIconButton
          disabled={isLoading}
          label="Refresh dashboard"
          onClick={() => void loadDashboard()}
        />
      </header>

      {dashboardError && (
        <Alert onDismiss={() => setDashboardError(null)}>
          {dashboardError.message}
        </Alert>
      )}

      {isLoading && <Loader label="Refreshing dashboard..." />}

      <section className="metric-grid dashboard-metric-grid">
        <StatCard
          icon="users"
          label="Members"
          value={canManageMembers ? dashboardState.members.length : null}
        />
        <StatCard
          icon="trend"
          label="Pending Invites"
          value={canManageMembers ? pendingInvites : null}
        />
        <StatCard
          icon="file"
          label="Documents"
          value={dashboardState.totalDocuments}
        />
        <StatCard
          icon="clock"
          label="Recent Events"
          sub="Latest audit records"
          value={canManageMembers ? dashboardState.auditLogs.length : null}
        />
      </section>

      <section className="card dashboard-quick-actions">
        <h2>Quick Actions</h2>
        <div className="inline-actions">
          {canManageMembers && (
            <Link
              className="button button--primary button--link"
              to="/organization/members"
            >
              <DashboardIcon name="plus" /> Invite
            </Link>
          )}
          {canReadDocuments && (
            <Link className="button button--secondary button--link" to="/documents">
              Upload
            </Link>
          )}
          {canReadDocuments && (
            <Link className="button button--secondary button--link" to="/documents/search">
              <DashboardIcon name="search" /> Ask
            </Link>
          )}
          <Link className="button button--secondary button--link" to="/account/sessions">
            Devices
          </Link>
        </div>
      </section>

      <section className="dashboard-panel-grid">
        <DashboardPanel
          linkTo={canReadDocuments ? '/documents' : ''}
          title="Recent Document Uploads"
        >
          <DocumentList documents={dashboardState.documents} />
        </DashboardPanel>
        <DashboardPanel
          linkTo={canManageMembers ? '/audit-logs' : ''}
          title="Recent Audit Activity"
        >
          <AuditList logs={dashboardState.auditLogs} />
        </DashboardPanel>
      </section>
    </main>
  )
}
