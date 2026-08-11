import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
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
const DEFAULT_DOCUMENT_PAGE_SIZE = 10
const RAG_STATUS_LABELS = {
  FAILED: 'Needs attention',
  INDEXED: 'Ready',
  INDEXING: 'Preparing',
  NOT_INDEXED: 'Needs preparation',
  NO_CONTENT: 'No readable text',
  PENDING: 'Waiting',
}
const RAG_WORKING_STATUSES = new Set(['PENDING', 'INDEXING'])
const RAG_READY_STATUSES = new Set(['INDEXED'])

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
  if (!value) return 'Not ready yet'

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

function isRagStatusWorking(status) {
  return RAG_WORKING_STATUSES.has(status)
}

function isRagStatusReady(status) {
  return RAG_READY_STATUSES.has(status)
}

function getRagProgress(statusView) {
  const progress = Number(statusView?.progress)

  if (Number.isFinite(progress)) {
    return Math.min(Math.max(progress, 0), 100)
  }

  if (statusView?.status === 'INDEXED') return 100
  if (statusView?.status === 'NO_CONTENT') return 100
  if (statusView?.status === 'FAILED') return 100
  if (statusView?.status === 'INDEXING') return 55
  if (statusView?.status === 'PENDING') return 15

  return 0
}

function getScoreLabel(score) {
  const numericScore = Number(score)

  if (!Number.isFinite(numericScore)) return ''

  return `${Math.round(numericScore * 100)}% match`
}

