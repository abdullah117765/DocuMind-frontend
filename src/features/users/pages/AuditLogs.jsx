import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { getAuditLogs } from '../services/auditApi.js'

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatMetadata(metadata) {
  if (!metadata) return 'No metadata'

  return JSON.stringify(metadata, null, 2)
}

export function AuditLogs() {
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ search: '', action: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState(null)

  const loadLogs = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      const data = await getAuditLogs({
        page: 1,
        pageSize: 50,
        search: filters.search.trim(),
        action: filters.action.trim(),
      })

      setLogs(data.logs ?? [])
      setPagination(data.pagination ?? null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [filters.action, filters.search])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadLogs()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadLogs])

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Platform security</p>
          <h1>Audit logs</h1>
          <p>
            Review state-changing actions across the platform. Sensitive request
            fields are redacted before storage.
          </p>
        </div>
        <Button onClick={() => void loadLogs()} variant="secondary">
          Refresh
        </Button>
      </header>

      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}

      <section className="card filter-bar">
        <Input
          label="Search logs"
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder="user email, organization, action..."
          value={filters.search}
        />
        <Input
          label="Action"
          onChange={(event) =>
            setFilters((current) => ({ ...current, action: event.target.value }))
          }
          placeholder="POST /api/users"
          value={filters.action}
        />
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <span className="card__label">Recent events</span>
            <h2>{pagination?.total ?? logs.length} records</h2>
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
              <span role="columnheader">Resource</span>
              <span role="columnheader">Status</span>
            </div>
            {logs.map((log) => (
              <details className="data-table__details" key={log.id}>
                <summary className="data-table__row" role="row">
                  <span role="cell">{formatDate(log.createdAt)}</span>
                  <span role="cell">{log.actor?.email ?? 'System'}</span>
                  <code role="cell">{log.action}</code>
                  <span role="cell">{log.organization?.name ?? log.resource}</span>
                  <span role="cell">
                    <span
                      className={`status-badge ${
                        log.statusCode < 400
                          ? 'status-badge--success'
                          : 'status-badge--warning'
                      }`}
                    >
                      {log.statusCode}
                    </span>
                  </span>
                </summary>
                <pre className="metadata-block">{formatMetadata(log.metadata)}</pre>
              </details>
            ))}
          </div>
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No audit logs found</h2>
              <p>Try changing the filters or performing an admin action.</p>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
