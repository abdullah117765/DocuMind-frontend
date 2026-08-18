import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { listOrganizationDocuments } from '../../documents/services/documentsApi.js'
import { useNavigate } from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import {
  addDocumentsToCollection,
  createKnowledgeBase,
  createKnowledgeBaseCollection,
  createKnowledgeBaseTag,
  deleteKnowledgeBase,
  getKnowledgeBase,
  listKnowledgeBaseCategories,
  listKnowledgeBaseCollections,
  listKnowledgeBaseFolders,
  listKnowledgeBases,
  listKnowledgeBaseTags,
  removeDocumentFromCollection,
} from '../services/knowledgeBasesApi.js'

const DETAIL_TABS = ['overview', 'documents', 'collections', 'tags', 'settings']
const KB_PAGE_SIZE = 4
const DOCUMENT_PAGE_SIZE = 10

function getFriendlyError(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDate(value) {
  if (!value) return 'Recently'

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  )
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function getActorLabel(user) {
  if (!user) return 'Unknown user'

  return user.name || user.email || 'Unknown user'
}

function getStatusLabel(status) {
  if (!status) return 'Ready'

  const normalized = String(status).toLowerCase()
  if (normalized.includes('failed')) return 'Needs attention'
  if (normalized.includes('pending')) return 'Preparing'
  if (normalized.includes('archived')) return 'Archived'
  if (normalized.includes('deleted')) return 'Deleted'
  if (normalized.includes('active') || normalized.includes('ready')) return 'Ready'

  return normalized.replace(/_/g, ' ')
}

function getStatusTone(status) {
  const normalized = String(status ?? '').toLowerCase()
  if (normalized.includes('failed') || normalized.includes('deleted')) return 'danger'
  if (normalized.includes('pending') || normalized.includes('preparing')) return 'warning'

  return 'success'
}

function getCollectionNames(document) {
  const collections = Array.isArray(document.collections) ? document.collections : []
  const names = collections.map((collection) => collection.name).filter(Boolean)

  return names.length ? names.join(', ') : 'No collection'
}

function KnowledgeIcon({ name = 'book', size = 18 }) {
  const props = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.9,
  }

  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
      {name === 'book' && (
        <>
          <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z" {...props} />
          <path d="M5 4.5A2.5 2.5 0 0 1 7.5 7H20" {...props} />
        </>
      )}
      {name === 'file' && (
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...props} />
          <path d="M14 3v5h5M9 13h6M9 17h4" {...props} />
        </>
      )}
      {name === 'collection' && (
        <>
          <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" {...props} />
          <path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5" {...props} />
        </>
      )}
      {name === 'folder' && <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" {...props} />}
      {name === 'tag' && (
        <>
          <path d="M20 10 12 2H5a3 3 0 0 0-3 3v7l8 8a2.8 2.8 0 0 0 4 0l6-6a2.8 2.8 0 0 0 0-4Z" {...props} />
          <path d="M7.5 7.5h.01" {...props} />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="7" {...props} />
          <path d="m20 20-3.5-3.5" {...props} />
        </>
      )}
      {name === 'back' && <path d="m15 18-6-6 6-6" {...props} />}
      {name === 'upload' && (
        <>
          <path d="M12 16V4M7 9l5-5 5 5M5 20h14" {...props} />
        </>
      )}
      {name === 'chat' && <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" {...props} />}
    </svg>
  )
}

function FileTypeBadge({ extension }) {
  return (
    <span className="kb-file-badge" title={extension || 'Document'}>
      {extension?.slice(0, 3).toUpperCase() || 'DOC'}
    </span>
  )
}

