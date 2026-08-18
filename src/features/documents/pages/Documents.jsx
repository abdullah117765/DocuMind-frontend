import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { isSuperAdminAccess } from '../../../shared/utils/accessDisplay.js'
import { emitNetworkError } from '../../../shared/networkEvents.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  createKnowledgeBase,
  createKnowledgeBaseCollection,
  createKnowledgeBaseTag,
  listKnowledgeBaseCollections,
  listKnowledgeBases,
  listKnowledgeBaseTags,
} from '../../knowledge-bases/services/knowledgeBasesApi.js'
import {
  commitUploadSession,
  deleteOrganizationDocument,
  getDocumentPreview,
  getDocumentVersions,
  getOrganizationDocumentContentUrl,
  getOrganizationDocumentDownloadUrl,
  getPlatformDocumentContentUrl,
  getPlatformDocumentPreview,
  getStagedFileContentUrl,
  getUploadJobEventsUrl,
  getZipManifest,
  listOrganizationDocuments,
  listPlatformDocuments,
  purgePlatformDocument,
  removeStagedDocumentFile,
  restoreOrganizationDocument,
  restorePlatformDocument,
  stageOrganizationDocuments,
  stageZipOrganizationDocuments,
  uploadDocumentVersion,
} from '../services/documentsApi.js'

const ALLOWED_EXTENSIONS = [
  'pdf',
  'docx',
  'doc',
  'ppt',
  'pptx',
  'csv',
  'xlsx',
  'txt',
  'zip',
  'png',
  'jpeg',
  'jpg',
  'html',
  'xml',
  'json',
]

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_FILES_PER_BATCH = 8
const DEFAULT_DOCUMENT_PAGE_SIZE = 10
const DOCUMENT_PAGE_SIZE_OPTIONS = [10, 20, 50]
const ACCEPTED_FILE_TYPES = ALLOWED_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(',')
const DOCUMENT_STATUS_LABELS = {
  ACTIVE: 'active',
  PURGED: 'purged',
  SOFT_DELETED_BY_ORG: 'org deleted',
  SOFT_DELETED_BY_USER: 'user deleted',
}
const HIDDEN_STAGED_FILE_STATUSES = new Set(['COMMITTED', 'REMOVED'])
const UPLOAD_JOB_STATUS_LABELS = {
  FAILED: 'failed',
  PROCESSING: 'saving',
  QUEUED: 'waiting',
  SUCCEEDED: 'completed',
}

function isUploadJobTerminal(job) {
  return job?.status === 'SUCCEEDED' || job?.status === 'FAILED'
}

function getUploadJobTone(job) {
  if (job?.status === 'SUCCEEDED') return 'success'
  if (job?.status === 'FAILED') return 'danger'
  if (job?.status === 'QUEUED') return 'warning'

  return 'warning'
}

function DocumentUiIcon({ name, size = 24 }) {
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
      {name === 'upload' && (
        <>
          <path d="M12 16V4" {...commonProps} />
          <path d="m7 9 5-5 5 5" {...commonProps} />
          <path d="M20 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5" {...commonProps} />
        </>
      )}
      {name === 'lock' && (
        <>
          <rect height="11" rx="2" {...commonProps} width="16" x="4" y="11" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" {...commonProps} />
        </>
      )}
      {name === 'preview' && (
        <>
          <path
            d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
            {...commonProps}
          />
          <circle cx="12" cy="12" r="2.5" {...commonProps} />
        </>
      )}
      {name === 'open' && (
        <>
          <path d="M14 4h6v6" {...commonProps} />
          <path d="m10 14 10-10" {...commonProps} />
          <path
            d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"
            {...commonProps}
          />
        </>
      )}
      {name === 'download' && (
        <>
          <path d="M12 3v12" {...commonProps} />
          <path d="m7 10 5 5 5-5" {...commonProps} />
          <path d="M5 21h14" {...commonProps} />
        </>
      )}
      {name === 'versions' && (
        <>
          <path d="M4 7h10a6 6 0 1 1-5.7 7.8" {...commonProps} />
          <path d="M4 7l4-4" {...commonProps} />
          <path d="M4 7l4 4" {...commonProps} />
          <path d="M12 8v4l3 2" {...commonProps} />
        </>
      )}
      {name === 'restore' && (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7" {...commonProps} />
          <path d="M3 5v7h7" {...commonProps} />
        </>
      )}
      {name === 'trash' && (
        <>
          <path d="M4 7h16" {...commonProps} />
          <path d="M10 11v6" {...commonProps} />
          <path d="M14 11v6" {...commonProps} />
          <path d="M6 7l1 14h10l1-14" {...commonProps} />
          <path d="M9 7V4h6v3" {...commonProps} />
        </>
      )}
    </svg>
  )
}

function formatDate(value) {
  if (!value) return 'Not available'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatStatus(value = '') {
  if (DOCUMENT_STATUS_LABELS[value]) return DOCUMENT_STATUS_LABELS[value]

  return value.replace(/_/g, ' ').toLowerCase()
}

function getExtension(filename = '') {
  const extension = filename.split('.').pop()?.trim().toLowerCase() ?? ''

  return extension === 'jpg' ? 'jpeg' : extension
}

function getActorLabel(user) {
  if (!user) return 'Unknown user'

  return user.name || user.email || 'Unknown user'
}

function getStatusTone(status) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PURGED' || status === 'SOFT_DELETED_BY_ORG') return 'danger'

  return 'warning'
}

function getPreviewTitle(fileOrDocument) {
  return fileOrDocument.originalFilename ?? fileOrDocument.name ?? 'Document'
}

function getVisibleStagedFiles(session) {
  return (session?.files ?? []).filter(
    (file) => !HIDDEN_STAGED_FILE_STATUSES.has(file.status),
  )
}

function normalizeUploadSession(session) {
  const files = getVisibleStagedFiles(session)

  return files.length ? { ...session, files } : null
}

function DocumentActionButton({ icon, label, variant = 'secondary', ...props }) {
  return (
    <Button
      aria-label={label}
      className="document-action-button"
      data-tooltip={label}
      title={label}
      variant={variant}
      {...props}
    >
      <DocumentUiIcon name={icon} size={15} />
      <span className="visually-hidden">{label}</span>
    </Button>
  )
}

function getDocumentErrorMessage(error, fallback) {
  const message = String(error?.message ?? error ?? '')
  const lowerMessage = message.toLowerCase()
  const technicalMarkers = [
    'backend',
    'content endpoint',
    'conversion worker',
    'job',
    'libreoffice',
    'metadata',
    'preview metadata',
    'processing',
    'queue',
    'queued',
    'serviceunavailable',
    'soft-delete',
    'storage',
    'worker',
  ]

  if (!message || technicalMarkers.some((marker) => lowerMessage.includes(marker))) {
    return fallback
  }

  return message
}

function formatUploadStage(stage = '') {
  const normalizedStage = String(stage).toLowerCase()

  if (normalizedStage.includes('saving')) return 'Saving files'
  if (normalizedStage.includes('cleanup')) return 'Finishing up'
  if (normalizedStage.includes('validat')) return 'Checking files'
  if (normalizedStage.includes('preview')) return 'Preparing previews'

  return 'Working'
}

function getUploadProgressMessage(job) {
  const fallbackByStatus = {
    FAILED: 'We could not save these files. Please review them and try again.',
    PROCESSING: 'Saving your files. You can keep this page open to watch progress.',
    QUEUED: 'Your files are waiting to be saved.',
    SUCCEEDED: 'Your files are ready.',
  }

  return getDocumentErrorMessage(
    job?.message,
    fallbackByStatus[job?.status] ?? 'Saving your files. This may take a moment.',
  )
}

