import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import {
  askRagDocuments,
  getOrganizationDocumentContentUrl,
  getRagDocumentStatuses,
  listOrganizationDocuments,
  reindexRagDocuments,
  searchRagDocuments,
} from '../services/documentsApi.js'

const MAX_SELECTED_DOCUMENTS = 50
const SEARCH_TYPES = [
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Semantic', value: 'semantic' },
  { label: 'Keyword', value: 'keyword' },
]
const TOP_K_OPTIONS = [3, 5, 10, 15, 20]
const RAG_STATUS_LABELS = {
  FAILED: 'Failed',
  INDEXED: 'Ready',
  INDEXING: 'Indexing',
  NOT_INDEXED: 'Not indexed',
  NO_CONTENT: 'No text',
  PENDING: 'Queued',
}

function RagIcon({ name, size = 18 }) {
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
      {name === 'spark' && (
        <>
          <path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3Z" {...commonProps} />
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" {...commonProps} />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="7" {...commonProps} />
          <path d="m20 20-3.5-3.5" {...commonProps} />
        </>
      )}
      {name === 'file' && (
        <>
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" {...commonProps} />
          <path d="M14 2v5h5M9 13h6M9 17h4" {...commonProps} />
        </>
      )}
      {name === 'open' && (
        <>
          <path d="M14 4h6v6" {...commonProps} />
          <path d="m10 14 10-10" {...commonProps} />
          <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" {...commonProps} />
        </>
      )}
      {name === 'refresh' && (
        <>
          <path d="M3 12a9 9 0 0 1 15.2-6.5" {...commonProps} />
          <path d="M18 3v5h-5" {...commonProps} />
          <path d="M21 12a9 9 0 0 1-15.2 6.5" {...commonProps} />
          <path d="M6 21v-5h5" {...commonProps} />
        </>
      )}
    </svg>
  )
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value) {
  if (!value) return 'Not indexed yet'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getActorLabel(user) {
  if (!user) return 'Unknown user'

  return user.name || user.email || 'Unknown user'
}

function getStatusTone(status) {
  if (status === 'INDEXED') return 'success'
  if (status === 'FAILED') return 'danger'

  return 'warning'
}

function getRagStatusLabel(status) {
  return RAG_STATUS_LABELS[status] ?? String(status ?? 'Unknown')
}

function getScoreLabel(score) {
  if (!Number.isFinite(score)) return ''

  return `${Math.round(score * 100)}% match`
}

function getDocumentSearchText(document) {
  return [
    document.name,
    document.originalFilename,
    document.extension,
    document.createdBy?.name,
    document.createdBy?.email,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function normalizeAnswerMarkdown(text = '') {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/([.:])\s+\*\s+(?=\*\*|[A-Za-z0-9])/g, '$1\n\n- ')
    .replace(/\s+\*\s+(?=\*\*|[A-Za-z0-9])/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderInlineMarkdown(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      }

      return <span key={`${part}-${index}`}>{part}</span>
    })
}

function AnswerMarkdown({ text }) {
  const blocks = normalizeAnswerMarkdown(text).split(/\n\s*\n/)

  return (
    <div className="rag-answer-markdown">
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        const isList = lines.every((line) => /^[-*]\s+/.test(line))

        if (isList) {
          return (
            <ul key={`${blockIndex}-${block.slice(0, 24)}`}>
              {lines.map((line, lineIndex) => (
                <li key={`${blockIndex}-${lineIndex}`}>
                  {renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={`${blockIndex}-${block.slice(0, 24)}`}>
            {renderInlineMarkdown(lines.join(' '))}
          </p>
        )
      })}
    </div>
  )
}

function ResultCard({ organizationId, result }) {
  return (
    <article className="rag-result-card">
      <div className="rag-result-card__header">
        <span className="file-icon" aria-hidden="true">
          {(result.file_type ?? '').slice(0, 3).toUpperCase() || 'DOC'}
        </span>
        <div>
          <strong>{result.document_name}</strong>
          <small>
            Chunk {result.chunk_index + 1} · Version {result.version_number}
          </small>
        </div>
        <span className="status-badge">{getScoreLabel(result.score)}</span>
      </div>
      <p>{result.text}</p>
      <a
        className="rag-source-link"
        href={getOrganizationDocumentContentUrl(organizationId, result.document_id)}
        rel="noreferrer"
        target="_blank"
      >
        <RagIcon name="open" size={14} /> Open source file
      </a>
    </article>
  )
}

function buildRagPayload({ query, scope, searchType, selectedDocumentIds, topK }) {
  return {
    documentIds: scope === 'selected' ? selectedDocumentIds : undefined,
    query,
    scope,
    searchType,
    topK: Number(topK),
  }
}

export function DocumentRag() {
  const {
    hasPermission,
    selectedOrganization,
    status,
  } = useAccessControl()
  const notifications = useNotifications()
  const organizationId = selectedOrganization?.organization.id ?? ''
  const organizationName = selectedOrganization?.organization.name ?? 'this organization'
  const canReadDocuments = hasPermission('documents.read')
  const canAskDocuments = hasPermission('ai.access')
  const canReindexDocuments = hasPermission('members.manage')

  const [documents, setDocuments] = useState([])
  const [documentStatuses, setDocumentStatuses] = useState([])
  const [documentFilter, setDocumentFilter] = useState('')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReindexing, setIsReindexing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [resultMode, setResultMode] = useState(null)
  const [scope, setScope] = useState('selected')
  const [searchResponse, setSearchResponse] = useState(null)
  const [searchType, setSearchType] = useState('hybrid')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [topK, setTopK] = useState(5)

  const statusByDocumentId = useMemo(
    () =>
      new Map(
        documentStatuses.map((item) => [
          item.documentId,
          item,
        ]),
      ),
    [documentStatuses],
  )

  const visibleDocuments = useMemo(() => {
    const needle = documentFilter.trim().toLowerCase()

    if (!needle) return documents

    return documents.filter((document) =>
      getDocumentSearchText(document).includes(needle),
    )
  }, [documentFilter, documents])

  const selectedCount = selectedDocumentIds.length
  const isSelectionRequired = scope === 'selected'
  const hasSelectedTooMany = selectedCount > MAX_SELECTED_DOCUMENTS
  const canSubmit =
    query.trim().length > 0 &&
    (!isSelectionRequired || selectedCount > 0) &&
    !hasSelectedTooMany &&
    !isSearching

  const loadRagData = useCallback(async () => {
    if (!organizationId || !canReadDocuments) return

    setIsLoading(true)
    setError(null)

    try {
      const [documentList, statuses] = await Promise.all([
        listOrganizationDocuments(organizationId, {
          page: 1,
          pageSize: 100,
          view: 'active',
        }),
        getRagDocumentStatuses(organizationId),
      ])

      setDocuments(documentList.documents ?? [])
      setDocumentStatuses(statuses ?? [])
      setSelectedDocumentIds((current) => {
        const availableIds = new Set(
          (documentList.documents ?? []).map((document) => document.id),
        )

        return current.filter((documentId) => availableIds.has(documentId))
      })
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }, [canReadDocuments, notifications, organizationId])

  useEffect(() => {
    if (status === 'ready') {
      void loadRagData()
    }
  }, [loadRagData, status])

  function toggleDocument(documentId) {
    setSelectedDocumentIds((current) => {
      if (current.includes(documentId)) {
        return current.filter((selectedId) => selectedId !== documentId)
      }

      if (current.length >= MAX_SELECTED_DOCUMENTS) {
        notifications.info(`You can select up to ${MAX_SELECTED_DOCUMENTS} files.`)
        return current
      }

      return [...current, documentId]
    })
  }

  function selectVisibleDocuments() {
    const nextIds = visibleDocuments
      .map((document) => document.id)
      .slice(0, MAX_SELECTED_DOCUMENTS)

    setSelectedDocumentIds(nextIds)

    if (visibleDocuments.length > MAX_SELECTED_DOCUMENTS) {
      notifications.info(`Selected the first ${MAX_SELECTED_DOCUMENTS} visible files.`)
    }
  }

  async function runRagRequest(mode) {
    if (!canSubmit) return

    setIsSearching(true)
    setError(null)
    setResultMode(mode)

    try {
      const payload = buildRagPayload({
        query: query.trim(),
        scope,
        searchType,
        selectedDocumentIds,
        topK,
      })
      const response =
        mode === 'ask'
          ? await askRagDocuments(organizationId, payload)
          : await searchRagDocuments(organizationId, payload)

      setSearchResponse(response)
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSearching(false)
    }
  }

  async function handleReindex() {
    const targetIds = scope === 'selected' ? selectedDocumentIds : []

    if (scope === 'selected' && targetIds.length === 0) {
      notifications.error('Select at least one file before reindexing.')
      return
    }

    setIsReindexing(true)
    setError(null)

    try {
      const statuses = await reindexRagDocuments(organizationId, {
        documentIds: targetIds.length ? targetIds : undefined,
      })

      setDocumentStatuses(statuses ?? [])
      notifications.success('Document index was refreshed.')
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsReindexing(false)
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Checking document AI access..." />
      </main>
    )
  }

  if (!canReadDocuments) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Role required</p>
            <h1>Ask documents is restricted</h1>
            <p>Your current role cannot search organization documents.</p>
          </div>
        </section>
      </main>
    )
  }

  if (!organizationId) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Organization required</p>
            <h1>Select an organization</h1>
            <p>Ask AI works inside one organization at a time.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page page--wide page--rag">
      <header className="page-header">
        <div>
          <p className="eyebrow">Document intelligence</p>
          <h1>Ask documents</h1>
          <p>
            Search or ask questions from files you can already access in{' '}
            {organizationName}. Choose selected files for tighter, safer answers.
          </p>
        </div>
        <RefreshIconButton
          disabled={isLoading}
          label="Refresh document index"
          onClick={() => void loadRagData()}
        />
      </header>

      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}
      {!canAskDocuments && (
        <Alert tone="info">
          Search is available. Ask AI requires the ai.access permission for this
          organization.
        </Alert>
      )}

      <section className="card rag-query-card">
        <div className="rag-query-card__intro">
          <span aria-hidden="true" className="file-icon file-icon--large">
            <RagIcon name="spark" size={22} />
          </span>
          <div>
            <span className="card__label">Question scope</span>
            <h2>Ask from controlled document access</h2>
            <p>
              The backend filters every answer by organization, role, and
              document access before anything reaches the vector search service.
            </p>
          </div>
        </div>

        <label className="field" htmlFor="rag-question">
          <span className="field__label">Question</span>
          <textarea
            id="rag-question"
            maxLength={4000}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Example: What does the onboarding policy say about required documents?"
            rows={4}
            value={query}
          />
          <span className="field__hint">{query.trim().length}/4000 characters</span>
        </label>

        <div className="rag-controls">
          <label className="field">
            <span className="field__label">Files to search</span>
            <select
              onChange={(event) => setScope(event.target.value)}
              value={scope}
            >
              <option value="selected">Selected files only</option>
              <option value="all">All readable files</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Search type</span>
            <select
              onChange={(event) => setSearchType(event.target.value)}
              value={searchType}
            >
              {SEARCH_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Results</span>
            <select
              onChange={(event) => setTopK(Number(event.target.value))}
              value={topK}
            >
              {TOP_K_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  Top {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <details className="rag-file-picker" open={scope === 'selected'}>
          <summary>
            <span>
              <RagIcon name="file" size={16} /> Selected files
            </span>
            <strong>
              {selectedCount}/{MAX_SELECTED_DOCUMENTS}
            </strong>
          </summary>

          <div className="rag-file-picker__body">
            <div className="rag-file-picker__toolbar">
              <Input
                label="Filter files"
                onChange={(event) => setDocumentFilter(event.target.value)}
                placeholder="name, type, uploader..."
                value={documentFilter}
              />
              <div className="inline-actions">
                <Button
                  disabled={isLoading || visibleDocuments.length === 0}
                  onClick={selectVisibleDocuments}
                  variant="secondary"
                >
                  Select visible
                </Button>
                <Button
                  disabled={selectedCount === 0}
                  onClick={() => setSelectedDocumentIds([])}
                  variant="secondary"
                >
                  Clear
                </Button>
              </div>
            </div>

            {isLoading ? (
              <Loader label="Loading files..." />
            ) : visibleDocuments.length ? (
              <div className="rag-document-list">
                {visibleDocuments.map((document) => {
                  const selected = selectedDocumentIds.includes(document.id)
                  const indexStatus = statusByDocumentId.get(document.id)
                  const ragStatus = indexStatus?.status ?? 'NOT_INDEXED'
                  const disabled =
                    !selected && selectedCount >= MAX_SELECTED_DOCUMENTS

                  return (
                    <label className="rag-document-option" key={document.id}>
                      <input
                        checked={selected}
                        disabled={disabled}
                        onChange={() => toggleDocument(document.id)}
                        type="checkbox"
                      />
                      <span className="file-icon" aria-hidden="true">
                        {document.extension?.slice(0, 3).toUpperCase() || 'DOC'}
                      </span>
                      <span className="rag-document-option__main">
                        <strong>{document.name}</strong>
                        <small>
                          {document.originalFilename} · {formatBytes(document.sizeBytes)} ·{' '}
                          {getActorLabel(document.createdBy)}
                          {indexStatus?.updatedAt
                            ? ` · indexed ${formatDate(indexStatus.updatedAt)}`
                            : ''}
                        </small>
                      </span>
                      <span
                        className={`status-badge status-badge--${getStatusTone(
                          ragStatus,
                        )}`}
                      >
                        {getRagStatusLabel(ragStatus)}
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <section className="empty-state empty-state--compact">
                <div>
                  <h2>No readable files found</h2>
                  <p>Upload documents first, then refresh this page.</p>
                </div>
              </section>
            )}
          </div>
        </details>

        {isSelectionRequired && selectedCount === 0 && (
          <p className="field__hint">
            Select one or more files before asking from selected scope.
          </p>
        )}

        <div className="form-actions rag-actions">
          <Button
            disabled={!canSubmit || !canAskDocuments}
            onClick={() => void runRagRequest('ask')}
          >
            <RagIcon name="spark" size={15} />
            {isSearching && resultMode === 'ask' ? 'Asking...' : 'Ask AI'}
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => void runRagRequest('search')}
            variant="secondary"
          >
            <RagIcon name="search" size={15} />
            {isSearching && resultMode === 'search' ? 'Searching...' : 'Search only'}
          </Button>
          {canReindexDocuments && (
            <Button
              disabled={isReindexing || isLoading}
              onClick={() => void handleReindex()}
              variant="secondary"
            >
              <RagIcon name="refresh" size={15} />
              {isReindexing ? 'Reindexing...' : 'Reindex files'}
            </Button>
          )}
        </div>
      </section>

      {searchResponse && (
        <section className="rag-results">
          {'answer' in searchResponse && (
            <article className="card rag-answer-card">
              <div className="section-heading">
                <div>
                  <span className="card__label">
                    {searchResponse.llm_available ? 'AI answer' : 'Search fallback'}
                  </span>
                  <h2>Answer from selected evidence</h2>
                </div>
                {searchResponse.llm_model && (
                  <span className="status-badge">{searchResponse.llm_model}</span>
                )}
              </div>
              <AnswerMarkdown text={searchResponse.answer} />
              {searchResponse.sources?.length > 0 && (
                <div className="rag-source-list">
                  {searchResponse.sources.map((source) => (
                    <a
                      className="rag-source-pill"
                      href={getOrganizationDocumentContentUrl(
                        organizationId,
                        source.document_id,
                      )}
                      key={`${source.document_id}-${source.chunk_index}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.document_name} · chunk {source.chunk_index + 1}
                    </a>
                  ))}
                </div>
              )}
            </article>
          )}

          <section className="card">
            <div className="section-heading">
              <div>
                <span className="card__label">Evidence</span>
                <h2>
                  {searchResponse.total_results ??
                    searchResponse.search_results?.length ??
                    searchResponse.results?.length ??
                    0}{' '}
                  matching chunks
                </h2>
              </div>
              <span className="status-badge">
                {searchResponse.processing_time_ms} ms
              </span>
            </div>

            {(searchResponse.search_results ?? searchResponse.results ?? []).length ? (
              <div className="rag-result-list">
                {(searchResponse.search_results ?? searchResponse.results ?? []).map(
                  (result) => (
                    <ResultCard
                      key={`${result.document_id}-${result.version_number}-${result.chunk_index}`}
                      organizationId={organizationId}
                      result={result}
                    />
                  ),
                )}
              </div>
            ) : (
              <section className="empty-state empty-state--compact">
                <div>
                  <h2>No matching text found</h2>
                  <p>
                    Try selecting more files, changing search type, or reindexing
                    documents that are not ready yet.
                  </p>
                </div>
              </section>
            )}
          </section>
        </section>
      )}
    </main>
  )
}
