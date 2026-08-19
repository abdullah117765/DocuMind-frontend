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
  getRagDocumentStatuses,
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
      {name === 'sparkle' && (
        <>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" {...commonProps} />
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

  if (['processed', 'active', 'success', 'accepted', 'indexed'].includes(normalized)) {
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

// --------------------------------------------------------------------------
// Analytics Computation Helpers
// --------------------------------------------------------------------------

function computeUploadActivity(documents = []) {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' })
    const dateKey = d.toISOString().slice(0, 10)
    days.push({ dayLabel, dateKey, count: 0 })
  }

  documents.forEach((doc) => {
    if (!doc?.createdAt) return
    const docDateKey = new Date(doc.createdAt).toISOString().slice(0, 10)
    const day = days.find((item) => item.dateKey === docDateKey)
    if (day) day.count += 1
  })

  const maxCount = Math.max(...days.map((d) => d.count), 1)

  return days.map((day) => ({
    ...day,
    percent: (day.count / maxCount) * 100,
    isPeak: day.count > 0 && day.count === maxCount,
  }))
}

function computeFormatBreakdown(documents = []) {
  const groups = {
    pdf: { label: 'PDF', count: 0, size: 0, className: 'doc-format-segment--pdf', dotColor: '#ef4444' },
    docx: { label: 'DOCX / Word', count: 0, size: 0, className: 'doc-format-segment--docx', dotColor: '#3b82f6' },
    xlsx: { label: 'XLSX / Sheets', count: 0, size: 0, className: 'doc-format-segment--xlsx', dotColor: '#10b981' },
    pptx: { label: 'PPTX / Slides', count: 0, size: 0, className: 'doc-format-segment--pptx', dotColor: '#f97316' },
    txt: { label: 'TXT / Code', count: 0, size: 0, className: 'doc-format-segment--txt', dotColor: '#8b5cf6' },
    other: { label: 'Other', count: 0, size: 0, className: 'doc-format-segment--other', dotColor: '#64748b' },
  }

  documents.forEach((doc) => {
    const ext = String(doc.extension ?? '').toLowerCase().replace('.', '')
    const size = Number(doc.sizeBytes) || 0

    if (ext === 'pdf') {
      groups.pdf.count += 1
      groups.pdf.size += size
    } else if (['docx', 'doc'].includes(ext)) {
      groups.docx.count += 1
      groups.docx.size += size
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      groups.xlsx.count += 1
      groups.xlsx.size += size
    } else if (['pptx', 'ppt'].includes(ext)) {
      groups.pptx.count += 1
      groups.pptx.size += size
    } else if (['txt', 'json', 'xml', 'html'].includes(ext)) {
      groups.txt.count += 1
      groups.txt.size += size
    } else {
      groups.other.count += 1
      groups.other.size += size
    }
  })

  const total = documents.length || 1

  return Object.values(groups)
    .filter((g) => g.count > 0)
    .map((g) => ({
      ...g,
      percent: Math.round((g.count / total) * 100),
    }))
}

function computeRagStats(documents = [], ragStatuses = []) {
  const statusMap = new Map(ragStatuses.map((s) => [s.documentId, s]))
  let indexed = 0
  let indexing = 0
  let pending = 0
  let failed = 0
  let totalChunks = 0

  documents.forEach((doc) => {
    const rStatus = statusMap.get(doc.id)
    const status = String(rStatus?.status ?? 'NOT_INDEXED').toUpperCase()
    totalChunks += Number(rStatus?.chunksCount) || 0

    if (status === 'INDEXED') {
      indexed += 1
    } else if (status === 'INDEXING') {
      indexing += 1
    } else if (status === 'PENDING') {
      pending += 1
    } else if (status === 'FAILED') {
      failed += 1
    } else {
      pending += 1
    }
  })

  const total = documents.length || 1
  const readinessPercent = Math.round((indexed / total) * 100)

  return {
    totalDocs: documents.length,
    indexed,
    indexing,
    pending,
    failed,
    totalChunks,
    readinessPercent,
  }
}

function computeTopChunkDocuments(documents = [], ragStatuses = []) {
  const statusMap = new Map(ragStatuses.map((s) => [s.documentId, s]))

  const ranked = documents
    .map((doc) => {
      const rStatus = statusMap.get(doc.id)
      return {
        id: doc.id,
        name: doc.name || doc.originalFilename || 'Document',
        chunksCount: Number(rStatus?.chunksCount) || 0,
        extension: (doc.extension || 'doc').toUpperCase(),
      }
    })
    .filter((doc) => doc.chunksCount > 0)
    .sort((a, b) => b.chunksCount - a.chunksCount)
    .slice(0, 5)

  const maxChunks = ranked[0]?.chunksCount || 1

  return ranked.map((doc) => ({
    ...doc,
    percent: Math.round((doc.chunksCount / maxChunks) * 100),
  }))
}

// --------------------------------------------------------------------------
// Sub-Components
// --------------------------------------------------------------------------

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

function UploadActivityGraph({ days = [] }) {
  const totalUploaded = days.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="dashboard-chart-card">
      <header className="dashboard-chart-header">
        <h3>Upload Activity (Last 7 Days)</h3>
        <span>{totalUploaded} uploaded this week</span>
      </header>
      <div className="doc-upload-chart">
        <div className="doc-upload-bars">
          {days.map((d) => (
            <div className="doc-upload-bar-group" key={d.dateKey}>
              {d.count > 0 && (
                <span className="doc-upload-count-tag">{d.count}</span>
              )}
              <div className="doc-upload-bar-track">
                <div
                  className={`doc-upload-bar-fill ${
                    d.isPeak ? 'doc-upload-bar-fill--peak' : ''
                  } ${d.count === 0 ? 'doc-upload-bar-fill--empty' : ''}`}
                  style={{ height: `${Math.max(d.percent, 4)}%` }}
                  title={`${d.dayLabel}: ${d.count} documents`}
                />
              </div>
              <span className="doc-upload-day-label">{d.dayLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FormatBreakdownChart({ formats = [] }) {
  return (
    <div className="dashboard-chart-card">
      <header className="dashboard-chart-header">
        <h3>Document Format Distribution</h3>
        <span>{formats.length} formats stored</span>
      </header>
      <div className="doc-format-summary">
        <div className="doc-format-segment-bar">
          {formats.map((f) => (
            <div
              className={`doc-format-segment ${f.className}`}
              key={f.label}
              style={{ width: `${f.percent}%` }}
              title={`${f.label}: ${f.count} documents (${f.percent}%)`}
            />
          ))}
        </div>
        <div className="doc-format-legend-grid">
          {formats.map((f) => (
            <div className="doc-format-legend-item" key={f.label}>
              <span
                className="doc-format-legend-dot"
                style={{ background: f.dotColor }}
              />
              <span>{f.label}</span>
              <strong>
                {f.count} ({f.percent}%)
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RagPipelineChart({ ragStats }) {
  const { failed, indexed, indexing, pending, readinessPercent, totalChunks } =
    ragStats

  return (
    <div className="dashboard-chart-card">
      <header className="dashboard-chart-header">
        <h3>AI File Readiness</h3>
        <span>{totalChunks.toLocaleString()} searchable sections</span>
      </header>
      <div className="doc-pipeline-card">
        <div className="doc-pipeline-progress-bar">
          <div
            className="doc-pipeline-segment doc-pipeline-segment--ready"
            style={{ width: `${readinessPercent}%` }}
            title={`Ready: ${indexed} docs (${readinessPercent}%)`}
          />
          <div
            className="doc-pipeline-segment doc-pipeline-segment--processing"
            style={{ width: `${Math.round((indexing / (ragStats.totalDocs || 1)) * 100)}%` }}
            title={`Preparing: ${indexing} docs`}
          />
          <div
            className="doc-pipeline-segment doc-pipeline-segment--pending"
            style={{ width: `${Math.round((pending / (ragStats.totalDocs || 1)) * 100)}%` }}
            title={`Pending: ${pending} docs`}
          />
          <div
            className="doc-pipeline-segment doc-pipeline-segment--failed"
            style={{ width: `${Math.round((failed / (ragStats.totalDocs || 1)) * 100)}%` }}
            title={`Failed: ${failed} docs`}
          />
        </div>
        <div className="doc-pipeline-stats-row">
          <div className="doc-pipeline-stat-box">
            <strong style={{ color: '#10b981' }}>{indexed}</strong>
            <small>Ready (AI)</small>
          </div>
          <div className="doc-pipeline-stat-box">
            <strong style={{ color: '#3b82f6' }}>{indexing}</strong>
            <small>Preparing</small>
          </div>
          <div className="doc-pipeline-stat-box">
            <strong style={{ color: '#f59e0b' }}>{pending}</strong>
            <small>Pending</small>
          </div>
          <div className="doc-pipeline-stat-box">
            <strong style={{ color: '#ef4444' }}>{failed}</strong>
            <small>Unprepared</small>
          </div>
        </div>
      </div>
    </div>
  )
}

function TopChunksChart({ topDocs = [] }) {
  if (!topDocs.length) {
    return (
      <div className="dashboard-chart-card">
        <header className="dashboard-chart-header">
          <h3>Top AI Knowledge Sources</h3>
          <span>Searchable content</span>
        </header>
        <p className="dashboard-empty-copy">
          No documents are ready for AI yet. Prepare files to see the most useful sources.
        </p>
      </div>
    )
  }

  return (
    <div className="dashboard-chart-card">
      <header className="dashboard-chart-header">
        <h3>Top AI Knowledge Sources</h3>
        <span>By searchable content</span>
      </header>
      <div className="doc-ranking-list">
        {topDocs.map((doc) => (
          <div className="doc-ranking-item" key={doc.id}>
            <div className="doc-ranking-item__info">
              <span className="doc-ranking-item__name" title={doc.name}>
                {doc.name}
              </span>
              <span className="doc-ranking-item__metric">
                {doc.chunksCount} sections
              </span>
            </div>
            <div className="doc-ranking-item__track">
              <div
                className="doc-ranking-item__fill"
                style={{ width: `${doc.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
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

// --------------------------------------------------------------------------
// Main Dashboard Component
// --------------------------------------------------------------------------

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
    ragStatuses: [],
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
      ragStatuses: [],
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
            ? listPlatformDocuments({ page: 1, pageSize: 100 })
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
            ? listOrganizationDocuments(organizationId, { page: 1, pageSize: 100 })
            : Promise.resolve({ documents: [], pagination: null }),
          canManageMembers
            ? getAuditLogs({ organizationId, page: 1, pageSize: 5 })
            : Promise.resolve({ logs: [], pagination: null }),
          canReadDocuments
            ? getRagDocumentStatuses(organizationId)
            : Promise.resolve([]),
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

        if (requests[4].status === 'fulfilled') {
          nextState.ragStatuses = requests[4].value ?? []
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

  // Analytics derivations
  const uploadActivity = useMemo(
    () => computeUploadActivity(dashboardState.documents),
    [dashboardState.documents],
  )
  const formatBreakdown = useMemo(
    () => computeFormatBreakdown(dashboardState.documents),
    [dashboardState.documents],
  )
  const ragStats = useMemo(
    () => computeRagStats(dashboardState.documents, dashboardState.ragStatuses),
    [dashboardState.documents, dashboardState.ragStatuses],
  )
  const topChunkDocs = useMemo(
    () =>
      computeTopChunkDocuments(
        dashboardState.documents,
        dashboardState.ragStatuses,
      ),
    [dashboardState.documents, dashboardState.ragStatuses],
  )

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
  const pendingInvites = dashboardState.invites.filter(
    (invite) => String(invite.status).toUpperCase() === 'PENDING',
  ).length

  if (isSuperAdmin) {
    return (
      <main className="page page--wide dashboard-page">
        <header className="page-header">
          <div>
            <h1>Platform Dashboard</h1>
            <p>Overview of all platform organizations, documents, and infrastructure.</p>
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
            label="Total Documents"
            sub={`${dashboardState.documents.length} across platform`}
            value={dashboardState.totalDocuments}
          />
        </section>

        {/* Document Analytics Charts */}
        <section className="dashboard-analytics-grid">
          <UploadActivityGraph days={uploadActivity} />
          <FormatBreakdownChart formats={formatBreakdown} />
        </section>

        <section className="card dashboard-quick-actions">
          <h2>Quick Actions</h2>
          <div className="inline-actions">
            <Link className="button button--primary button--link" to="/platform/organizations">
              <DashboardIcon name="plus" /> Organization
            </Link>
            <Link className="button button--secondary button--link" to="/platform/documents">
              Manage Documents
            </Link>
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
            Document Intelligence & Organization Overview
            {currentRoleName ? ` · Role: ${currentRoleName}` : ''}
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

      {/* Top Metric Cards */}
      <section className="metric-grid dashboard-metric-grid">
        <StatCard
          icon="file"
          label="Accessible Documents"
          sub={`${dashboardState.documents.length} files in scope`}
          value={dashboardState.totalDocuments}
        />
        <StatCard
          icon="sparkle"
          label="AI Readiness"
          sub={`${ragStats.readinessPercent}% ready for Ask AI`}
          value={`${ragStats.readinessPercent}%`}
        />
        <StatCard
          icon="trend"
          label="Searchable Content"
          sub="Prepared for Ask AI"
          value={ragStats.totalChunks}
        />
        <StatCard
          icon="users"
          label="Team Members"
          value={canManageMembers ? dashboardState.members.length : 1}
        />
      </section>

      {/* Primary Document Analytics Charts */}
      <section className="dashboard-analytics-grid">
        <UploadActivityGraph days={uploadActivity} />
        <FormatBreakdownChart formats={formatBreakdown} />
      </section>

      {/* Secondary AI & Vector Knowledge Analytics */}
      <section className="dashboard-analytics-grid">
        <RagPipelineChart ragStats={ragStats} />
        <TopChunksChart topDocs={topChunkDocs} />
      </section>

      {/* Quick Actions */}
      <section className="card dashboard-quick-actions">
        <h2>Quick Actions</h2>
        <div className="inline-actions">
          {canReadDocuments && (
            <Link className="button button--primary button--link" to="/documents">
              <DashboardIcon name="plus" /> Upload Document
            </Link>
          )}
          {canReadDocuments && (
            <Link className="button button--secondary button--link" to="/documents/search">
              <DashboardIcon name="search" /> Ask AI
            </Link>
          )}
          {canManageMembers && (
            <Link
              className="button button--secondary button--link"
              to="/organization/members"
            >
              <DashboardIcon name="users" /> Manage Members
            </Link>
          )}
          <Link className="button button--secondary button--link" to="/account/sessions">
            Active Devices
          </Link>
        </div>
      </section>

      {/* Activity & Document Rows */}
      <section className="dashboard-panel-grid">
        <DashboardPanel
          linkTo={canReadDocuments ? '/documents' : ''}
          title="Recent Documents"
        >
          <DocumentList documents={dashboardState.documents} />
        </DashboardPanel>
        <DashboardPanel
          linkTo={canManageMembers ? '/audit-logs' : ''}
          title="Recent Activity"
        >
          <AuditList logs={dashboardState.auditLogs} />
        </DashboardPanel>
      </section>
    </main>
  )
}

