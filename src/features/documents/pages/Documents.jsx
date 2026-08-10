import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { isSuperAdminAccess } from '../../../shared/utils/accessDisplay.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  commitUploadSession,
  deleteOrganizationDocument,
  getDocumentPreview,
  getDocumentVersions,
  getOrganizationDocumentContentUrl,
  getOrganizationDocumentDownloadUrl,
  getPlatformDocumentContentUrl,
  getStagedFileContentUrl,
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
const ACCEPTED_FILE_TYPES = ALLOWED_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(',')
const DOCUMENT_STATUS_LABELS = {
  ACTIVE: 'active',
  PURGED: 'purged',
  SOFT_DELETED_BY_ORG: 'organization deleted',
  SOFT_DELETED_BY_USER: 'user deleted',
}
const HIDDEN_STAGED_FILE_STATUSES = new Set(['COMMITTED', 'REMOVED'])
const UPDATED_RANGE_DAYS = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
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

function getUpdatedRangeCutoff(range) {
  const days = UPDATED_RANGE_DAYS[range]

  if (!days) return null

  return Date.now() - days * 24 * 60 * 60 * 1000
}

function isInsideUpdatedRange(document, range) {
  const cutoff = getUpdatedRangeCutoff(range)

  if (!cutoff) return true
  if (!document.updatedAt) return false

  return new Date(document.updatedAt).getTime() >= cutoff
}