function formatProcessingTime(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return 'Completed'
  if (numericValue < 1000) return 'Completed just now'

  return `${(numericValue / 1000).toFixed(1)} s`
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

function getSourceDocuments(response) {
  const rawSources = [
    ...(response?.sources ?? []),
    ...(response?.search_results ?? []),
    ...(response?.results ?? []),
  ]
  const byDocument = new Map()

  for (const source of rawSources) {
    if (!source?.document_id) continue

    const existing = byDocument.get(source.document_id)
    const nextScore = Number(source.score)
    const existingScore = Number(existing?.score)

    if (
      !existing ||
      (Number.isFinite(nextScore) ? nextScore : 0) >
        (Number.isFinite(existingScore) ? existingScore : 0)
    ) {
      byDocument.set(source.document_id, source)
    }
  }

  return [...byDocument.values()].sort(
    (left, right) =>
      (Number.isFinite(Number(right.score)) ? Number(right.score) : 0) -
      (Number.isFinite(Number(left.score)) ? Number(left.score) : 0),
  )
}

function SourceDocumentCard({ organizationId, result }) {
  const documentName =
    result.document_name || result.original_filename || 'Document'
  const fileType =
    result.file_type || result.fileType || result.extension || 'DOC'
  const pageLabel =
    result.page_number || result.pageNumber
      ? `Page ${result.page_number ?? result.pageNumber}`
      : null
  const detail = [
    result.original_filename,
    pageLabel,
    result.version_number ? `Version ${result.version_number}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="rag-source-card">
      <div className="rag-result-card__header">
        <span className="file-icon" aria-hidden="true">
          {fileType.slice(0, 3).toUpperCase()}
        </span>
        <div>
          <strong title={documentName}>{documentName}</strong>
          <small>
            {detail || 'Used for this answer'}
          </small>
        </div>
        {Number.isFinite(Number(result.score)) && (
          <span className="status-badge">{getScoreLabel(result.score)}</span>
        )}
      </div>
      <a
        className="rag-source-link"
        href={getOrganizationDocumentContentUrl(organizationId, result.document_id)}
        rel="noreferrer"
        target="_blank"
      >
        <RagIcon name="open" size={14} /> Open file
      </a>
    </article>
  )
}

function buildRagPayload({ query, scope, selectedDocumentIds }) {
  return {
    documentIds: scope === 'selected' ? selectedDocumentIds : undefined,
    query,
    scope,
  }
}

function mergeDocumentStatuses(currentStatuses, updatedStatuses) {
  const byDocumentId = new Map(
    currentStatuses.map((statusView) => [statusView.documentId, statusView]),
  )

  for (const statusView of updatedStatuses) {
    if (!statusView?.documentId) continue
    byDocumentId.set(statusView.documentId, statusView)
  }

  return [...byDocumentId.values()]
}

function RagStatusIndicator({ statusView }) {
  const status = statusView?.status ?? 'NOT_INDEXED'
  const progress = getRagProgress(statusView)
  const isWorking = isRagStatusWorking(status)
  const message = getFriendlyRagStatusMessage(status)

  return (
    <span className="rag-index-status" title={message}>
      <span
        className={`status-badge status-badge--${getStatusTone(status)}`}
      >
        {getRagStatusLabel(status)}
      </span>
      <span
        aria-label={`${getRagStatusLabel(status)} ${progress}%`}
        className={`rag-index-progress ${
          isWorking ? 'rag-index-progress--active' : ''
        }`}
        role="progressbar"
      >
        <span style={{ width: `${progress}%` }} />
      </span>
      <small>{message}</small>
    </span>
  )
}

function getFriendlyRagStatusMessage(status) {
  if (status === 'INDEXED') return 'Ready for questions.'
  if (status === 'INDEXING') return 'Preparing this file for questions.'
  if (status === 'PENDING') return 'Waiting to prepare this file.'
  if (status === 'NO_CONTENT') return 'No readable text was found.'
  if (status === 'FAILED') return 'We could not prepare this file. Try again.'

  return 'Prepare this file before asking AI.'
}

function getDocumentAiErrorMessage(error, fallback) {
  const message = String(error?.message ?? '')
  const lowerMessage = message.toLowerCase()
  const technicalMarkers = [
    'backend',
    'chunk',
    'document ai service',
    'embedding',
    'fastapi',
    'hmac',
    'index',
    'ocr',
    'pymupdf',
    'qdrant',
    'rag',
    'serviceunavailable',
    'tesseract',
    'vector',
  ]

  if (lowerMessage.includes('image text extraction failed')) {
    return 'We could not read text from this image. Try a clearer image or upload a text-based document.'
  }

  if (!message || technicalMarkers.some((marker) => lowerMessage.includes(marker))) {
    return fallback
  }

  return message
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
  const [documentPage, setDocumentPage] = useState(1)
  const [documentPageSize, setDocumentPageSize] = useState(
    DEFAULT_DOCUMENT_PAGE_SIZE,
  )
  const [documentPagination, setDocumentPagination] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReindexing, setIsReindexing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [resultMode, setResultMode] = useState(null)
  const [scope, setScope] = useState('selected')
  const [searchResponse, setSearchResponse] = useState(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])

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

  const selectedCount = selectedDocumentIds.length
  const isSelectionRequired = scope === 'selected'
  const hasSelectedTooMany = selectedCount > MAX_SELECTED_DOCUMENTS
  const sourceDocuments = useMemo(
    () => getSourceDocuments(searchResponse),
    [searchResponse],
  )
  const selectedStatusViews = useMemo(
    () =>
      selectedDocumentIds.map(
        (documentId) =>
          statusByDocumentId.get(documentId) ?? {
            documentId,
            status: 'NOT_INDEXED',
          },
      ),
    [selectedDocumentIds, statusByDocumentId],
  )
  const activeIndexingCount = useMemo(
    () =>
      documentStatuses.filter((statusView) =>
        isRagStatusWorking(statusView.status),
      ).length,
    [documentStatuses],
  )
  const readyDocumentCount = useMemo(
    () =>
      documentStatuses.filter((statusView) =>
        isRagStatusReady(statusView.status),
      ).length,
    [documentStatuses],
  )
  const selectedNotReadyCount = selectedStatusViews.filter(
    (statusView) => !isRagStatusReady(statusView.status),
  ).length
  const askAiProcessing = isSearching && resultMode === 'ask'

  const loadRagData = useCallback(async () => {
    if (!organizationId || !canReadDocuments) return

    setIsLoading(true)
    setError(null)

    try {
      const [documentList, statuses] = await Promise.all([
        listOrganizationDocuments(organizationId, {
          page: documentPage,
          pageSize: documentPageSize,
          search: documentFilter.trim(),
          view: 'active',
        }),
        getRagDocumentStatuses(organizationId),
      ])

      if (
        documentList.pagination &&
        documentList.pagination.total > 0 &&
        documentList.pagination.page > documentList.pagination.pageCount
      ) {
        setDocumentPage(documentList.pagination.pageCount)
        return
      }

      setDocuments(documentList.documents ?? [])
      setDocumentPagination(documentList.pagination ?? null)
      setDocumentStatuses(statuses ?? [])
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentAiErrorMessage(
          requestError,
          'We could not load your files. Refresh the page and try again.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }, [
    canReadDocuments,
    documentFilter,
    documentPage,
    documentPageSize,
    notifications,
    organizationId,
  ])

  const refreshRagStatuses = useCallback(async () => {
    if (!organizationId || !canReadDocuments) return

    try {
      const statuses = await getRagDocumentStatuses(organizationId)
      setDocumentStatuses(statuses ?? [])
    } catch {
      // Keep polling quiet; the main refresh path still reports visible errors.
    }
  }, [canReadDocuments, organizationId])

  useEffect(() => {
    if (status === 'ready') {
      const handle = window.setTimeout(() => {
        void loadRagData()
      }, 250)

      return () => window.clearTimeout(handle)
    }
  }, [loadRagData, status])

  useEffect(() => {
    if (
      status !== 'ready' ||
      !organizationId ||
      !canReadDocuments ||
      activeIndexingCount === 0
    ) {
      return undefined
    }

    const handle = window.setInterval(() => {
      void refreshRagStatuses()
    }, 3500)

    return () => window.clearInterval(handle)
  }, [
    activeIndexingCount,
    canReadDocuments,
    organizationId,
    refreshRagStatuses,
    status,
  ])

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
    const nextIds = documents
      .map((document) => document.id)
      .slice(0, MAX_SELECTED_DOCUMENTS)

    setSelectedDocumentIds(nextIds)

    if (documents.length > MAX_SELECTED_DOCUMENTS) {
      notifications.info(`Selected the first ${MAX_SELECTED_DOCUMENTS} shown files.`)
    }
  }

  function validateRagRequest(mode) {
    if (!query.trim()) {
      notifications.info('Enter a question first.')
      return false
    }

    if (scope === 'selected' && selectedCount === 0) {
      notifications.info(
        mode === 'ask'
          ? 'Select at least one file before asking AI.'
          : 'Select at least one file before finding matches.',
      )
      return false
    }

    if (hasSelectedTooMany) {
      notifications.info(`You can select up to ${MAX_SELECTED_DOCUMENTS} files.`)
      return false
    }

    return true
  }

  async function runRagRequest(mode) {
    if (isSearching) {
      notifications.info('AI is already working. Please wait for the current request to finish.')
      return
    }

    if (!validateRagRequest(mode)) return

    if (scope === 'selected' && selectedNotReadyCount > 0) {
      const workingCount = selectedStatusViews.filter((statusView) =>
        isRagStatusWorking(statusView.status),
      ).length

      notifications.info(
        workingCount > 0
          ? `${workingCount} selected file(s) are still being prepared. Ask AI will be available when they are ready.`
          : 'Some selected files need to be prepared before Ask AI can use them.',
      )
      return
    }

    if (scope === 'all' && readyDocumentCount === 0) {
      notifications.info('No files are ready for Ask AI yet. Prepare files first.')
      return
    }

    if (scope === 'all' && activeIndexingCount > 0) {
      notifications.info('Some files are still being prepared. The answer will use files that are ready.')
    }

    setIsSearching(true)
    setError(null)
    setResultMode(mode)

    try {
      const payload = buildRagPayload({
        query: query.trim(),
        scope,
        selectedDocumentIds,
      })
      const response =
        mode === 'ask'
          ? await askRagDocuments(organizationId, payload)
          : await searchRagDocuments(organizationId, payload)

      setSearchResponse(response)
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentAiErrorMessage(
          requestError,
          mode === 'ask'
            ? 'AI could not answer right now. Please try again in a moment.'
            : 'We could not find matching files right now. Please try again.',
        ),
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function handleReindex() {
    if (isReindexing) {
      notifications.info('File preparation is already running. Watch the file status for progress.')
      return
    }

    const targetIds = scope === 'selected' ? selectedDocumentIds : []

    if (scope === 'selected' && targetIds.length === 0) {
      notifications.error('Select at least one file before preparing it for AI.')
      return
    }

    setIsReindexing(true)
    setError(null)

    try {
      const statuses = await reindexRagDocuments(organizationId, {
        documentIds: targetIds.length ? targetIds : undefined,
      })

      setDocumentStatuses((currentStatuses) =>
        mergeDocumentStatuses(currentStatuses, statuses ?? []),
      )
      const workingCount = (statuses ?? []).filter((statusView) =>
        isRagStatusWorking(statusView.status),
      ).length

      notifications.success(
        workingCount > 0
          ? `Preparing ${workingCount} file(s). Status will update automatically.`
          : 'Selected file(s) are already ready.',
      )
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentAiErrorMessage(
          requestError,
          'We could not prepare the selected files. Please try again.',
        ),
      )
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
          label="Refresh files"
          onClick={() => void loadRagData()}
        />
      </header>

      {error && (
        <Alert onDismiss={() => setError(null)}>
          {getDocumentAiErrorMessage(
            error,
            'Something went wrong. Please try again.',
          )}
        </Alert>
      )}
      {!canAskDocuments && (
        <Alert tone="info">
          You can find matching files, but your current role cannot ask AI in
          this organization.
        </Alert>
      )}

      <section className="card rag-query-card">
        <div className="rag-query-card__intro">
          <span aria-hidden="true" className="file-icon file-icon--large">
            <RagIcon name="spark" size={22} />
          </span>
          <div>
            <span className="card__label">Answer settings</span>
            <h2>Ask from files you can access</h2>
            <p>
              Answers only use files available to your current organization and
              role.
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
                onChange={(event) => {
                  setDocumentFilter(event.target.value)
                  setDocumentPage(1)
                }}
                placeholder="name, type, uploader..."
                value={documentFilter}
              />
              <div className="inline-actions">
                <Button
                  disabled={isLoading || documents.length === 0}
                  onClick={selectVisibleDocuments}
                  variant="secondary"
                >
                  Select shown
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

            {(activeIndexingCount > 0 || readyDocumentCount > 0) && (
              <div className="rag-index-summary">
                <span>
                  <strong>{readyDocumentCount}</strong> ready
                </span>
                {activeIndexingCount > 0 && (
                  <span>
                    <strong>{activeIndexingCount}</strong> preparing
                  </span>
                )}
                {selectedNotReadyCount > 0 && scope === 'selected' && (
                  <span>
                    <strong>{selectedNotReadyCount}</strong> selected not ready
                  </span>
                )}
              </div>
            )}

            {isLoading ? (
              <Loader label="Loading files..." />
            ) : documents.length ? (
              <div className="rag-document-list">
                {documents.map((document) => {
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
                            ? ` · ready ${formatDate(indexStatus.updatedAt)}`
                            : ''}
                        </small>
                      </span>
                      <RagStatusIndicator
                        statusView={indexStatus ?? { status: ragStatus }}
                      />
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

            <ListPagination
              label="Ask Documents file pagination"
              onPageChange={setDocumentPage}
              onPageSizeChange={(nextPageSize) => {
                setDocumentPageSize(nextPageSize)
                setDocumentPage(1)
              }}
              pageSize={documentPageSize}
              pagination={documentPagination}
            />
          </div>
        </details>

        {isSelectionRequired && selectedCount === 0 && (
          <p className="field__hint">
            Select one or more files before asking AI.
          </p>
        )}

        <div className="form-actions rag-actions">
          <Button
            disabled={isSearching || !canAskDocuments}
            onClick={() => void runRagRequest('ask')}
          >
            <RagIcon name="spark" size={15} />
            {askAiProcessing ? 'AI is working...' : 'Ask AI'}
          </Button>
          {!askAiProcessing && (
            <>
              <Button
                disabled={isSearching}
                onClick={() => void runRagRequest('search')}
                variant="secondary"
              >
                <RagIcon name="search" size={15} />
                {isSearching && resultMode === 'search'
                  ? 'Finding...'
                  : 'Find matching files'}
              </Button>
              {canReindexDocuments && (
                <Button
                  disabled={isReindexing || isLoading}
                  onClick={() => void handleReindex()}
                  variant="secondary"
                >
                  <RagIcon name="refresh" size={15} />
                  {isReindexing ? 'Preparing...' : 'Prepare files for AI'}
                </Button>
              )}
            </>
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
                    {searchResponse.llm_available ? 'AI answer' : 'Helpful matches'}
                  </span>
                  <h2>Answer</h2>
                </div>
              </div>
              <AnswerMarkdown text={searchResponse.answer} />
              {sourceDocuments.length > 0 && (
                <div className="rag-source-list">
                  {sourceDocuments.map((source) => (
                    <a
                      className="rag-source-pill"
                      href={getOrganizationDocumentContentUrl(
                        organizationId,
                        source.document_id,
                      )}
                      key={source.document_id}
                      rel="noreferrer"
                      title={source.document_name || source.original_filename}
                      target="_blank"
                    >
                      {source.document_name ||
                        source.original_filename ||
                        'Document'}
                    </a>
                  ))}
                </div>
              )}
            </article>
          )}

          <section className="card">
            <div className="section-heading">
              <div>
                <span className="card__label">Files used</span>
                <h2>
                  {sourceDocuments.length} file
                  {sourceDocuments.length === 1 ? '' : 's'}
                </h2>
              </div>
              <span className="status-badge">
                {formatProcessingTime(searchResponse.processing_time_ms)}
              </span>
            </div>

            {sourceDocuments.length ? (
              <div className="rag-result-list">
                {sourceDocuments.map(
                  (result) => (
                    <SourceDocumentCard
                      key={result.document_id}
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
                    Try selecting more files or preparing files that are not
                    ready yet.
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