function DocumentRow({ action, document }) {
  const collectionNames = getCollectionNames(document)

  return (
    <article className="kb-document-row">
      <div className="kb-document-row__file">
        <FileTypeBadge extension={document.extension} />
        <div>
          <strong title={document.name}>{document.name}</strong>
          <small title={document.originalFilename || document.name}>
            {document.originalFilename || document.name}
          </small>
        </div>
      </div>
      <span className="kb-document-row__collection" title={collectionNames}>
        <KnowledgeIcon name="collection" size={14} />
        {collectionNames}
      </span>
      <span className="kb-document-row__meta" title={getActorLabel(document.createdBy)}>
        {getActorLabel(document.createdBy)}
      </span>
      <span className="kb-document-row__meta">{formatBytes(document.sizeBytes)}</span>
      <span className={`status-badge status-badge--${getStatusTone(document.status)}`}>
        {getStatusLabel(document.status)}
      </span>
      <span className="kb-document-row__meta">{formatDate(document.updatedAt)}</span>
      {action && <span className="kb-document-row__actions">{action}</span>}
    </article>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <article className="kb-stat-card">
      <span>
        <KnowledgeIcon name={icon} size={18} />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  )
}

export function KnowledgeBases() {
  const navigate = useNavigate()
  const { hasPermission, selectedOrganization } = useAccessControl()
  const notifications = useNotifications()
  const organizationId = selectedOrganization?.organization.id ?? ''
  const organizationName = selectedOrganization?.organization.name ?? 'this organization'
  const canReadDocuments = hasPermission('documents.read')
  const canManageKnowledgeBases =
    hasPermission('documents.upload') || hasPermission('documents.update')

  const [activeTab, setActiveTab] = useState('overview')
  const [categories, setCategories] = useState([])
  const [collections, setCollections] = useState([])
  const [documents, setDocuments] = useState([])
  const [documentPage, setDocumentPage] = useState(1)
  const [documentPageSize, setDocumentPageSize] = useState(DOCUMENT_PAGE_SIZE)
  const [documentPagination, setDocumentPagination] = useState(null)
  const [error, setError] = useState(null)
  const [folders, setFolders] = useState([])
  const [form, setForm] = useState({ description: '', name: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [isCollectionSaving, setIsCollectionSaving] = useState(false)
  const [isDeletingKnowledgeBase, setIsDeletingKnowledgeBase] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isTagSaving, setIsTagSaving] = useState(false)
  const [kbPage, setKbPage] = useState(1)
  const [kbPageSize, setKbPageSize] = useState(KB_PAGE_SIZE)
  const [knowledgeBases, setKnowledgeBases] = useState([])
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [selectedCollectionDocumentIds, setSelectedCollectionDocumentIds] =
    useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [collectionForm, setCollectionForm] = useState({
    description: '',
    name: '',
  })
  const [tagForm, setTagForm] = useState({ name: '' })
  const [tags, setTags] = useState([])

  const selectedKnowledgeBaseId = selectedKnowledgeBase?.id ?? ''
  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  )

  const loadKnowledgeBases = useCallback(async () => {
    if (!organizationId || !canReadDocuments) {
      setKnowledgeBases([])
      setPagination(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await listKnowledgeBases(organizationId, {
        page: kbPage,
        pageSize: kbPageSize,
        search: search.trim(),
      })
      setKnowledgeBases(data.knowledgeBases ?? [])
      setPagination(data.pagination ?? null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [canReadDocuments, kbPage, kbPageSize, organizationId, search])

  const loadKnowledgeBaseDetail = useCallback(
    async (knowledgeBaseId) => {
      if (!organizationId || !knowledgeBaseId) return

      setIsDetailLoading(true)
      setError(null)

      try {
        const [detail, collectionList, folderList, documentList, categoryList, tagList] =
          await Promise.all([
            getKnowledgeBase(organizationId, knowledgeBaseId),
            listKnowledgeBaseCollections(organizationId, knowledgeBaseId),
            listKnowledgeBaseFolders(organizationId, knowledgeBaseId),
            listOrganizationDocuments(organizationId, {
              knowledgeBaseId,
              page: documentPage,
              pageSize: documentPageSize,
              sort: 'newest',
              view: 'active',
            }),
            listKnowledgeBaseCategories(organizationId),
            listKnowledgeBaseTags(organizationId),
          ])

        setSelectedKnowledgeBase(detail)
        setCollections(collectionList)
        setFolders(folderList)
        setDocuments(documentList.documents ?? [])
        setDocumentPagination(documentList.pagination ?? null)
        setCategories(categoryList)
        setTags(tagList)
      } catch (requestError) {
        setError(requestError)
      } finally {
        setIsDetailLoading(false)
      }
    },
    [documentPage, documentPageSize, organizationId],
  )

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadKnowledgeBases()
    }, 250)

    return () => window.clearTimeout(handle)
  }, [loadKnowledgeBases])

  useEffect(() => {
    if (!selectedKnowledgeBaseId) return
    void loadKnowledgeBaseDetail(selectedKnowledgeBaseId)
  }, [loadKnowledgeBaseDetail, selectedKnowledgeBaseId])

  const visibleTags = useMemo(
    () =>
      tags
        .map((tag) => ({
          ...tag,
          count: tag.counts?.documents ?? tag.documentCount ?? 0,
        }))
        .slice(0, 18),
    [tags],
  )

  const visibleCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          count: category.counts?.documents ?? category.documentCount ?? 0,
        }))
        .slice(0, 12),
    [categories],
  )

  useEffect(() => {
    if (
      selectedCollectionId &&
      !collections.some((collection) => collection.id === selectedCollectionId)
    ) {
      setSelectedCollectionId('')
      setSelectedCollectionDocumentIds([])
    }
  }, [collections, selectedCollectionId])

  async function handleCreateKnowledgeBase(event) {
    event.preventDefault()

    if (!form.name.trim()) {
      notifications.error('Enter a Knowledge Base name.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const knowledgeBase = await createKnowledgeBase(organizationId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      })

      setKnowledgeBases((current) => [knowledgeBase, ...current])
      setForm({ description: '', name: '' })
      setShowCreate(false)
      notifications.success('Knowledge Base created.')
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getFriendlyError(
          requestError,
          'We could not create this Knowledge Base. Please try again.',
        ),
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteEmptyKnowledgeBase() {
    if (!selectedKnowledgeBase || isDeletingKnowledgeBase) return

    setIsDeletingKnowledgeBase(true)
    setError(null)

    try {
      await deleteKnowledgeBase(organizationId, selectedKnowledgeBase.id)
      notifications.success('Knowledge Base and its contents were deleted.')
      backToLibrary()
      void loadKnowledgeBases()
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getFriendlyError(
          requestError,
          'We could not delete this Knowledge Base. Please try again.',
        ),
      )
    } finally {
      setIsDeletingKnowledgeBase(false)
    }
  }

  function toggleCollectionDocument(documentId) {
    setSelectedCollectionDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    )
  }

  async function handleCreateCollection(event) {
    event.preventDefault()

    if (!selectedKnowledgeBase) return

    const name = collectionForm.name.trim().replace(/\s+/g, ' ')
    const description = collectionForm.description.trim().replace(/\s+/g, ' ')

    if (!name) {
      notifications.error('Enter a Collection name.')
      return
    }

    setIsCollectionSaving(true)
    setError(null)

    try {
      const collection = await createKnowledgeBaseCollection(
        organizationId,
        selectedKnowledgeBase.id,
        {
          name,
          description: description || undefined,
        },
      )

      setCollectionForm({ description: '', name: '' })
      setSelectedCollectionId(collection.id)
      setSelectedCollectionDocumentIds([])
      notifications.success('Collection created.')
      await loadKnowledgeBaseDetail(selectedKnowledgeBase.id)
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getFriendlyError(
          requestError,
          'We could not create this Collection. Please try again.',
        ),
      )
    } finally {
      setIsCollectionSaving(false)
    }
  }

  async function handleCreateTag(event) {
    event.preventDefault()

    const name = tagForm.name.trim().replace(/\s+/g, ' ')

    if (!name) {
      notifications.error('Enter a tag name.')
      return
    }

    setIsTagSaving(true)
    setError(null)

    try {
      await createKnowledgeBaseTag(organizationId, { name })
      setTagForm({ name: '' })
      notifications.success('Tag created.')
      if (selectedKnowledgeBase) {
        await loadKnowledgeBaseDetail(selectedKnowledgeBase.id)
      }
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getFriendlyError(
          requestError,
          'We could not create this tag. Please try again.',
        ),
      )
    } finally {
      setIsTagSaving(false)
    }
  }

  async function handleAddDocumentsToCollection() {
    if (!selectedKnowledgeBase || !selectedCollection) return

    if (selectedCollectionDocumentIds.length === 0) {
      notifications.info('Select at least one document to add.')
      return
    }

    setIsCollectionSaving(true)
    setError(null)

    try {
      const result = await addDocumentsToCollection(
        organizationId,
        selectedKnowledgeBase.id,
        selectedCollection.id,
        selectedCollectionDocumentIds,
      )

      notifications.success(
        result.added > 0
          ? `${result.added} document${result.added === 1 ? '' : 's'} added to ${selectedCollection.name}.`
          : 'Selected documents are already in this Collection.',
      )
      setSelectedCollectionDocumentIds([])
      await loadKnowledgeBaseDetail(selectedKnowledgeBase.id)
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getFriendlyError(
          requestError,
          'We could not add documents to this Collection. Please try again.',
        ),
      )
    } finally {
      setIsCollectionSaving(false)
    }
  }

  async function handleRemoveDocumentFromCollection(collectionId, documentId) {
    if (!selectedKnowledgeBase || isCollectionSaving) return

    setIsCollectionSaving(true)
    setError(null)

    try {
      await removeDocumentFromCollection(
        organizationId,
        selectedKnowledgeBase.id,
        collectionId,
        documentId,
      )
      notifications.success('Document removed from Collection.')
      await loadKnowledgeBaseDetail(selectedKnowledgeBase.id)
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getFriendlyError(
          requestError,
          'We could not remove this document from the Collection. Please try again.',
        ),
      )
    } finally {
      setIsCollectionSaving(false)
    }
  }

  function openKnowledgeBase(knowledgeBase) {
    setSelectedKnowledgeBase(knowledgeBase)
    setActiveTab('overview')
    setDocumentPage(1)
    setSelectedCollectionId('')
    setSelectedCollectionDocumentIds([])
  }

  function backToLibrary() {
    setSelectedKnowledgeBase(null)
    setActiveTab('overview')
    setCollections([])
    setFolders([])
    setDocuments([])
    setDocumentPagination(null)
    setDocumentPage(1)
    setTags([])
    setCategories([])
    setSelectedCollectionId('')
    setSelectedCollectionDocumentIds([])
  }

  if (!organizationId) {
    return (
      <main className="page page--knowledge-bases">
        <section className="empty-state">
          <h1>Select an organization</h1>
          <p>Knowledge Bases are managed inside one organization at a time.</p>
        </section>
      </main>
    )
  }

  if (!canReadDocuments) {
    return (
      <main className="page page--knowledge-bases">
        <section className="empty-state">
          <h1>Knowledge Bases are not available</h1>
          <p>Your current role cannot view organization documents.</p>
        </section>
      </main>
    )
  }

  if (selectedKnowledgeBase) {
    const totalDocuments =
      selectedKnowledgeBase.counts?.documents ?? documentPagination?.total ?? documents.length
    const totalCollections =
      selectedKnowledgeBase.counts?.collections ?? collections.length
    const totalFolders = selectedKnowledgeBase.counts?.folders ?? folders.length

    return (
      <main className="page page--knowledge-bases page--kb-detail">
        <header className="kb-detail-topbar">
          <button className="kb-back-button" onClick={backToLibrary} type="button">
            <KnowledgeIcon name="back" size={16} />
            Knowledge Bases
          </button>
          <span aria-hidden="true" className="kb-crumb-divider">/</span>
          <strong title={selectedKnowledgeBase.name}>{selectedKnowledgeBase.name}</strong>
          <span className={`status-badge status-badge--${getStatusTone(selectedKnowledgeBase.status)}`}>
            {getStatusLabel(selectedKnowledgeBase.status)}
          </span>
        </header>

        {error && (
          <Alert onDismiss={() => setError(null)}>
            {getFriendlyError(error, 'Something went wrong. Please try again.')}
          </Alert>
        )}

        <div className="kb-detail-shell">
          <aside className="kb-folder-rail">
            <span className="card__label">Folders</span>
            <button className="kb-folder-item kb-folder-item--active" type="button">
              <span>
                <KnowledgeIcon name="file" size={14} /> All Documents
              </span>
              <strong>{totalDocuments}</strong>
            </button>
            {folders.length === 0 ? (
              <p className="kb-muted">No folders yet.</p>
            ) : (
              folders.map((folder) => (
                <button className="kb-folder-item" key={folder.id} type="button">
                  <span title={folder.name}>
                    <KnowledgeIcon name="folder" size={14} /> {folder.name}
                  </span>
                  <strong>{folder.counts?.documents ?? folder.documentCount ?? 0}</strong>
                </button>
              ))
            )}
          </aside>

          <section className="kb-detail-content">
            <nav className="kb-tabs" aria-label="Knowledge Base sections">
              {DETAIL_TABS.map((tab) => (
                <button
                  className={activeTab === tab ? 'is-active' : ''}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab === 'overview'
                    ? 'Overview'
                    : tab === 'documents'
                      ? `Documents (${totalDocuments})`
                      : tab === 'collections'
                        ? `Collections (${totalCollections})`
                        : tab === 'tags'
                          ? 'Tags'
                          : 'Settings'}
                </button>
              ))}
            </nav>

            {isDetailLoading ? (
              <Loader label="Loading Knowledge Base..." />
            ) : activeTab === 'overview' ? (
              <>
                <div className="kb-stat-grid">
                  <StatCard icon="file" label="Documents" value={totalDocuments} />
                  <StatCard icon="collection" label="Collections" value={totalCollections} />
                  <StatCard icon="folder" label="Folders" value={totalFolders} />
                  <StatCard icon="chat" label="Ready for Ask AI" value={totalDocuments} />
                </div>

                <section className="card kb-panel-card">
                  <div className="kb-panel-card__header">
                    <h2>Recent Documents</h2>
                    <button onClick={() => setActiveTab('documents')} type="button">
                      View all →
                    </button>
                  </div>
                  {documents.length === 0 ? (
                    <p className="kb-muted kb-panel-empty">
                      No documents are attached to this Knowledge Base yet.
                    </p>
                  ) : (
                    <div className="kb-document-table kb-document-table--compact">
                      {documents.slice(0, 5).map((document) => (
                        <DocumentRow document={document} key={document.id} />
                      ))}
                    </div>
                  )}
                </section>

                <div className="kb-detail-actions">
                  <Button onClick={() => navigate('/documents')}>
                    <KnowledgeIcon name="upload" size={16} /> Upload Documents
                  </Button>
                  <Button onClick={() => navigate('/documents/search')} variant="secondary">
                    <KnowledgeIcon name="chat" size={16} /> Ask AI about this KB
                  </Button>
                </div>
              </>
            ) : activeTab === 'documents' ? (
              <section className="card kb-panel-card">
                <div className="kb-panel-card__header">
                  <h2>Documents</h2>
                  <span>{documentPagination?.total ?? documents.length} total</span>
                </div>
                {documents.length === 0 ? (
                  <p className="kb-muted kb-panel-empty">
                    No documents are attached to this Knowledge Base yet.
                  </p>
                ) : (
                  <div className="kb-document-table">
                    <div className="kb-document-table__head" aria-hidden="true">
                      <span>Document</span>
                      <span>Collection</span>
                      <span>Uploaded by</span>
                      <span>Size</span>
                      <span>Status</span>
                      <span>Updated</span>
                    </div>
                    {documents.map((document) => (
                      <DocumentRow document={document} key={document.id} />
                    ))}
                  </div>
                )}
                <ListPagination
                  label="Knowledge Base documents pagination"
                  onPageChange={setDocumentPage}
                  onPageSizeChange={(nextPageSize) => {
                    setDocumentPageSize(nextPageSize)
                    setDocumentPage(1)
                  }}
                  pageSize={documentPageSize}
                  pageSizeOptions={[10, 20, 50]}
                  pagination={documentPagination}
                />
              </section>
            ) : activeTab === 'collections' ? (
              <section className="kb-section-panel">
                <div className="kb-section-header">
                  <div>
                    <h2 className="kb-section-title">Collections</h2>
                    <p className="kb-muted">
                      Create collections inside this Knowledge Base and group related documents.
                    </p>
                  </div>
                </div>

                {canManageKnowledgeBases && (
                  <form className="card kb-inline-form" onSubmit={handleCreateCollection}>
                    <div>
                      <span className="card__label">New Collection</span>
                      <h3>Add a collection</h3>
                      <p className="kb-muted">
                        Collections help users browse related documents together.
                      </p>
                    </div>
                    <label className="field">
                      <span>Collection name</span>
                      <input
                        disabled={isCollectionSaving}
                        maxLength={120}
                        onChange={(event) =>
                          setCollectionForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Example: Policies"
                        value={collectionForm.name}
                      />
                    </label>
                    <label className="field">
                      <span>Description optional</span>
                      <input
                        disabled={isCollectionSaving}
                        maxLength={500}
                        onChange={(event) =>
                          setCollectionForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Short description"
                        value={collectionForm.description}
                      />
                    </label>
                    <div className="form-actions">
                      <Button disabled={isCollectionSaving} type="submit">
                        {isCollectionSaving ? 'Creating...' : 'Create Collection'}
                      </Button>
                    </div>
                  </form>
                )}

                {collections.length === 0 ? (
                  <section className="empty-state empty-state--compact">
                    <h2>No collections yet</h2>
                    <p>Collections group related documents inside this Knowledge Base.</p>
                  </section>
                ) : (
                  <div className="kb-collection-grid">
                    {collections.map((collection) => (
                      <article className="kb-collection-card" key={collection.id}>
                        <header>
                          <span className="kb-card-icon kb-card-icon--small">
                            <KnowledgeIcon name="collection" size={16} />
                          </span>
                          <strong title={collection.name}>{collection.name}</strong>
                        </header>
                        <p title={collection.description || ''}>
                          {collection.description || 'Related documents grouped together.'}
                        </p>
                        <footer>
                          <small>{collection.counts?.documents ?? 0} documents</small>
                          <button
                            onClick={() => {
                              setSelectedCollectionId(collection.id)
                              setSelectedCollectionDocumentIds([])
                            }}
                            type="button"
                          >
                            Manage →
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                )}
                {selectedCollection && (
                  <section className="card kb-collection-manager">
                    <div className="kb-panel-card__header">
                      <div>
                        <p className="eyebrow">Collection</p>
                        <h2>{selectedCollection.name}</h2>
                        <p className="kb-muted">
                          Add documents from this Knowledge Base or remove documents
                          already grouped here.
                        </p>
                      </div>
                      <button
                        className="button button--secondary button--compact"
                        onClick={() => {
                          setSelectedCollectionId('')
                          setSelectedCollectionDocumentIds([])
                        }}
                        type="button"
                      >
                        Close
                      </button>
                    </div>

                    {documents.length === 0 ? (
                      <p className="kb-muted kb-panel-empty">
                        Add documents to this Knowledge Base before managing Collections.
                      </p>
                    ) : (
                      <div className="kb-document-table kb-document-table--actions">
                        <div className="kb-document-table__head" aria-hidden="true">
                          <span>Document</span>
                          <span>Collection</span>
                          <span>Uploaded by</span>
                          <span>Size</span>
                          <span>Status</span>
                          <span>Updated</span>
                          <span>Action</span>
                        </div>
                        {documents.map((document) => {
                          const isInCollection = document.collections?.some(
                            (collection) => collection.id === selectedCollection.id,
                          )

                          return (
                            <DocumentRow
                              action={
                                isInCollection ? (
                                  <button
                                    className="button button--secondary button--compact"
                                    disabled={isCollectionSaving}
                                    onClick={() =>
                                      handleRemoveDocumentFromCollection(
                                        selectedCollection.id,
                                        document.id,
                                      )
                                    }
                                    type="button"
                                  >
                                    Remove
                                  </button>
                                ) : (
                                  <label className="kb-inline-check">
                                    <input
                                      checked={selectedCollectionDocumentIds.includes(document.id)}
                                      disabled={isCollectionSaving}
                                      onChange={() => toggleCollectionDocument(document.id)}
                                      type="checkbox"
                                    />
                                    Add
                                  </label>
                                )
                              }
                              document={document}
                              key={document.id}
                            />
                          )
                        })}
                      </div>
                    )}

                    <div className="kb-detail-actions">
                      <Button
                        disabled={
                          isCollectionSaving ||
                          selectedCollectionDocumentIds.length === 0
                        }
                        onClick={handleAddDocumentsToCollection}
                      >
                        {isCollectionSaving ? 'Saving…' : 'Add selected documents'}
                      </Button>
                    </div>
                  </section>
                )}
              </section>
            ) : activeTab === 'tags' ? (
              <section className="kb-tags-panel">
                <div className="kb-section-header">
                  <div>
                    <h2>Tags</h2>
                    <p className="kb-muted">
                      Create simple labels that can be attached to documents during upload.
                    </p>
                  </div>
                </div>

                {canManageKnowledgeBases && (
                  <form className="card kb-inline-form" onSubmit={handleCreateTag}>
                    <div>
                      <span className="card__label">New Tag</span>
                      <h3>Add a tag</h3>
                      <p className="kb-muted">
                        Use clear labels such as onboarding, legal, finance, or policy.
                      </p>
                    </div>
                    <label className="field">
                      <span>Tag name</span>
                      <input
                        disabled={isTagSaving}
                        maxLength={60}
                        onChange={(event) => setTagForm({ name: event.target.value })}
                        placeholder="Example: onboarding"
                        value={tagForm.name}
                      />
                    </label>
                    <div className="form-actions">
                      <Button disabled={isTagSaving} type="submit">
                        {isTagSaving ? 'Creating...' : 'Create Tag'}
                      </Button>
                    </div>
                  </form>
                )}

                <h2>Available tags</h2>
                {visibleTags.length === 0 ? (
                  <p className="kb-muted">No tags are available yet.</p>
                ) : (
                  <div className="kb-chip-cloud">
                    {visibleTags.map((tag) => (
                      <span className="kb-chip" key={tag.id} title={tag.name}>
                        <KnowledgeIcon name="tag" size={13} />
                        {tag.name}
                        <small>{tag.count}</small>
                      </span>
                    ))}
                  </div>
                )}

                <h2>Categories</h2>
                {visibleCategories.length === 0 ? (
                  <p className="kb-muted">No categories are available yet.</p>
                ) : (
                  <div className="kb-chip-cloud">
                    {visibleCategories.map((category) => (
                      <span className="kb-chip kb-chip--soft" key={category.id} title={category.name}>
                        {category.name}
                        <small>{category.count}</small>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="kb-settings-panel">
                <section className="card kb-panel-card">
                  <div className="kb-panel-card__header">
                    <div>
                      <h2>Knowledge Base settings</h2>
                      <p className="kb-muted">
                        Review this Knowledge Base and manage safe administrative actions.
                      </p>
                    </div>
                  </div>

                  <div className="kb-settings-list">
                    <div>
                      <span className="card__label">Name</span>
                      <strong>{selectedKnowledgeBase.name}</strong>
                    </div>
                    <div>
                      <span className="card__label">Documents</span>
                      <strong>{totalDocuments}</strong>
                    </div>
                    <div>
                      <span className="card__label">Collections</span>
                      <strong>{totalCollections}</strong>
                    </div>
                  </div>
                </section>

                {canManageKnowledgeBases && (
                  <section className="card kb-danger-zone">
                    <div>
                      <span className="card__label">Danger Zone</span>
                      <h2>Delete Knowledge Base</h2>
                      <p className="kb-muted">
                        This removes the Knowledge Base, its collections, and moves all documents
                        inside it to organization-deleted files.
                      </p>
                    </div>
                    <Button
                      disabled={
                        isDeletingKnowledgeBase
                      }
                      onClick={handleDeleteEmptyKnowledgeBase}
                      variant="danger"
                    >
                      {isDeletingKnowledgeBase ? 'Deleting...' : 'Delete Knowledge Base'}
                    </Button>
                  </section>
                )}
              </section>
            )}
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page page--knowledge-bases">
      <header className="kb-page-heading">
        <div>
          <h1>Knowledge Bases</h1>
          <p>Organize documents into searchable knowledge bases for Ask AI.</p>
        </div>
        {canManageKnowledgeBases && (
          <Button onClick={() => setShowCreate((current) => !current)}>
            + Create Knowledge Base
          </Button>
        )}
      </header>

      {error && (
        <Alert onDismiss={() => setError(null)}>
          {getFriendlyError(error, 'Something went wrong. Please try again.')}
        </Alert>
      )}

      {showCreate && (
        <form className="card kb-create-card" onSubmit={handleCreateKnowledgeBase}>
          <div className="section-heading">
            <div>
              <span className="card__label">Create Knowledge Base</span>
              <h2>New document library</h2>
              <p>Use a clear name such as Engineering, HR, Finance, or Policies.</p>
            </div>
          </div>
          <label className="field">
            <span>Name</span>
            <input
              maxLength={120}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Engineering"
              value={form.name}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              maxLength={500}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
              placeholder="Technical docs, policies, and guides"
              rows={3}
              value={form.description}
            />
          </label>
          <div className="form-actions">
            <Button disabled={isCreating} onClick={() => setShowCreate(false)} variant="secondary">
              Cancel
            </Button>
            <Button disabled={isCreating} type="submit">
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      )}

      <label className="kb-search-box">
        <KnowledgeIcon name="search" size={18} />
        <input
          aria-label="Search Knowledge Bases"
          onChange={(event) => {
            setSearch(event.target.value)
            setKbPage(1)
          }}
          placeholder="Search knowledge bases..."
          type="search"
          value={search}
        />
      </label>

      {isLoading ? (
        <Loader label="Loading Knowledge Bases..." />
      ) : knowledgeBases.length === 0 ? (
        <section className="empty-state">
          <h2>No Knowledge Bases yet</h2>
          <p>Create one to organize {organizationName} documents for Ask AI.</p>
        </section>
      ) : (
        <>
          <section className="kb-card-grid">
            {knowledgeBases.map((knowledgeBase) => (
              <article
                className="kb-library-card kb-library-card--clickable"
                key={knowledgeBase.id}
                onClick={() => openKnowledgeBase(knowledgeBase)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openKnowledgeBase(knowledgeBase)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <header>
                  <span className="kb-card-icon">
                    <KnowledgeIcon name="book" />
                  </span>
                  <strong title={knowledgeBase.name}>{knowledgeBase.name}</strong>
                  <span className={`status-badge status-badge--${getStatusTone(knowledgeBase.status)}`}>
                    {getStatusLabel(knowledgeBase.status)}
                  </span>
                </header>
                <p title={knowledgeBase.description || ''}>
                  {knowledgeBase.description || 'Documents organized for Ask AI.'}
                </p>
                <div className="kb-card-meta">
                  <span>
                    <KnowledgeIcon name="file" size={14} />{' '}
                    {knowledgeBase.counts?.documents ?? 0} docs
                  </span>
                  <span>
                    <KnowledgeIcon name="collection" size={14} />{' '}
                    {knowledgeBase.counts?.collections ?? 0} collections
                  </span>
                  <span>
                    <KnowledgeIcon name="folder" size={14} />{' '}
                    {knowledgeBase.counts?.folders ?? 0} folders
                  </span>
                </div>
                <footer>
                  <span>Created {formatDate(knowledgeBase.createdAt)}</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      openKnowledgeBase(knowledgeBase)
                    }}
                    type="button"
                  >
                    Open →
                  </button>
                </footer>
              </article>
            ))}
          </section>
          <ListPagination
            label="Knowledge Bases pagination"
            onPageChange={setKbPage}
            onPageSizeChange={(nextPageSize) => {
              setKbPageSize(nextPageSize)
              setKbPage(1)
            }}
            pageSize={kbPageSize}
            pageSizeOptions={[4, 8, 12]}
            pagination={pagination}
          />
        </>
      )}
    </main>
  )
}