function PaginationControls({
  onPageChange,
  onPageSizeChange,
  pageSize,
  pagination,
}) {
  const total = pagination?.total ?? 0

  if (!pagination || total <= 0) {
    return null
  }

  const page = pagination.page ?? 1
  const pageCount = Math.max(pagination.pageCount ?? 1, 1)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="pagination-bar" aria-label="Document pagination">
      <p>
        Showing <strong>{start}</strong>-<strong>{end}</strong> of{' '}
        <strong>{total}</strong>
      </p>

      <div className="pagination-bar__controls">
        <label className="pagination-bar__size">
          <span>Rows</span>
          <select
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {DOCUMENT_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
        >
          Previous
        </Button>
        <span className="pagination-bar__page">
          Page {page} of {pageCount}
        </span>
        <Button
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
        >
          Next
        </Button>
      </div>
    </div>
  )
}

function isImageMime(mimeType = '') {
  return mimeType.startsWith('image/')
}

function isPdfMime(mimeType = '') {
  return mimeType === 'application/pdf'
}

function renderPreviewBody(preview, contentUrl, mimeType, binaryState = {}) {
  if (!preview) {
    return (
      <section className="empty-state empty-state--compact">
        <div>
          <h2>Preview is not available</h2>
          <p>Download the file to view it, or try uploading it again.</p>
        </div>
      </section>
    )
  }

  if (preview.kind === 'binary' && preview.previewAvailable) {
    if (binaryState.loading) {
      return <Loader label="Loading preview..." />
    }

    if (binaryState.error) {
      return (
        <Alert tone="warning">
          We could not load the inline preview. Open the file in a new tab or
          download it to view it.
        </Alert>
      )
    }

    if (!contentUrl) {
      return (
        <Alert tone="warning">
          Preview is not available right now. Try again in a moment.
        </Alert>
      )
    }

    if (isImageMime(preview.mimeType || mimeType)) {
      return (
        <img
          alt="Document preview"
          className="document-preview__image"
          src={contentUrl}
        />
      )
    }

    if (isPdfMime(preview.mimeType || mimeType)) {
      return (
        <iframe
          className="document-preview__frame"
          src={contentUrl}
          title="Document preview"
        />
      )
    }

    return (
      <Alert tone="info">
        This file can be opened in a new tab for review.
      </Alert>
    )
  }

  if (preview.kind === 'table') {
    const rows = Array.isArray(preview.rows) ? preview.rows : []

    if (rows.length === 0) {
      return <Alert tone="warning">{preview.message ?? 'No rows were found.'}</Alert>
    }

    return (
      <div className="document-preview__table-wrap">
        <table className="document-preview__table">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join('|')}`}>
                {(Array.isArray(row) ? row : []).map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {preview.truncated && (
          <p className="muted-copy">
            Showing the first {preview.rowLimit ?? 100} rows.
          </p>
        )}
      </div>
    )
  }

  if (['source', 'office-text'].includes(preview.kind)) {
    return (
      <div className="document-preview__source-wrap">
        {preview.message && <p className="muted-copy">{preview.message}</p>}
        <pre className="document-preview__source">{preview.content || ''}</pre>
        {preview.truncated && (
          <p className="muted-copy">Preview was shortened for performance.</p>
        )}
      </div>
    )
  }

  return (
    <Alert tone={preview.previewAvailable ? 'info' : 'warning'}>
      {preview.message ?? 'Preview is not available for this file type. Download the file to view it.'}
    </Alert>
  )
}

function DocumentPreviewModal({ item, onClose }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [blobError, setBlobError] = useState(null)
  const [blobLoading, setBlobLoading] = useState(false)

  useEffect(() => {
    if (
      !item?.contentUrl ||
      item.preview?.kind !== 'binary' ||
      !item.preview?.previewAvailable
    ) {
      setBlobUrl('')
      setBlobError(null)
      setBlobLoading(false)
      return undefined
    }

    let isActive = true
    let objectUrl = ''
    const controller = new AbortController()

    async function loadBinaryPreview() {
      setBlobLoading(true)
      setBlobError(null)

      try {
        const response = await fetch(item.contentUrl, {
          credentials: 'include',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Preview request failed.')
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)

        if (isActive) {
          setBlobUrl(objectUrl)
        } else {
          URL.revokeObjectURL(objectUrl)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        if (isActive) {
          setBlobError(error)
          setBlobUrl('')
        }
      } finally {
        if (isActive) {
          setBlobLoading(false)
        }
      }
    }

    void loadBinaryPreview()

    return () => {
      isActive = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item?.contentUrl, item?.preview?.kind, item?.preview?.previewAvailable])

  if (!item) return null

  const previewContentUrl =
    item.preview?.kind === 'binary' && item.preview?.previewAvailable
      ? blobUrl
      : item.contentUrl

  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} title={getPreviewTitle(item)}>
      <div className="document-preview">
        <div className="document-preview__toolbar">
          <span className="status-badge">
            {(item.extension ?? '').toUpperCase() || 'FILE'}
          </span>
          <span className="muted-copy">{formatBytes(item.sizeBytes)}</span>
          {item.contentUrl && (
            <a
              className="button button--secondary button--link"
              href={item.contentUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open preview
            </a>
          )}
        </div>
        {renderPreviewBody(item.preview, previewContentUrl, item.mimeType, {
          error: blobError,
          loading: blobLoading,
        })}
      </div>
    </Modal>
  )
}

function VersionsModal({
  canUploadVersion,
  document,
  isLoading,
  isSaving,
  onClose,
  onUploadVersion,
  versions,
}) {
  const [file, setFile] = useState(null)

  useEffect(() => {
    setFile(null)
  }, [document?.id])

  if (!document) return null

  return (
    <Modal isOpen={Boolean(document)} onClose={onClose} title="Version history">
      <div className="document-versions">
        <div>
          <h3>{document.name}</h3>
          <p className="muted-copy">
            Review every uploaded version. Uploading a new version keeps the
            previous one in history.
          </p>
        </div>

        {canUploadVersion && (
          <form
            className="version-upload-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (file) void onUploadVersion(file)
            }}
          >
            <input
              disabled={isSaving}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <Button disabled={!file || isSaving} type="submit">
              {isSaving ? 'Uploading...' : 'Upload new version'}
            </Button>
          </form>
        )}

        {isLoading ? (
          <Loader label="Loading versions..." />
        ) : versions.length ? (
          <div className="version-list">
            {versions.map((version) => (
              <article className="version-card" key={version.id}>
                <div>
                  <strong>Version {version.versionNumber}</strong>
                  <p>{version.originalFilename}</p>
                  <span className="muted-copy">
                    {formatBytes(version.sizeBytes)} by{' '}
                    {getActorLabel(version.createdBy)}
                  </span>
                </div>
                <span className="muted-copy">{formatDate(version.createdAt)}</span>
              </article>
            ))}
          </div>
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No versions found</h2>
              <p>No saved versions are available for this file yet.</p>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}

function ZipReview({
  isSaving,
  onCancel,
  onSelectPaths,
  onStage,
  selectedPaths,
  zipReview,
}) {
  if (!zipReview) return null

  const entries = zipReview.manifest.entries ?? []
  const selectedCount = selectedPaths.length

  function togglePath(path) {
    if (selectedPaths.includes(path)) {
      onSelectPaths(selectedPaths.filter((selectedPath) => selectedPath !== path))
      return
    }

    if (selectedPaths.length >= MAX_FILES_PER_BATCH) return

    onSelectPaths([...selectedPaths, path])
  }

  return (
    <section className="card document-upload-card">
      <div className="section-heading">
        <div>
          <span className="card__label">ZIP review</span>
          <h2>{zipReview.manifest.archiveName}</h2>
          <p>
            Select up to {MAX_FILES_PER_BATCH} safe files from the archive.
            Unsupported, encrypted, folder-based, or oversized files cannot be
            added.
          </p>
        </div>
        <span
          className={`status-badge ${
            selectedCount >= MAX_FILES_PER_BATCH ? 'status-badge--warning' : ''
          }`}
        >
          {selectedCount}/{MAX_FILES_PER_BATCH} selected
          {selectedCount >= MAX_FILES_PER_BATCH ? ' - max reached' : ''}
        </span>
      </div>

      <div className="zip-entry-list">
        {entries.map((entry) => {
          const selected = selectedPaths.includes(entry.path)
          const disabled =
            !entry.selectable ||
            (!selected && selectedPaths.length >= MAX_FILES_PER_BATCH)

          return (
            <label
              className={`zip-entry ${!entry.selectable ? 'zip-entry--disabled' : ''}`}
              key={entry.path}
            >
              <input
                checked={selected}
                disabled={disabled || isSaving}
                onChange={() => togglePath(entry.path)}
                type="checkbox"
              />
              <span>
                <strong>{entry.filename}</strong>
                <small>
                  {entry.path} - {formatBytes(entry.sizeBytes)}
                </small>
                {!entry.selectable && (
                  <small className="field__error">{entry.rejectionReason}</small>
                )}
              </span>
            </label>
          )
        })}
      </div>

      <div className="form-actions">
        <Button disabled={isSaving} onClick={onCancel} variant="secondary">
          Cancel ZIP review
        </Button>
        <Button
          disabled={isSaving || selectedPaths.length === 0}
          onClick={onStage}
        >
          {isSaving ? 'Adding...' : 'Add selected files'}
        </Button>
      </div>
    </section>
  )
}

function UploadSessionCard({
  isSaving,
  onCommit,
  onPreview,
  onRemoveFile,
  session,
  uploadJob,
}) {
  if (!session) return null
  const stagedFiles = getVisibleStagedFiles(session)
  const uploadJobActive = Boolean(uploadJob && !isUploadJobTerminal(uploadJob))

  return (
    <section className="card document-upload-card">
      <div className="section-heading">
        <div>
          <span className="card__label">Review before saving</span>
          <h2>Files ready to save ({stagedFiles.length}/{MAX_FILES_PER_BATCH})</h2>
          <p>
            Preview each file and remove anything incorrect before creating
            saved documents.
          </p>
          {uploadJobActive && (
            <span className="status-badge status-badge--warning">
              Saving in progress
            </span>
          )}
        </div>
        <Button
          disabled={isSaving || uploadJobActive || stagedFiles.length === 0}
          onClick={onCommit}
        >
          {uploadJobActive ? 'Saving...' : isSaving ? 'Starting...' : 'Save documents'}
        </Button>
      </div>

      <div className="staged-file-list">
        {stagedFiles.map((file) => (
          <article className="staged-file-card" key={file.id}>
            <div className="file-icon" aria-hidden="true">
              {file.extension?.slice(0, 3).toUpperCase() || 'DOC'}
            </div>
            <div>
              <strong>{file.originalFilename}</strong>
              <p>
                {file.sourceArchivePath
                  ? `From ${file.sourceArchiveName} / ${file.sourceArchivePath}`
                  : 'Direct upload'}
              </p>
              <span className="muted-copy">
                {formatBytes(file.sizeBytes)} - {(file.extension ?? '').toUpperCase()}
              </span>
            </div>
            <div className="inline-actions">
              <Button
                disabled={isSaving}
                onClick={() => onPreview(file)}
                variant="secondary"
              >
                Preview
              </Button>
              <Button
                disabled={isSaving || uploadJobActive}
                onClick={() => onRemoveFile(file)}
                variant="danger"
              >
                Remove
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function UploadLocationModal({
  collectionId,
  collections,
  collectionCreateError,
  collectionCreateName,
  createError,
  createName,
  isCreatingCollection,
  isCreatingKnowledgeBase,
  isCreatingTag,
  isLoading,
  isOpen,
  isSaving,
  knowledgeBaseId,
  knowledgeBases,
  newTagName,
  onChangeCollection,
  onChangeCollectionCreateName,
  onChangeCreateName,
  onChangeKnowledgeBase,
  onChangeNewTagName,
  onCreateKnowledgeBase,
  onCreateCollection,
  onCreateTag,
  onClose,
  onSave,
  onToggleTag,
  selectedTagIds,
  stagedCount,
  tags,
  tagCreateError,
}) {
  const [mode, setMode] = useState('existing')
  const canSave =
    Boolean(knowledgeBaseId) &&
    !isSaving &&
    !isCreatingKnowledgeBase &&
    !isCreatingCollection &&
    !isCreatingTag
  const canCreate = createName.trim().length >= 2 && !isCreatingKnowledgeBase && !isSaving
  const canCreateCollection =
    Boolean(knowledgeBaseId) &&
    collectionCreateName.trim().length >= 2 &&
    !isCreatingCollection &&
    !isSaving
  const canCreateTag = newTagName.trim().length >= 2 && !isCreatingTag && !isSaving

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose where to save files">
      <div className="upload-location-modal">
        <p className="muted-copy">
          {stagedCount} file{stagedCount === 1 ? '' : 's'} ready. Select a
          Knowledge Base, and optionally a Collection, before saving.
        </p>

        <div className="upload-location-modal__choice" role="tablist" aria-label="Knowledge Base choice">
          <button
            aria-selected={mode === 'existing'}
            className={mode === 'existing' ? 'active' : ''}
            disabled={isSaving || isCreatingKnowledgeBase}
            onClick={() => setMode('existing')}
            type="button"
          >
            Existing Knowledge Base
          </button>
          <button
            aria-selected={mode === 'new'}
            className={mode === 'new' ? 'active' : ''}
            disabled={isSaving || isCreatingKnowledgeBase}
            onClick={() => setMode('new')}
            type="button"
          >
            Create new Knowledge Base
          </button>
        </div>

        {mode === 'new' && (
          <div className="upload-location-modal__create">
            <label className="field">
              <span>New Knowledge Base name</span>
              <input
                disabled={isSaving || isCreatingKnowledgeBase}
                maxLength={120}
                onChange={(event) => onChangeCreateName(event.target.value)}
                placeholder="Example: HR Policies"
                value={createName}
              />
              <small className="muted-copy">Letters, numbers, and single spaces only.</small>
            </label>
            {createError && (
              <p className="field-error" role="alert">
                {createError}
              </p>
            )}
            <Button disabled={!canCreate} onClick={onCreateKnowledgeBase} variant="secondary">
              {isCreatingKnowledgeBase ? 'Creating...' : 'Create and select'}
            </Button>
          </div>
        )}

        {mode === 'existing' ? (
          <label className="field">
            <span>Knowledge Base</span>
            <select
              disabled={isLoading || isSaving}
              onChange={(event) => {
                onChangeKnowledgeBase(event.target.value)
                onChangeCollection('')
              }}
              value={knowledgeBaseId}
            >
              <option value="">
                {isLoading ? 'Loading...' : 'Select Knowledge Base'}
              </option>
              {knowledgeBases.map((knowledgeBase) => (
                <option key={knowledgeBase.id} value={knowledgeBase.id}>
                  {knowledgeBase.name}
                  {knowledgeBase.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="upload-location-modal__selected">
            <span>Selected Knowledge Base</span>
            <strong>
              {knowledgeBases.find((knowledgeBase) => knowledgeBase.id === knowledgeBaseId)
                ?.name ?? 'Create a Knowledge Base to continue'}
            </strong>
          </div>
        )}

        {knowledgeBaseId && (
          <div className="upload-location-modal__section">
            <div className="upload-location-modal__section-header">
              <div>
                <strong>Collection</strong>
                <p className="muted-copy">Optional. Use a collection to group related documents.</p>
              </div>
            </div>

            <div className="upload-location-modal__grid">
              <label className="field">
                <span>Choose collection</span>
                <select
                  disabled={isSaving || isCreatingCollection}
                  onChange={(event) => onChangeCollection(event.target.value)}
                  value={collectionId}
                >
                  <option value="">No collection</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Create collection</span>
                <div className="upload-location-modal__inline">
                  <input
                    disabled={isSaving || isCreatingCollection}
                    maxLength={120}
                    onChange={(event) => onChangeCollectionCreateName(event.target.value)}
                    placeholder="Example: Policies"
                    value={collectionCreateName}
                  />
                  <Button
                    disabled={!canCreateCollection}
                    onClick={onCreateCollection}
                    variant="secondary"
                  >
                    {isCreatingCollection ? 'Adding...' : 'Add'}
                  </Button>
                </div>
                {collectionCreateError && (
                  <small className="field-error" role="alert">
                    {collectionCreateError}
                  </small>
                )}
              </label>
            </div>
          </div>
        )}

        <div className="upload-location-modal__section">
          <div className="upload-location-modal__section-header">
            <div>
              <strong>Tags</strong>
              <p className="muted-copy">Optional. Add simple labels to make files easier to find.</p>
            </div>
          </div>

          <div className="upload-location-modal__inline">
            <input
              disabled={isSaving || isCreatingTag}
              maxLength={60}
              onChange={(event) => onChangeNewTagName(event.target.value)}
              placeholder="Example: onboarding"
              value={newTagName}
            />
            <Button disabled={!canCreateTag} onClick={onCreateTag} variant="secondary">
              {isCreatingTag ? 'Adding...' : 'Add tag'}
            </Button>
          </div>
          {tagCreateError && (
            <p className="field-error" role="alert">
              {tagCreateError}
            </p>
          )}

          {tags.length > 0 ? (
            <div className="upload-location-modal__tags">
              {tags.map((tag) => {
                const checked = selectedTagIds.includes(tag.id)

                return (
                  <label className={checked ? 'active' : ''} key={tag.id}>
                    <input
                      checked={checked}
                      disabled={isSaving}
                      onChange={() => onToggleTag(tag.id)}
                      type="checkbox"
                    />
                    <span>{tag.name}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="muted-copy">No tags yet.</p>
          )}
        </div>

        <div className="form-actions">
          <Button disabled={isSaving} onClick={onClose} variant="secondary">
            Review files
          </Button>
          <Button disabled={!canSave} onClick={onSave}>
            {isSaving ? 'Saving...' : 'Save documents'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function UploadJobProgressCard({ job, onDismiss }) {
  if (!job) return null

  const progress = Math.max(0, Math.min(100, Number(job.progress) || 0))
  const processedFiles = job.processedFiles ?? 0
  const totalFiles = job.totalFiles ?? 0
  const statusLabel = UPLOAD_JOB_STATUS_LABELS[job.status] ?? job.status
  const isTerminal = isUploadJobTerminal(job)

  return (
    <section className={`card upload-job-card upload-job-card--${job.status?.toLowerCase()}`}>
      <div className="upload-job-card__header">
        <div>
          <span className="card__label">Upload progress</span>
          <h2>{isTerminal ? 'Upload finished' : 'Saving your files'}</h2>
        </div>
        <span className={`status-badge status-badge--${getUploadJobTone(job)}`}>
          {statusLabel}
        </span>
      </div>

      <div
        aria-label={`Upload progress ${progress}%`}
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow={progress}
        className="upload-progress"
        role="progressbar"
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="upload-job-card__meta">
        <span>
          <strong>{progress}%</strong> complete
        </span>
        <span>
          {processedFiles}/{totalFiles} file(s)
        </span>
        <span>{formatUploadStage(job.stage)}</span>
      </div>

      <p>{getUploadProgressMessage(job)}</p>
      {job.currentFileName && (
        <p className="muted-copy">
          Current file:{' '}
          <span title={job.currentFileName}>{job.currentFileName}</span>
        </p>
      )}
      {job.error && (
        <p className="field__error">
          {getDocumentErrorMessage(
            job.error,
            'We could not save these files. Please review them and try again.',
          )}
        </p>
      )}
      {job.warnings?.length > 0 && (
        <p className="muted-copy">
          {job.warnings.length} duplicate notice
          {job.warnings.length === 1 ? '' : 's'} found. The files were still
          saved as separate documents.
        </p>
      )}
      {isTerminal && (
        <div className="form-actions upload-job-card__actions">
          <Button onClick={onDismiss} variant="secondary">
            Dismiss
          </Button>
        </div>
      )}
    </section>
  )
}

function EmptyDocuments({ isPlatform }) {
  return (
    <section className="empty-state empty-state--compact">
      <div>
        <h2>No documents found</h2>
        <p>
          {isPlatform
            ? 'There are no platform-visible documents for the current filters.'
            : 'Upload files above to create the first organization documents.'}
        </p>
      </div>
    </section>
  )
}

export function Documents({ scope = 'organization' }) {
  const {
    access,
    hasPermission,
    hasPlatformPermission,
    selectedOrganization,
    status,
  } = useAccessControl()
  const { user } = useAuth()
  const notifications = useNotifications()
  const fileInputRef = useRef(null)
  const handledUploadJobIdsRef = useRef(new Set())
  const isPlatform = scope === 'platform'
  const isSuperAdmin = isSuperAdminAccess(user, access)
  const organizationId = selectedOrganization?.organization.id ?? ''
  const canUsePlatformDocuments =
    isSuperAdmin || hasPlatformPermission('platform.documents.manage')
  const canReadDocuments = isPlatform
    ? canUsePlatformDocuments
    : hasPermission('documents.read')
  const canUploadDocuments = !isPlatform && hasPermission('documents.upload')
  const canUploadVersion =
    !isPlatform &&
    hasPermission('documents.upload') &&
    hasPermission('documents.update')
  const canDeleteDocuments = isPlatform
    ? canUsePlatformDocuments
    : hasPermission('documents.delete') || hasPermission('documents.update')
  const canRestoreDocuments = isPlatform
    ? canUsePlatformDocuments
    : hasPermission('documents.delete') || hasPermission('documents.update')
  const canDownloadDocuments = isPlatform || hasPermission('documents.export')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    organizationId: '',
    search: '',
    sort: 'newest',
    status: '',
    updatedRange: '',
    view: 'active',
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState([])
  const [knowledgeBaseCollections, setKnowledgeBaseCollections] = useState([])
  const [knowledgeBaseError, setKnowledgeBaseError] = useState(null)
  const [knowledgeBaseLoading, setKnowledgeBaseLoading] = useState(false)
  const [knowledgeBaseTags, setKnowledgeBaseTags] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_DOCUMENT_PAGE_SIZE)
  const [pagination, setPagination] = useState(null)
  const [previewTarget, setPreviewTarget] = useState(null)
  const [uploadErrors, setUploadErrors] = useState([])
  const [uploadJob, setUploadJob] = useState(null)
  const [uploadSession, setUploadSession] = useState(null)
  const [versionTarget, setVersionTarget] = useState(null)
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [zipReview, setZipReview] = useState(null)
  const [zipSelectedPaths, setZipSelectedPaths] = useState([])
  const [uploadKnowledgeBaseId, setUploadKnowledgeBaseId] = useState('')
  const [uploadCollectionId, setUploadCollectionId] = useState('')
  const [isUploadLocationModalOpen, setIsUploadLocationModalOpen] = useState(false)
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState('')
  const [newKnowledgeBaseError, setNewKnowledgeBaseError] = useState('')
  const [isCreatingKnowledgeBase, setIsCreatingKnowledgeBase] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionError, setNewCollectionError] = useState('')
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagError, setNewTagError] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [uploadTagIds, setUploadTagIds] = useState([])

  const supportedFileTypes = useMemo(
    () => ALLOWED_EXTENSIONS.map((extension) => extension.toUpperCase()).join(', '),
    [],
  )
  const documentCount = pagination?.total ?? documents.length
  const uploadJobActive = Boolean(uploadJob && !isUploadJobTerminal(uploadJob))

  const updateFilters = useCallback((updater) => {
    setPage(1)
    setFilters((current) =>
      typeof updater === 'function' ? updater(current) : { ...current, ...updater },
    )
  }, [])

  const loadDocuments = useCallback(async () => {
    if (!canReadDocuments || (!isPlatform && !organizationId)) {
      setDocuments([])
      setPagination(null)
      setIsLoading(false)
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const data = isPlatform
        ? await listPlatformDocuments({
            organizationId: filters.organizationId,
            page,
            pageSize,
            search: filters.search.trim(),
            sort: filters.sort,
            status: filters.status,
            updatedRange: filters.updatedRange,
          })
        : await listOrganizationDocuments(organizationId, {
            page,
            pageSize,
            search: filters.search.trim(),
            sort: filters.sort,
            updatedRange: filters.updatedRange,
            view: filters.view,
          })

      if (
        data.pagination &&
        data.pagination.total > 0 &&
        data.pagination.page > data.pagination.pageCount
      ) {
        setPage(data.pagination.pageCount)
        return
      }

      setDocuments(data.documents ?? [])
      setPagination(data.pagination ?? null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [
    canReadDocuments,
    filters.organizationId,
    filters.search,
    filters.sort,
    filters.status,
    filters.updatedRange,
    filters.view,
    isPlatform,
    organizationId,
    page,
    pageSize,
  ])

  useEffect(() => {
    setPage(1)
  }, [isPlatform, organizationId])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDocuments()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadDocuments])

  useEffect(() => {
    let active = true

    if (!organizationId || isPlatform || !canUploadDocuments) {
      setKnowledgeBases([])
      setKnowledgeBaseCollections([])
      setKnowledgeBaseTags([])
      setUploadKnowledgeBaseId('')
      setUploadCollectionId('')
      setUploadTagIds([])
      setKnowledgeBaseLoading(false)
      return undefined
    }

    setKnowledgeBaseLoading(true)
    setKnowledgeBaseError(null)

    listKnowledgeBases(organizationId, { page: 1, pageSize: 100 })
      .then((data) => {
        if (!active) return

        const nextKnowledgeBases = data.knowledgeBases ?? []
        setKnowledgeBases(nextKnowledgeBases)
        setUploadKnowledgeBaseId((current) => {
          if (current && nextKnowledgeBases.some((kb) => kb.id === current)) {
            return current
          }

          return (
            nextKnowledgeBases.find((kb) => kb.isDefault)?.id ??
            nextKnowledgeBases[0]?.id ??
            ''
          )
        })
      })
      .catch((requestError) => {
        if (!active) return
        setKnowledgeBaseError(requestError)
      })
      .finally(() => {
        if (active) setKnowledgeBaseLoading(false)
      })

    return () => {
      active = false
    }
  }, [canUploadDocuments, isPlatform, organizationId])

  useEffect(() => {
    let active = true

    if (!organizationId || isPlatform || !canUploadDocuments) {
      setKnowledgeBaseTags([])
      setUploadTagIds([])
      return undefined
    }

    listKnowledgeBaseTags(organizationId)
      .then((tags) => {
        if (!active) return
        setKnowledgeBaseTags(tags)
        setUploadTagIds((current) =>
          current.filter((tagId) => tags.some((tag) => tag.id === tagId)),
        )
      })
      .catch(() => {
        if (!active) return
        setKnowledgeBaseTags([])
        setUploadTagIds([])
      })

    return () => {
      active = false
    }
  }, [canUploadDocuments, isPlatform, organizationId])

  useEffect(() => {
    let active = true

    if (!organizationId || !uploadKnowledgeBaseId || isPlatform) {
      setKnowledgeBaseCollections([])
      setUploadCollectionId('')
      return undefined
    }

    listKnowledgeBaseCollections(organizationId, uploadKnowledgeBaseId)
      .then((collections) => {
        if (!active) return
        setKnowledgeBaseCollections(collections)
        setUploadCollectionId((current) =>
          current && collections.some((collection) => collection.id === current)
            ? current
            : '',
        )
      })
      .catch(() => {
        if (!active) return
        setKnowledgeBaseCollections([])
        setUploadCollectionId('')
      })

    return () => {
      active = false
    }
  }, [isPlatform, organizationId, uploadKnowledgeBaseId])

  useEffect(() => {
    const jobId = uploadJob?.id

    if (!jobId || !organizationId || isPlatform) {
      return undefined
    }

    if (!('EventSource' in window)) {
      setUploadJob((current) =>
        current?.id === jobId
          ? {
              ...current,
              message:
                'Live upload progress is not supported by this browser. Refresh after saving finishes.',
            }
          : current,
      )
      return undefined
    }

    const source = new EventSource(getUploadJobEventsUrl(organizationId, jobId), {
      withCredentials: true,
    })

    function handleProgress(event) {
      let nextJob

      try {
        nextJob = JSON.parse(event.data)
      } catch {
        setUploadJob((current) =>
          current?.id === jobId
            ? { ...current, message: 'Received an unreadable progress update.' }
            : current,
        )
        return
      }

      setUploadJob(nextJob)

      if (!isUploadJobTerminal(nextJob) || handledUploadJobIdsRef.current.has(jobId)) {
        return
      }

      handledUploadJobIdsRef.current.add(jobId)
      source.close()
      setIsSaving(false)

      if (nextJob.status === 'SUCCEEDED') {
        setUploadSession(null)
        void loadDocuments()
        notifications.success(
          `${nextJob.documents?.length ?? 0} document(s) saved successfully.`,
        )

        if (nextJob.warnings?.length) {
          notifications.info(
            `${nextJob.warnings.length} duplicate warning(s) were returned.`,
          )
        }
      } else {
        notifications.error(
          getDocumentErrorMessage(
            nextJob.error,
            'Saving failed. Review the selected files and try again.',
          ),
        )
      }
    }

    source.onmessage = handleProgress
    source.onerror = () => {
      const isOffline =
        typeof navigator !== 'undefined' && navigator.onLine === false
      const message = isOffline
        ? 'Internet disconnected. Saving will continue if it already started.'
        : 'Live upload progress connection was interrupted. Reconnecting automatically...'

      if (!isOffline) {
        emitNetworkError(message)
      }

      setUploadJob((current) =>
        current?.id === jobId && !isUploadJobTerminal(current)
          ? {
              ...current,
              message,
            }
          : current,
      )
    }

    return () => source.close()
  }, [isPlatform, loadDocuments, notifications, organizationId, uploadJob?.id])

  function validateFiles(files) {
    const errors = []
    const valid = []

    for (const file of files) {
      const extension = getExtension(file.name)

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        errors.push(
          `"${file.name}" is not supported. Use ${supportedFileTypes}.`,
        )
        continue
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}" exceeds the 10 MB file limit.`)
        continue
      }

      valid.push(file)
    }

    if (valid.length > MAX_FILES_PER_BATCH) {
      errors.push(`Upload a maximum of ${MAX_FILES_PER_BATCH} files at a time.`)
      return { errors, files: valid.slice(0, MAX_FILES_PER_BATCH) }
    }

    return { errors, files: valid }
  }

  async function processSelectedFiles(selectedFiles) {
    const incomingFiles = Array.from(selectedFiles ?? [])

    if (!incomingFiles.length) return

    if (!canUploadDocuments) {
      notifications.error('Your role cannot upload documents.')
      return
    }

    const { errors, files } = validateFiles(incomingFiles)
    setUploadErrors(errors)
    setUploadJob(null)
    setZipReview(null)
    setZipSelectedPaths([])

    if (!files.length) return

    const zipFiles = files.filter((file) => getExtension(file.name) === 'zip')

    if (zipFiles.length > 0) {
      if (files.length > 1 || zipFiles.length > 1) {
        setUploadErrors((current) => [
          ...current,
          'Review one ZIP archive at a time. Upload other files in a separate session.',
        ])
        return
      }

      setIsSaving(true)
      try {
        const manifest = await getZipManifest(organizationId, zipFiles[0])
        const defaultPaths = (manifest.entries ?? [])
          .filter((entry) => entry.selectable)
          .slice(0, MAX_FILES_PER_BATCH)
          .map((entry) => entry.path)

        setZipReview({ archive: zipFiles[0], manifest })
        setZipSelectedPaths(defaultPaths)
        notifications.info('ZIP file opened. Review files before saving.')
      } catch (requestError) {
        setError(requestError)
        notifications.error(
          getDocumentErrorMessage(
            requestError,
            'We could not open this ZIP file. Check the file and try again.',
          ),
        )
      } finally {
        setIsSaving(false)
      }

      return
    }

    setIsSaving(true)
    try {
      const session = await stageOrganizationDocuments(organizationId, files)
      const visibleSession = normalizeUploadSession(session)
      setUploadSession(visibleSession)
      setUploadJob(null)
      setIsUploadLocationModalOpen(Boolean(visibleSession?.files?.length))
      notifications.success(
        `${visibleSession?.files.length ?? 0} file(s) ready for review.`,
      )
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not prepare these files. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStageZip() {
    if (!zipReview || zipSelectedPaths.length === 0) return

    setIsSaving(true)
    setError(null)

    try {
      const session = await stageZipOrganizationDocuments(
        organizationId,
        zipReview.archive,
        zipSelectedPaths,
      )
      const visibleSession = normalizeUploadSession(session)
      setUploadSession(visibleSession)
      setUploadJob(null)
      setIsUploadLocationModalOpen(Boolean(visibleSession?.files?.length))
      setZipReview(null)
      setZipSelectedPaths([])
      notifications.success(`${visibleSession?.files.length ?? 0} ZIP file(s) ready for review.`)
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not prepare the selected ZIP files. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveStagedFile(file) {
    if (!uploadSession || uploadJobActive) return

    setIsSaving(true)
    setError(null)

    try {
      const session = await removeStagedDocumentFile(
        organizationId,
        uploadSession.id,
        file.id,
      )
      const nextSession = normalizeUploadSession(session)
      setUploadSession(nextSession)
      if (!nextSession) {
        setIsUploadLocationModalOpen(false)
      }
      setPreviewTarget((current) => (current?.id === file.id ? null : current))
      notifications.info(`${file.originalFilename} was removed.`)
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not remove this file. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCommitUpload() {
    if (!uploadSession) return

    if (knowledgeBases.length > 0 && !uploadKnowledgeBaseId) {
      notifications.error('Select a Knowledge Base before saving documents.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const job = await commitUploadSession(organizationId, uploadSession.id, {
        knowledgeBaseIds: uploadKnowledgeBaseId ? [uploadKnowledgeBaseId] : undefined,
        collectionIds: uploadCollectionId ? [uploadCollectionId] : undefined,
        tagIds: uploadTagIds.length > 0 ? uploadTagIds : undefined,
      })
      setUploadJob(job)
      setIsUploadLocationModalOpen(false)
      notifications.info('Saving started. Progress will update automatically.')
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not start saving these files. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateUploadCollection() {
    if (!organizationId || !uploadKnowledgeBaseId || isPlatform) return

    const name = newCollectionName.trim().replace(/\s+/g, ' ')
    if (name.length < 2) {
      setNewCollectionError('Enter a collection name with at least 2 characters.')
      return
    }

    if (!/^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/.test(name)) {
      setNewCollectionError('Use letters, numbers, and single spaces only.')
      return
    }

    setIsCreatingCollection(true)
    setNewCollectionError('')
    setError(null)

    try {
      const collection = await createKnowledgeBaseCollection(
        organizationId,
        uploadKnowledgeBaseId,
        { name },
      )
      setKnowledgeBaseCollections((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== collection.id)
        return [collection, ...withoutDuplicate]
      })
      setUploadCollectionId(collection.id)
      setNewCollectionName('')
      notifications.success(`${collection.name} was created and selected.`)
    } catch (requestError) {
      const message = getDocumentErrorMessage(
        requestError,
        'We could not create this collection. Please try a different name.',
      )
      setNewCollectionError(message)
      notifications.error(message)
    } finally {
      setIsCreatingCollection(false)
    }
  }

  async function handleCreateUploadTag() {
    if (!organizationId || isPlatform) return

    const name = newTagName.trim().replace(/\s+/g, ' ')
    if (name.length < 2) {
      setNewTagError('Enter a tag with at least 2 characters.')
      return
    }

    if (!/^[A-Za-z0-9]+(?:[- ][A-Za-z0-9]+)*$/.test(name)) {
      setNewTagError('Use letters, numbers, spaces, or hyphens only.')
      return
    }

    setIsCreatingTag(true)
    setNewTagError('')
    setError(null)

    try {
      const tag = await createKnowledgeBaseTag(organizationId, { name })
      setKnowledgeBaseTags((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== tag.id)
        return [tag, ...withoutDuplicate]
      })
      setUploadTagIds((current) =>
        current.includes(tag.id) ? current : [...current, tag.id],
      )
      setNewTagName('')
      notifications.success(`${tag.name} was added.`)
    } catch (requestError) {
      const message = getDocumentErrorMessage(
        requestError,
        'We could not add this tag. Please try a different name.',
      )
      setNewTagError(message)
      notifications.error(message)
    } finally {
      setIsCreatingTag(false)
    }
  }

  function toggleUploadTag(tagId) {
    setUploadTagIds((current) =>
      current.includes(tagId)
        ? current.filter((currentTagId) => currentTagId !== tagId)
        : [...current, tagId],
    )
  }

  async function handleCreateUploadKnowledgeBase() {
    if (!organizationId || isPlatform) return

    const name = newKnowledgeBaseName.trim().replace(/\s+/g, ' ')
    if (name.length < 2) {
      setNewKnowledgeBaseError('Enter a Knowledge Base name with at least 2 characters.')
      return
    }

    if (!/^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/.test(name)) {
      setNewKnowledgeBaseError('Use letters, numbers, and single spaces only.')
      return
    }

    setIsCreatingKnowledgeBase(true)
    setNewKnowledgeBaseError('')
    setError(null)

    try {
      const knowledgeBase = await createKnowledgeBase(organizationId, { name })
      setKnowledgeBases((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== knowledgeBase.id)
        return [knowledgeBase, ...withoutDuplicate]
      })
      setUploadKnowledgeBaseId(knowledgeBase.id)
      setUploadCollectionId('')
      setNewKnowledgeBaseName('')
      notifications.success(`${knowledgeBase.name} was created and selected.`)
    } catch (requestError) {
      const message = getDocumentErrorMessage(
        requestError,
        'We could not create this Knowledge Base. Please try a different name.',
      )
      setNewKnowledgeBaseError(message)
      notifications.error(message)
    } finally {
      setIsCreatingKnowledgeBase(false)
    }
  }

  async function openDocumentPreview(document) {
    try {
      const preview = isPlatform
        ? await getPlatformDocumentPreview(document.id)
        : await getDocumentPreview(organizationId, document.id)

      setPreviewTarget({
        ...document,
        contentUrl: isPlatform
          ? getPlatformDocumentContentUrl(document.id)
          : getOrganizationDocumentContentUrl(organizationId, document.id),
        preview,
      })
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not open the preview. Download the file to view it.',
        ),
      )
    }
  }

  function openStagedPreview(file) {
    if (!uploadSession) return

    setPreviewTarget({
      ...file,
      contentUrl: getStagedFileContentUrl(organizationId, uploadSession.id, file.id),
    })
  }

  function openDownload(document) {
    const url = isPlatform
      ? getPlatformDocumentContentUrl(document.id)
      : getOrganizationDocumentDownloadUrl(organizationId, document.id)

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function openVersions(document) {
    if (isPlatform) return

    setVersionTarget(document)
    setVersions([])
    setVersionsLoading(true)

    try {
      setVersions(await getDocumentVersions(organizationId, document.id))
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not load version history. Please try again.',
        ),
      )
    } finally {
      setVersionsLoading(false)
    }
  }

  async function handleUploadVersion(file) {
    if (!versionTarget) return

    setIsSaving(true)
    setError(null)

    try {
      const updated = await uploadDocumentVersion(
        organizationId,
        versionTarget.id,
        file,
      )
      notifications.success(`${updated.name} was updated with a new version.`)
      await openVersions(updated)
      await loadDocuments()
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not upload the new version. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRestore(document) {
    setIsSaving(true)
    setError(null)

    try {
      if (isPlatform) {
        await restorePlatformDocument(document.id)
      } else {
        await restoreOrganizationDocument(organizationId, document.id)
      }

      notifications.success(`${document.name} was restored.`)
      await loadDocuments()
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          'We could not restore this file. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteDocument() {
    if (!deleteTarget) return

    setIsSaving(true)
    setError(null)

    try {
      if (isPlatform) {
        await purgePlatformDocument(deleteTarget.id)
        notifications.success(`${deleteTarget.name} was permanently deleted.`)
      } else {
        await deleteOrganizationDocument(organizationId, deleteTarget.id)
        notifications.success(`${deleteTarget.name} was deleted.`)
      }

      setDeleteTarget(null)
      await loadDocuments()
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentErrorMessage(
          requestError,
          isPlatform
            ? 'We could not permanently delete this file. Please try again.'
            : 'We could not delete this file. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Checking document access..." />
      </main>
    )
  }

  if (!canReadDocuments) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <h1>Documents are restricted</h1>
            <p>Your current role cannot access document management.</p>
          </div>
        </section>
      </main>
    )
  }

  if (!isPlatform && !organizationId) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <h1>Select an organization</h1>
            <p>Documents are stored inside one organization at a time.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page page--wide page--documents">
      <header className="page-header">
        <div>
          <h1>{isPlatform ? 'Platform documents' : 'Documents'}</h1>
          <p>
            {isPlatform
              ? 'Manage uploaded files, format conversions, and storage across all platform organizations.'
              : `Upload, preview, version, and manage files for ${selectedOrganization?.organization?.name ?? 'this organization'}.`}
          </p>
        </div>
        <RefreshIconButton
          disabled={isLoading}
          label="Refresh documents"
          onClick={() => void loadDocuments()}
        />
      </header>

      {error && (
        <Alert onDismiss={() => setError(null)}>
          {getDocumentErrorMessage(
            error,
            'Something went wrong. Please try again.',
          )}
        </Alert>
      )}
      {uploadErrors.length > 0 && (
        <Alert
          autoDismissMs={6500}
          onDismiss={() => setUploadErrors([])}
          tone="warning"
        >
          {uploadErrors.join(' ')}
        </Alert>
      )}
      {knowledgeBaseError && canUploadDocuments && (
        <Alert
          autoDismissMs={6500}
          onDismiss={() => setKnowledgeBaseError(null)}
          tone="warning"
        >
          Knowledge Base options could not be loaded. Documents will be saved to
          the default Knowledge Base.
        </Alert>
      )}

      {canUploadDocuments && (
        <>
          <section
            className={`document-dropzone ${isDragging ? 'document-dropzone--active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              void processSelectedFiles(event.dataTransfer.files)
            }}
            role="button"
            tabIndex={0}
          >
            <input
              accept={ACCEPTED_FILE_TYPES}
              className="visually-hidden"
              multiple
              onChange={(event) => {
                void processSelectedFiles(event.target.files)
                event.target.value = ''
              }}
              ref={fileInputRef}
              type="file"
            />
            <div className="file-icon file-icon--large" aria-hidden="true">
              <DocumentUiIcon name="upload" size={26} />
            </div>
            <div className="document-dropzone__copy">
              <div className="document-dropzone__title">
                <h2>Drop files or browse</h2>
                <span
                  aria-label={`Supported: ${supportedFileTypes}. 10 MB per file. Maximum ${MAX_FILES_PER_BATCH} files at a time. ZIP files are reviewed before saving.`}
                  className="info-tooltip"
                  role="img"
                  tabIndex={0}
                >
                  i
                  <span className="info-tooltip__content" role="tooltip">
                    Supported: {supportedFileTypes}. 10 MB per file. Max{' '}
                    {MAX_FILES_PER_BATCH} files at a time. ZIP files are reviewed
                    before saving.
                  </span>
                </span>
              </div>
              <p>Choose files, preview them, then save when everything looks right.</p>
            </div>
          </section>
        </>
      )}

      {!isPlatform && !canUploadDocuments && (
        <section className="card document-permission-note">
          <span aria-hidden="true" className="file-icon">
            <DocumentUiIcon name="lock" size={18} />
          </span>
          <div>
            <h2>Upload is not available for your current role</h2>
            <p>
              You can view documents, but your role does not allow uploads.
              Ask an Organization Admin or Super Admin if you need upload
              access.
            </p>
          </div>
        </section>
      )}

      <ZipReview
        isSaving={isSaving}
        onCancel={() => {
          setZipReview(null)
          setZipSelectedPaths([])
        }}
        onSelectPaths={setZipSelectedPaths}
        onStage={() => void handleStageZip()}
        selectedPaths={zipSelectedPaths}
        zipReview={zipReview}
      />

      <UploadSessionCard
        isSaving={isSaving}
        onCommit={() => void handleCommitUpload()}
        onPreview={openStagedPreview}
        onRemoveFile={(file) => void handleRemoveStagedFile(file)}
        session={uploadSession}
        uploadJob={uploadJob}
      />

      <UploadLocationModal
        collectionId={uploadCollectionId}
        collectionCreateError={newCollectionError}
        collectionCreateName={newCollectionName}
        collections={knowledgeBaseCollections}
        createError={newKnowledgeBaseError}
        createName={newKnowledgeBaseName}
        isCreatingCollection={isCreatingCollection}
        isCreatingKnowledgeBase={isCreatingKnowledgeBase}
        isCreatingTag={isCreatingTag}
        isLoading={knowledgeBaseLoading}
        isOpen={isUploadLocationModalOpen && Boolean(uploadSession) && !uploadJobActive}
        isSaving={isSaving}
        knowledgeBaseId={uploadKnowledgeBaseId}
        knowledgeBases={knowledgeBases}
        newTagName={newTagName}
        onChangeCollection={setUploadCollectionId}
        onChangeCollectionCreateName={(value) => {
          setNewCollectionName(value)
          setNewCollectionError('')
        }}
        onChangeCreateName={(value) => {
          setNewKnowledgeBaseName(value)
          setNewKnowledgeBaseError('')
        }}
        onChangeKnowledgeBase={setUploadKnowledgeBaseId}
        onChangeNewTagName={(value) => {
          setNewTagName(value)
          setNewTagError('')
        }}
        onCreateKnowledgeBase={() => void handleCreateUploadKnowledgeBase()}
        onCreateCollection={() => void handleCreateUploadCollection()}
        onCreateTag={() => void handleCreateUploadTag()}
        onClose={() => setIsUploadLocationModalOpen(false)}
        onSave={() => void handleCommitUpload()}
        onToggleTag={toggleUploadTag}
        selectedTagIds={uploadTagIds}
        stagedCount={getVisibleStagedFiles(uploadSession).length}
        tags={knowledgeBaseTags}
        tagCreateError={newTagError}
      />

      <UploadJobProgressCard
        job={uploadJob}
        onDismiss={() => {
          if (!uploadJobActive) setUploadJob(null)
        }}
      />

      <section className="card">
        <div className="table-toolbar">
          <div className="table-toolbar__search">
            <input
              aria-label="Search documents"
              className="table-toolbar__input"
              onChange={(event) =>
                updateFilters({ search: event.target.value })
              }
              placeholder="Search by file name, uploader..."
              type="search"
              value={filters.search}
            />
          </div>
          <div className="table-toolbar__filters">
            {isPlatform ? (
              <>
                <select
                  aria-label="Organization"
                  className="table-toolbar__select"
                  onChange={(event) =>
                    updateFilters({
                      organizationId: event.target.value,
                    })
                  }
                  value={filters.organizationId}
                >
                  <option value="">All organizations</option>
                  {(access?.organizations ?? []).map(({ organization }) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Status"
                  className="table-toolbar__select"
                  onChange={(event) =>
                    updateFilters({
                      status: event.target.value,
                    })
                  }
                  value={filters.status}
                >
                  <option value="">All non-purged</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SOFT_DELETED_BY_USER">User deleted</option>
                  <option value="SOFT_DELETED_BY_ORG">Org deleted</option>
                  <option value="PURGED">Purged</option>
                </select>
                <select
                  aria-label="Updated"
                  className="table-toolbar__select"
                  onChange={(event) =>
                    updateFilters({
                      updatedRange: event.target.value,
                    })
                  }
                  value={filters.updatedRange}
                >
                  <option value="">Any time</option>
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7d</option>
                  <option value="30d">Last 30d</option>
                </select>
                <select
                  aria-label="Sort"
                  className="table-toolbar__select"
                  onChange={(event) =>
                    updateFilters({ sort: event.target.value })
                  }
                  value={filters.sort}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </>
            ) : (
              <>
                <select
                  aria-label="File status"
                  className="table-toolbar__select"
                  onChange={(event) =>
                    updateFilters({ view: event.target.value })
                  }
                  value={filters.view}
                >
                  <option value="active">Active files</option>
                  <option value="trash">Trash</option>
                </select>
                <select
                  aria-label="Updated time"
                  className="table-toolbar__select"
                  onChange={(event) =>
                    updateFilters({
                      updatedRange: event.target.value,
                    })
                  }
                  value={filters.updatedRange}
                >
                  <option value="">Any time</option>
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7d</option>
                  <option value="30d">Last 30d</option>
                </select>
                <select
                  aria-label="Sort"
                  className="table-toolbar__select"
                  onChange={(event) =>
                    updateFilters({ sort: event.target.value })
                  }
                  value={filters.sort}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </>
            )}
            <span className="table-toolbar__counter">
              {documentCount} {documentCount === 1 ? 'document' : 'documents'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <Loader label="Loading documents..." />
        ) : documents.length ? (
          <div
            className={`data-table document-table ${
              isPlatform ? 'document-table--platform' : ''
            }`}
            role="table"
          >
            <div className="data-table__row data-table__row--head" role="row">
              <span role="columnheader">File</span>
              {isPlatform && <span role="columnheader">Organization</span>}
              <span role="columnheader">Type</span>
              <span role="columnheader">Size</span>
              <span role="columnheader">Uploaded by</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Updated</span>
              <span role="columnheader">Actions</span>
            </div>

            {documents.map((document) => (
              <article className="data-table__row" key={document.id} role="row">
                <span
                  className="document-cell document-cell--file"
                  data-label="File"
                  role="cell"
                >
                  <span className="file-icon" aria-hidden="true">
                    {document.extension?.slice(0, 3).toUpperCase() || 'DOC'}
                  </span>
                  <span>
                    <strong className="document-file-name" title={document.name}>
                      {document.name}
                    </strong>
                    <small title={document.originalFilename}>
                      {document.originalFilename}
                    </small>
                  </span>
                </span>
                {isPlatform && (
                  <span
                    className="document-cell document-cell--organization"
                    data-label="Organization"
                    role="cell"
                  >
                    <strong>{document.organization?.name ?? 'Unknown org'}</strong>
                    <small>{document.organization?.slug}</small>
                  </span>
                )}
                <span
                  className="document-cell document-cell--type"
                  data-label="Type"
                  role="cell"
                >
                  <strong>{(document.extension ?? 'file').toUpperCase()}</strong>
                  <small title={document.mimeType}>{document.mimeType}</small>
                </span>
                <span
                  className="document-cell document-cell--size"
                  data-label="Size"
                  role="cell"
                >
                  {formatBytes(document.sizeBytes)}
                </span>
                <span
                  className="document-cell document-cell--uploader"
                  data-label="Uploaded by"
                  role="cell"
                >
                  <strong>{getActorLabel(document.createdBy)}</strong>
                  <small>{document.createdBy?.email}</small>
                </span>
                <span
                  className="document-cell document-cell--status"
                  data-label="Status"
                  role="cell"
                >
                  <span
                    className={`status-badge status-badge--${getStatusTone(
                      document.status,
                    )}`}
                  >
                    {formatStatus(document.status)}
                  </span>
                </span>
                <span
                  className="document-cell document-cell--updated"
                  data-label="Updated"
                  role="cell"
                >
                  {formatDate(document.updatedAt)}
                </span>
                <span
                  className="inline-actions document-cell document-cell--actions"
                  data-label="Actions"
                  role="cell"
                >
                  <DocumentActionButton
                    icon="preview"
                    label="Preview"
                    onClick={() => void openDocumentPreview(document)}
                  />
                  {canDownloadDocuments && (
                    <DocumentActionButton
                      icon={isPlatform ? 'open' : 'download'}
                      label={isPlatform ? 'Open' : 'Download'}
                      onClick={() => openDownload(document)}
                    />
                  )}
                  {!isPlatform && (
                    <DocumentActionButton
                      icon="versions"
                      label="Versions"
                      onClick={() => void openVersions(document)}
                    />
                  )}
                  {(document.userDeletedAt || document.orgDeletedAt) &&
                    canRestoreDocuments && (
                      <DocumentActionButton
                        disabled={isSaving}
                        icon="restore"
                        label="Restore"
                        onClick={() => void handleRestore(document)}
                      />
                    )}
                  {canDeleteDocuments && document.status !== 'PURGED' && (
                    <DocumentActionButton
                      disabled={isSaving}
                      icon="trash"
                      label={isPlatform ? 'Purge' : 'Delete'}
                      onClick={() => setDeleteTarget(document)}
                      variant="danger"
                    />
                  )}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyDocuments isPlatform={isPlatform} />
        )}

        <PaginationControls
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPage(1)
          }}
          pageSize={pageSize}
          pagination={pagination}
        />
      </section>

      <DocumentPreviewModal
        item={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      <VersionsModal
        canUploadVersion={canUploadVersion}
        document={versionTarget}
        isLoading={versionsLoading}
        isSaving={isSaving}
        onClose={() => setVersionTarget(null)}
        onUploadVersion={handleUploadVersion}
        versions={versions}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isSaving && setDeleteTarget(null)}
        title={isPlatform ? 'Permanently delete document?' : 'Delete document?'}
      >
        {error && (
          <Alert>
            {getDocumentErrorMessage(
              error,
              'Something went wrong. Please try again.',
            )}
          </Alert>
        )}
        <p>
          {isPlatform
            ? 'This permanently removes the file. Use it only after platform review.'
            : 'This removes the file from the organization view. A platform reviewer can still restore or permanently delete it later.'}
        </p>
        <p>
          Target: <strong>{deleteTarget?.name}</strong>
        </p>
        <div className="form-actions">
          <Button
            disabled={isSaving}
            onClick={() => setDeleteTarget(null)}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => void handleDeleteDocument()}
            variant="danger"
          >
            {isSaving
              ? isPlatform
                ? 'Purging...'
                : 'Deleting...'
              : isPlatform
                ? 'Permanently delete'
                : 'Delete document'}
          </Button>
        </div>
      </Modal>
    </main>
  )
}
