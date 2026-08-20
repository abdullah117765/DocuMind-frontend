import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { isSuperAdminAccess } from '../../../shared/utils/accessDisplay.js'
import { getFriendlyErrorMessage } from '../../../shared/utils/errorMessages.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { getAuditLogs } from '../services/auditApi.js'

function DownloadIcon({ size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatActionLabel(action = '') {
  const cleaned = String(action)
    .replace(/^(GET|POST|PATCH|PUT|DELETE)\s+\/api\/?/i, '')
    .replace(/[/:._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'Activity'

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function formatLogDetails(metadata) {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    Object.keys(metadata).length === 0
  ) {
    return 'No extra details for this event.'
  }

  const details = []

  if (metadata.reason) details.push(`Reason: ${metadata.reason}`)
  if (metadata.message) details.push(String(metadata.message))
  if (metadata.oldRole || metadata.newRole) {
    details.push(
      `Role changed from ${metadata.oldRole ?? 'previous role'} to ${
        metadata.newRole ?? 'new role'
      }.`,
    )
  }
  if (metadata.targetUser?.email || metadata.targetUserEmail) {
    details.push(`User: ${metadata.targetUser?.email ?? metadata.targetUserEmail}`)
  }

  return details.length
    ? details.join('\n')
    : 'Additional details are saved for this event.'
}

function getActor(log) {
  return log.actor ?? log.metadata?.actor ?? null
}

function buildAuditLogText(logs) {
  if (!logs.length) return 'No audit logs found for the current filters.'

  return logs
    .map((log, index) => {
      const actor = getActor(log)

      return [
        `#${index + 1}`,
        `When: ${formatDate(log.createdAt)}`,
        `Actor: ${actor?.name ?? actor?.email ?? 'System'}`,
        actor?.email ? `Email: ${actor.email}` : null,
        `Action: ${formatActionLabel(log.action)}`,
        `Area: ${log.organization?.name ?? log.resource ?? 'Platform'}`,
        `Status: ${log.statusCode < 400 ? 'Completed' : 'Needs review'}`,
        `Details: ${formatLogDetails(log.metadata)}`,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

const DEFAULT_PAGE_SIZE = 10
const LOG_DATE_RANGE_DAYS = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
}

function getDateRangeStart(range) {
  const days = LOG_DATE_RANGE_DAYS[range]

  if (!days) return ''

  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export function AuditLogs() {
  const { access, selectedOrganization, status } = useAccessControl()
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminAccess(user, access)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    action: '',
    dateRange: '',
    search: '',
    status: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState(null)
  const organizationId = isSuperAdmin
    ? ''
    : selectedOrganization?.organization.id ?? ''

  const updateFilters = useCallback((updater) => {
    setPage(1)
    setFilters((current) => ({ ...current, ...updater }))
  }, [])

  const loadLogs = useCallback(async () => {
    if (!isSuperAdmin && !organizationId) {
      setLogs([])
      setIsLoading(false)
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const data = await getAuditLogs({
        action: filters.action.trim(),
        from: getDateRangeStart(filters.dateRange),
        organizationId,
        outcome: filters.status,
        page,
        pageSize,
        search: filters.search.trim(),
      })

      if (
        data.pagination &&
        data.pagination.total > 0 &&
        data.pagination.page > data.pagination.pageCount
      ) {
        setPage(data.pagination.pageCount)
        return
      }

      setLogs(data.logs ?? [])
      setPagination(data.pagination ?? null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [
    filters.action,
    filters.dateRange,
    filters.search,
    filters.status,
    isSuperAdmin,
    organizationId,
    page,
    pageSize,
  ])

  function downloadLogs() {
    const blob = new Blob([buildAuditLogText(logs)], {
      type: 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadLogs()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadLogs])

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Checking audit log access..." />
      </main>
    )
  }

  return (
    <main className="page page--wide page--audit-logs">
      <header className="page-header">
        <div>
          <h1>Audit logs</h1>
          <p>
            {isSuperAdmin
              ? 'Review state-changing actions across the platform.'
              : `Review state-changing actions for ${selectedOrganization?.organization.name}.`}
          </p>
        </div>
        <div className="page-header__actions">
          <button
            aria-label="Download audit logs"
            className="icon-only-button"
            onClick={downloadLogs}
            title="Download audit logs"
            type="button"
          >
            <DownloadIcon />
          </button>
          <RefreshIconButton label="Refresh audit logs" onClick={() => void loadLogs()} />
        </div>
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
              aria-label="Search logs"
              className="table-toolbar__input"
              onChange={(event) =>
                updateFilters({ search: event.target.value })
              }
              placeholder="Search user, action, target..."
              type="search"
              value={filters.search}
            />
          </div>
          <div className="table-toolbar__filters">
            <input
              aria-label="Filter action"
              className="table-toolbar__input"
              onChange={(event) =>
                updateFilters({ action: event.target.value })
              }
              placeholder="Action (e.g. invite)"
              style={{ maxWidth: '9rem' }}
              type="search"
              value={filters.action}
            />
            <select
              aria-label="Filter outcome"
              className="table-toolbar__select"
              onChange={(event) =>
                updateFilters({ status: event.target.value })
              }
              value={filters.status}
            >
              <option value="">All outcomes</option>
              <option value="success">Success</option>
              <option value="warning">Needs review</option>
            </select>
            <select
              aria-label="Filter date range"
              className="table-toolbar__select"
              onChange={(event) =>
                updateFilters({
                  dateRange: event.target.value,
                })
              }
              value={filters.dateRange}
            >
              <option value="">Any time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
            </select>
            <span className="table-toolbar__counter">
              {pagination?.total ?? logs.length} records
            </span>
          </div>
        </div>

        {isLoading ? (
          <Loader label="Loading audit logs..." />
        ) : logs.length ? (
          <div className="data-table" role="table">
            <div className="data-table__row data-table__row--head" role="row">
              <span role="columnheader">When</span>
              <span role="columnheader">Actor</span>
              <span role="columnheader">Action</span>
              <span role="columnheader">Area</span>
              <span role="columnheader">Status</span>
            </div>
            {logs.map((log) => {
              const actor = getActor(log)

              return (
                <details className="data-table__details" key={log.id}>
                  <summary className="data-table__row" role="row">
                    <span role="cell">{formatDate(log.createdAt)}</span>
                    <span role="cell">
                      {actor ? (
                        <>
                          <strong>{actor.name ?? actor.email}</strong>
                          <small>{actor.email}</small>
                        </>
                      ) : (
                        <>
                          <strong>System</strong>
                          <small>Automated event</small>
                        </>
                      )}
                    </span>
                    <span role="cell">{formatActionLabel(log.action)}</span>
                    <span role="cell">{log.organization?.name ?? log.resource}</span>
                    <span role="cell">
                      <span
                        className={`status-badge ${
                          log.statusCode < 400
                            ? 'status-badge--success'
                            : 'status-badge--warning'
                        }`}
                      >
                        {log.statusCode < 400 ? 'Completed' : 'Needs review'}
                      </span>
                    </span>
                  </summary>
                  <pre className="metadata-block">{formatLogDetails(log.metadata)}</pre>
                </details>
              )
            })}
          </div>
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No audit logs found</h2>
              <p>Try changing the filters or performing an admin action.</p>
            </div>
          </section>
        )}

        <ListPagination
          label="Audit log pagination"
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