function sortDocumentsByUpdatedAt(documents, sortDirection) {
  const direction = sortDirection === 'oldest' ? 1 : -1

  return [...documents].sort((first, second) => {
    const firstTime = first.updatedAt ? new Date(first.updatedAt).getTime() : 0
    const secondTime = second.updatedAt ? new Date(second.updatedAt).getTime() : 0

    return (firstTime - secondTime) * direction
  })
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

function isImageMime(mimeType = '') {
  return mimeType.startsWith('image/')
}

function isPdfMime(mimeType = '') {
  return mimeType === 'application/pdf'
}

function renderPreviewBody(preview, contentUrl, mimeType) {
  if (!preview) {
    return (
      <section className="empty-state empty-state--compact">
        <div>
          <h2>No preview data</h2>
          <p>The file is stored, but no preview metadata was returned.</p>
        </div>
      </section>
    )
  }

  if (preview.kind === 'binary' && preview.previewAvailable) {
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
        This file opens in the browser preview endpoint. Use Open preview to
        review it in a new tab.
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
      {preview.message ?? 'Preview is not available for this file type.'}
    </Alert>
  )
}

function DocumentPreviewModal({ item, onClose }) {
  if (!item) return null

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
        {renderPreviewBody(item.preview, item.contentUrl, item.mimeType)}
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
              <p>The backend did not return version history for this file.</p>
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
            Unsupported, encrypted, nested, or oversized files cannot be staged.
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
          {isSaving ? 'Staging...' : 'Stage selected files'}
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
}) {
  if (!session) return null
  const stagedFiles = getVisibleStagedFiles(session)

  return (
    <section className="card document-upload-card">
      <div className="section-heading">
        <div>
          <span className="card__label">Review before saving</span>
          <h2>Staged files ({stagedFiles.length}/{MAX_FILES_PER_BATCH})</h2>
          <p>
            Preview each file and remove anything incorrect before creating
            permanent document records.
          </p>
        </div>
        <Button
          disabled={isSaving || stagedFiles.length === 0}
          onClick={onCommit}
        >
          {isSaving ? 'Saving...' : 'Save documents'}
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
                disabled={isSaving}
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
  const [pagination, setPagination] = useState(null)
  const [previewTarget, setPreviewTarget] = useState(null)
  const [uploadErrors, setUploadErrors] = useState([])
  const [uploadSession, setUploadSession] = useState(null)
  const [versionTarget, setVersionTarget] = useState(null)
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [zipReview, setZipReview] = useState(null)
  const [zipSelectedPaths, setZipSelectedPaths] = useState([])

  const supportedFileTypes = useMemo(
    () => ALLOWED_EXTENSIONS.map((extension) => extension.toUpperCase()).join(', '),
    [],
  )
  const visibleDocuments = useMemo(
    () =>
      sortDocumentsByUpdatedAt(
        documents.filter((document) =>
          isInsideUpdatedRange(document, filters.updatedRange),
        ),
        filters.sort,
      ),
    [documents, filters.sort, filters.updatedRange],
  )
  const documentCount = filters.updatedRange
    ? visibleDocuments.length
    : pagination?.total ?? visibleDocuments.length

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
            page: 1,
            pageSize: 50,
            search: filters.search.trim(),
            status: filters.status,
          })
        : await listOrganizationDocuments(organizationId, {
            page: 1,
            pageSize: 50,
            search: filters.search.trim(),
            view: filters.view,
          })

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
    filters.status,
    filters.view,
    isPlatform,
    organizationId,
  ])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDocuments()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadDocuments])

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
        notifications.info('ZIP manifest loaded. Review files before staging.')
      } catch (requestError) {
        setError(requestError)
        notifications.error(requestError.message)
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
      notifications.success(
        `${visibleSession?.files.length ?? 0} file(s) staged for review.`,
      )
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
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
      setZipReview(null)
      setZipSelectedPaths([])
      notifications.success(`${visibleSession?.files.length ?? 0} ZIP file(s) staged.`)
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveStagedFile(file) {
    if (!uploadSession) return

    setIsSaving(true)
    setError(null)

    try {
      const session = await removeStagedDocumentFile(
        organizationId,
        uploadSession.id,
        file.id,
      )
      setUploadSession(normalizeUploadSession(session))
      setPreviewTarget((current) => (current?.id === file.id ? null : current))
      notifications.info(`${file.originalFilename} was removed from staging.`)
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCommitUpload() {
    if (!uploadSession) return

    setIsSaving(true)
    setError(null)

    try {
      const result = await commitUploadSession(organizationId, uploadSession.id)
      setUploadSession(null)
      await loadDocuments()
      notifications.success(
        `${result.documents?.length ?? 0} document(s) saved successfully.`,
      )
      if (result.warnings?.length) {
        notifications.info(
          `${result.warnings.length} duplicate warning(s) were returned.`,
        )
      }
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function openDocumentPreview(document) {
    const preview = document.latestVersion?.preview
      ? document.latestVersion.preview
      : !isPlatform
        ? await getDocumentPreview(organizationId, document.id)
        : null

    setPreviewTarget({
      ...document,
      contentUrl: isPlatform
        ? getPlatformDocumentContentUrl(document.id)
        : getOrganizationDocumentContentUrl(organizationId, document.id),
      preview,
    })
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
      notifications.error(requestError.message)
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
      notifications.error(requestError.message)
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
      notifications.error(requestError.message)
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
      notifications.error(requestError.message)
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
            <p className="eyebrow">Role required</p>
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
            <p className="eyebrow">Organization required</p>
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
          <p className="eyebrow">
            {isPlatform ? 'Platform review' : 'File management'}
          </p>
          <h1>{isPlatform ? 'Platform documents' : 'Documents'}</h1>
          <p>
            {isPlatform
              ? 'Review organization-deleted files and permanently purge storage only when required.'
              : `Upload, preview, version, and manage files for ${selectedOrganization.organization.name}.`}
          </p>
        </div>
        <RefreshIconButton
          disabled={isLoading}
          label="Refresh documents"
          onClick={() => void loadDocuments()}
        />
      </header>

      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}
      {uploadErrors.length > 0 && (
        <Alert
          autoDismissMs={6500}
          onDismiss={() => setUploadErrors([])}
          tone="warning"
        >
          {uploadErrors.join(' ')}
        </Alert>
      )}

      {canUploadDocuments && (
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
                aria-label={`Supported: ${supportedFileTypes}. 10 MB per file. Maximum ${MAX_FILES_PER_BATCH} files per staging session. ZIP files are reviewed before staging.`}
                className="info-tooltip"
                role="img"
                tabIndex={0}
              >
                i
                <span className="info-tooltip__content" role="tooltip">
                  Supported: {supportedFileTypes}. 10 MB per file. Max{' '}
                  {MAX_FILES_PER_BATCH} files per staging session. ZIP files are
                  reviewed before staging.
                </span>
              </span>
            </div>
            <p>Upload files for preview before saving.</p>
          </div>
        </section>
      )}

      {!isPlatform && !canUploadDocuments && (
        <section className="card document-permission-note">
          <span aria-hidden="true" className="file-icon">
            <DocumentUiIcon name="lock" size={18} />
          </span>
          <div>
            <h2>Upload is not available for your current role</h2>
            <p>
              You can view documents, but uploading requires the
              documents.upload permission. Ask an Organization Admin or Super
              Admin to update your role if you need upload access.
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
      />

      <section
        className={`card filter-bar document-filter-bar ${
          isPlatform ? 'document-filter-bar--platform' : ''
        }`}
      >
        <Input
          label="Search documents"
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder="file, uploader, organization..."
          value={filters.search}
        />
        {isPlatform ? (
          <>
            <label className="field">
              <span className="field__label">Organization</span>
              <select
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    organizationId: event.target.value,
                  }))
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
            </label>
            <label className="field">
              <span className="field__label">Status</span>
              <select
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                value={filters.status}
              >
                <option value="">All non-purged</option>
                <option value="ACTIVE">Active</option>
                <option value="SOFT_DELETED_BY_USER">User deleted</option>
                <option value="SOFT_DELETED_BY_ORG">Organization deleted</option>
                <option value="PURGED">Purged</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Updated</span>
              <select
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    updatedRange: event.target.value,
                  }))
                }
                value={filters.updatedRange}
              >
                <option value="">Any time</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Sort</span>
              <select
                onChange={(event) =>
                  setFilters((current) => ({ ...current, sort: event.target.value }))
                }
                value={filters.sort}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span className="field__label">Status</span>
              <select
                onChange={(event) =>
                  setFilters((current) => ({ ...current, view: event.target.value }))
                }
                value={filters.view}
              >
                <option value="active">Active files</option>
                <option value="trash">Organization trash</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Updated</span>
              <select
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    updatedRange: event.target.value,
                  }))
                }
                value={filters.updatedRange}
              >
                <option value="">Any time</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Sort</span>
              <select
                onChange={(event) =>
                  setFilters((current) => ({ ...current, sort: event.target.value }))
                }
                value={filters.sort}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <span className="card__label">File directory</span>
            <h2>{documentCount} documents</h2>
          </div>
        </div>

        {isLoading ? (
          <Loader label="Loading documents..." />
        ) : visibleDocuments.length ? (
          <div
            className={`data-table document-table ${
              isPlatform ? 'document-table--platform' : ''
            }`}
            role="table"
          >
            <div className="data-table__row data-table__row--head" role="row">
              <span role="columnheader">File</span>
              {isPlatform && <span role="columnheader">Organization</span>}
              <span role="columnheader">Uploaded by</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Updated</span>
              <span role="columnheader">Actions</span>
            </div>

            {visibleDocuments.map((document) => (
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
                    <strong>{document.name}</strong>
                    <small>
                      {document.originalFilename} - {formatBytes(document.sizeBytes)}
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
                  <Button
                    onClick={() => void openDocumentPreview(document)}
                    variant="secondary"
                  >
                    <DocumentUiIcon name="preview" size={14} /> Preview
                  </Button>
                  {canDownloadDocuments && (
                    <Button onClick={() => openDownload(document)} variant="secondary">
                      <DocumentUiIcon
                        name={isPlatform ? 'open' : 'download'}
                        size={14}
                      />
                      {isPlatform ? 'Open' : 'Download'}
                    </Button>
                  )}
                  {!isPlatform && (
                    <Button
                      onClick={() => void openVersions(document)}
                      variant="secondary"
                    >
                      <DocumentUiIcon name="versions" size={14} /> Versions
                    </Button>
                  )}
                  {(document.userDeletedAt || document.orgDeletedAt) &&
                    canRestoreDocuments && (
                      <Button
                        disabled={isSaving}
                        onClick={() => void handleRestore(document)}
                        variant="secondary"
                      >
                        <DocumentUiIcon name="restore" size={14} /> Restore
                      </Button>
                    )}
                  {canDeleteDocuments && document.status !== 'PURGED' && (
                    <Button
                      disabled={isSaving}
                      onClick={() => setDeleteTarget(document)}
                      variant="danger"
                    >
                      <DocumentUiIcon name="trash" size={14} />
                      {isPlatform ? 'Purge' : 'Delete'}
                    </Button>
                  )}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyDocuments isPlatform={isPlatform} />
        )}
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
        {error && <Alert>{error.message}</Alert>}
        <p>
          {isPlatform
            ? 'This permanently removes the file content from storage. Use it only after platform review.'
            : 'This uses the backend soft-delete flow. Organization-level deletion sends files to platform review instead of purging storage.'}
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
