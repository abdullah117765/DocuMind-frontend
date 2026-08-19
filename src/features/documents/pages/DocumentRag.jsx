import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import {
  askRagDocuments,
  deleteRagChat,
  getRagChat,
  getOrganizationDocumentContentUrl,
  getOrganizationDocumentVersionCitationPreviewUrl,
  getRagDocumentStatuses,
  listRagChats,
  listOrganizationDocuments,
  reindexRagDocuments,
  searchRagDocuments,
} from '../services/documentsApi.js'
import {
  listKnowledgeBaseCollections,
  listKnowledgeBases,
} from '../../knowledge-bases/services/knowledgeBasesApi.js'

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
      {name === 'plus' && (
        <>
          <path d="M12 5v14M5 12h14" {...commonProps} />
        </>
      )}
      {name === 'trash' && (
        <>
          <path d="M3 6h18" {...commonProps} />
          <path d="M8 6V4h8v2" {...commonProps} />
          <path d="M19 6l-1 14H6L5 6" {...commonProps} />
        </>
      )}
      {name === 'history' && (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7" {...commonProps} />
          <path d="M3 4v5h5" {...commonProps} />
          <path d="M12 7v5l3 2" {...commonProps} />
        </>
      )}
      {name === 'quote' && (
        <>
          <path d="M9 7H5v6h4v4l3-4V7Z" {...commonProps} />
          <path d="M19 7h-4v6h4v4l3-4V7Z" {...commonProps} />
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

function cleanUiText(value = '') {
  return String(value).replace(/\u00c2\u00b7/g, ' - ')
}

function cleanUiTextLegacy(value = '') {
  return String(value).replace(/\u00c2\u00b7/g, '·')
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

function getSourceDocumentId(source) {
  return source?.document_id ?? source?.documentId ?? ''
}

function getSourceDocumentName(source) {
  return (
    source?.document_name ||
    source?.documentName ||
    source?.original_filename ||
    source?.originalFilename ||
    'Document'
  )
}

function getSourceOriginalFilename(source) {
  return source?.original_filename || source?.originalFilename || ''
}

function getSourceFileType(source) {
  return source?.file_type || source?.fileType || source?.extension || 'DOC'
}

function getSourceVersion(source) {
  return source?.version_number ?? source?.versionNumber ?? null
}

function getSourceVersionId(source) {
  const metadata = getSourceMetadata(source)

  return (
    source?.version_id ||
    source?.versionId ||
    metadata.version_id ||
    metadata.versionId ||
    ''
  )
}

function getSourceScore(source) {
  const rawScore = source?.score

  if (rawScore === null || rawScore === undefined || rawScore === '') return null

  const score = Number(rawScore)

  return Number.isFinite(score) ? score : null
}

function getSourceMetadata(source) {
  return source?.metadata && typeof source.metadata === 'object'
    ? source.metadata
    : {}
}

function getSourcePageNumber(source) {
  const metadata = getSourceMetadata(source)
  const candidates = [
    source?.page_number,
    source?.pageNumber,
    metadata.page_number,
    metadata.pageNumber,
  ]

  for (const value of candidates) {
    const pageNumber = toPositiveInteger(value)

    if (pageNumber !== null) return pageNumber
  }

  return null
}

function getSourceHighlightBoxes(source) {
  const metadata = getSourceMetadata(source)
  const candidates = [
    source?.highlight_boxes,
    source?.highlightBoxes,
    metadata.highlight_boxes,
    metadata.highlightBoxes,
  ]
  const boxes = candidates.find((value) => Array.isArray(value))

  if (!Array.isArray(boxes)) return []

  return boxes
    .slice(0, 8)
    .map((box) => {
      if (!box || typeof box !== 'object') return null

      return {
        page_number: box.page_number ?? box.pageNumber ?? null,
        x0: box.x0 ?? null,
        y0: box.y0 ?? null,
        x1: box.x1 ?? null,
        y1: box.y1 ?? null,
        page_width: box.page_width ?? box.pageWidth ?? null,
        page_height: box.page_height ?? box.pageHeight ?? null,
      }
    })
    .filter(Boolean)
}

function getCitationUrl(organizationId, source) {
  const documentId = getSourceDocumentId(source)
  if (!organizationId || !documentId) return ''

  const versionId = getSourceVersionId(source)
  const pageNumber = getSourcePageNumber(source)
  const searchText = getSourceSnippet(source, 90)
  const highlightBoxes = getSourceHighlightBoxes(source)
  const baseUrl = versionId
    ? getOrganizationDocumentVersionCitationPreviewUrl(organizationId, documentId, versionId)
    : getOrganizationDocumentContentUrl(organizationId, documentId)
  const queryParts = []
  const hashParts = []

  if (versionId && highlightBoxes.length > 0) {
    queryParts.push(`highlights=${encodeURIComponent(JSON.stringify(highlightBoxes))}`)
  }
  if (versionId && pageNumber) {
    queryParts.push(`page=${pageNumber}`)
  }
  if (pageNumber) hashParts.push(`page=${pageNumber}`)
  if (searchText) hashParts.push(`search=${encodeURIComponent(searchText)}`)

  const query = queryParts.length ? `?${queryParts.join('&')}` : ''
  const hash = hashParts.length ? `#${hashParts.join('&')}` : ''

  return `${baseUrl}${query}${hash}`
}

function toPositiveInteger(value) {
  const number = Number(value)

  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function getSourceNumber(source) {
  const metadata = getSourceMetadata(source)
  const candidates = [
    source?.__citationNumber,
    source?.source_number,
    source?.sourceNumber,
    source?.citation_number,
    source?.citationNumber,
    metadata.source_number,
    metadata.sourceNumber,
    metadata.citation_number,
    metadata.citationNumber,
  ]

  for (const value of candidates) {
    const number = toPositiveInteger(value)

    if (number !== null) return number
  }

  return null
}

function getCitationNumber(source, index) {
  return getSourceNumber(source) ?? index + 1
}

function getReferencedSourceNumbers(text) {
  if (typeof text !== 'string' || !text.trim()) return new Set()

  const references = new Set()
  const citationPattern = /\[([\d,\s]+)\]/g
  let match = citationPattern.exec(text)

  while (match) {
    for (const part of match[1].split(',')) {
      const number = toPositiveInteger(part.trim())

      if (number !== null) references.add(number)
    }

    match = citationPattern.exec(text)
  }

  return references
}

function getSourceText(source) {
  const metadata = getSourceMetadata(source)
  const candidates = [
    source?.text,
    source?.excerpt,
    source?.content,
    metadata.text,
    metadata.excerpt,
    metadata.content,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.replace(/\s+/g, ' ').trim()
    }
  }

  return ''
}

function getSourceSnippet(source, maxLength = 260) {
  const text = getSourceText(source)

  if (!text) return ''

  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text
}

function getSourceLocationLabel(source) {
  const metadata = getSourceMetadata(source)
  const directLabel = source?.location_label || source?.locationLabel

  if (typeof directLabel === 'string' && directLabel.trim()) {
    return directLabel.trim()
  }

  const pageNumber = getSourcePageNumber(source)
  if (pageNumber) return `Page ${pageNumber}`

  const slideNumber =
    source?.slide_number ?? source?.slideNumber ?? metadata.slide_number
  if (slideNumber) return `Slide ${slideNumber}`

  const sectionTitle =
    source?.section_title ?? source?.sectionTitle ?? metadata.section_title
  if (sectionTitle) return sectionTitle

  const sheetName = source?.sheet_name ?? source?.sheetName ?? metadata.sheet_name
  const lineStart = source?.line_start ?? source?.lineStart ?? metadata.line_start
  const lineEnd = source?.line_end ?? source?.lineEnd ?? metadata.line_end

  if (sheetName && lineStart && lineEnd) {
    return `${sheetName}, lines ${lineStart}-${lineEnd}`
  }

  if (lineStart && lineEnd) {
    return lineStart === lineEnd
      ? `Line ${lineStart}`
      : `Lines ${lineStart}-${lineEnd}`
  }

  return ''
}

function getSourceLocationType(source) {
  const metadata = getSourceMetadata(source)
  const type = source?.location_type || source?.locationType || metadata.location_type

  if (typeof type === 'string' && type.trim()) {
    return type.trim().toLowerCase()
  }

  const location = getSourceLocationLabel(source).toLowerCase()

  if (location.startsWith('page ')) return 'page'
  if (location.startsWith('paragraph ')) return 'paragraph'
  if (location.startsWith('slide ')) return 'slide'
  if (location.startsWith('table ')) return 'table'
  if (location.startsWith('line')) return 'lines'
  if (location.startsWith('sheet')) return 'sheet'

  return ''
}

function getCitationWhereLabel(source) {
  const locationLabel = getSourceLocationLabel(source)

  if (locationLabel) return locationLabel

  const chunkIndex = Number(source?.chunk_index ?? source?.chunkIndex)

  if (Number.isSafeInteger(chunkIndex) && chunkIndex >= 0) {
    return `Passage ${chunkIndex + 1}`
  }

  return 'Location not available'
}

function getCitationHelpText(source) {
  if (getSourceLocationLabel(source)) return ''
  if (getSourceSnippet(source)) {
    return 'Exact page or paragraph is not available for this file.'
  }

  return 'Prepare this file again to add page or paragraph citations.'
}

function getSourceDisplayLabel(source) {
  return [
    getSourceDocumentName(source),
    getCitationWhereLabel(source),
  ].join(' - ')
}

function getSourceDocuments(response, answerText = '') {
  const rawGroups = [
    response?.sources,
    response?.search_results,
    response?.results,
  ].filter((group) => Array.isArray(group) && group.length)
  const referencedNumbers = getReferencedSourceNumbers(
    answerText || response?.answer || response?.content || '',
  )
  const byLocation = new Map()

  for (const group of rawGroups) {
    group.forEach((source, sourceIndex) => {
      const documentId = getSourceDocumentId(source)
      if (!documentId) return

      const sourceNumber = getSourceNumber(source) ?? sourceIndex + 1
      const enrichedSource = {
        ...source,
        __citationNumber: sourceNumber,
      }
      const locationLabel = getSourceLocationLabel(enrichedSource)
      const locationKey = [
        documentId,
        sourceNumber,
        locationLabel,
        source.chunk_index ?? source.chunkIndex ?? '',
      ].join(':')
      const existing = byLocation.get(locationKey)
      const nextScore = getSourceScore(enrichedSource) ?? 0
      const existingScore = getSourceScore(existing) ?? 0
      const nextHasLocation = Boolean(getSourceLocationLabel(enrichedSource))
      const existingHasLocation = Boolean(getSourceLocationLabel(existing))
      const nextHasText = Boolean(getSourceSnippet(enrichedSource))
      const existingHasText = Boolean(getSourceSnippet(existing))

      if (
        !existing ||
        (nextHasLocation && !existingHasLocation) ||
        (nextHasText && !existingHasText) ||
        nextScore > existingScore
      ) {
        byLocation.set(locationKey, enrichedSource)
      }
    })
  }

  let sources = [...byLocation.values()].sort(
    (left, right) => getCitationNumber(left, 0) - getCitationNumber(right, 0),
  )

  if (referencedNumbers.size) {
    const referencedSources = sources.filter((source, index) =>
      referencedNumbers.has(getCitationNumber(source, index)),
    )

    if (referencedSources.length) {
      sources = referencedSources
    }
  }

  return sources.slice(0, 10)
}

function SourceDocumentCard({ organizationId, result }) {
  const documentId = getSourceDocumentId(result)
  const documentName = getSourceDocumentName(result)
  const fileType = getSourceFileType(result)
  const locationLabel = getSourceLocationLabel(result)
  const score = getSourceScore(result)
  const citationUrl = getCitationUrl(organizationId, result)
  const detail = [
    getSourceOriginalFilename(result),
    locationLabel,
    getSourceVersion(result) ? `Version ${getSourceVersion(result)}` : null,
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
            {cleanUiText(detail) || 'Used for this answer'}
          </small>
        </div>
        {score !== null && (
          <span className="status-badge">{getScoreLabel(score)}</span>
        )}
      </div>
      {documentId && (
        <a
          className="rag-source-link"
          href={citationUrl}
          rel="noreferrer"
          target="_blank"
        >
          <RagIcon name="open" size={14} /> Open location
        </a>
      )}
    </article>
  )
}

function SourcePill({ organizationId, source, index }) {
  const sourceDocumentId = getSourceDocumentId(source)
  const documentName = getSourceDocumentName(source)
  const whereLabel = getCitationWhereLabel(source)
  const helpText = getCitationHelpText(source)
  const sourceType = getSourceLocationType(source)
  const score = getSourceScore(source)
  const fileType = getSourceFileType(source)
  const snippet = getSourceSnippet(source)
  const citationNumber = getCitationNumber(source, index)
  const citationUrl = getCitationUrl(organizationId, source)

  if (!sourceDocumentId) {
    return (
      <span className="rag-citation-card" key={`${source.id ?? documentName}-${index}`}>
        <span className="rag-citation-card__icon">{citationNumber}</span>
        <span className="rag-citation-card__body">
          <strong title={documentName}>{documentName}</strong>
          <small>
            Where: <b>{whereLabel}</b>
          </small>
          {snippet && (
            <span className="rag-citation-card__excerpt" title={snippet}>
              {snippet}
            </span>
          )}
          {helpText && <em>{helpText}</em>}
        </span>
      </span>
    )
  }

  return (
    <a
      className="rag-citation-card"
      href={citationUrl}
      key={`${sourceDocumentId}-${getSourceLocationLabel(source)}-${index}`}
      rel="noreferrer"
      title={[getSourceDisplayLabel(source), snippet].filter(Boolean).join(' — ')}
      target="_blank"
    >
      <span className="rag-citation-card__icon">{citationNumber}</span>
      <span className="rag-citation-card__body">
        <strong title={documentName}>{documentName}</strong>
        <small>
          Where: <b>{whereLabel}</b>
          {sourceType && <span> - {sourceType}</span>}
        </small>
        <small>
          {fileType.toUpperCase()}
          {score !== null && ` - ${getScoreLabel(score)}`}
        </small>
        {snippet && (
          <span className="rag-citation-card__excerpt" title={snippet}>
            {snippet}
          </span>
        )}
        {helpText && <em>{helpText}</em>}
      </span>
      <RagIcon name="open" size={14} />
    </a>
  )
}

function CitationToggle({ organizationId, sources }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!sources.length) return null

  return (
    <div className="rag-citations">
      <button
        className="rag-citation-button"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <RagIcon name="quote" size={14} />
        {isOpen ? 'Hide citations' : `Show citations (${sources.length})`}
      </button>

      {isOpen && (
        <div className="rag-message__sources" aria-label="Answer citations">
          {sources.map((source, index) => (
            <SourcePill
              index={index}
              key={`${getSourceDocumentId(source)}-${getSourceLocationLabel(source)}-${index}`}
              organizationId={organizationId}
              source={source}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function isUnavailableAnswer(text = '') {
  const normalized = String(text).trim().toLowerCase()

  return (
    normalized === 'not available in the selected documents.' ||
    normalized === 'not available in the selected documents' ||
    normalized.startsWith('not available') ||
    normalized.includes('could not find this in the selected documents') ||
    normalized.includes('no relevant documents were found')
  )
}

function RelatedInfoToggle({ organizationId, sources }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!sources.length) {
    return (
      <p className="rag-related-info-empty">
        No related information was found in the selected files.
      </p>
    )
  }

  return (
    <div className="rag-citations rag-related-info">
      <button
        className="rag-citation-button"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <RagIcon name="search" size={14} />
        {isOpen ? 'Hide related info' : `Show related info (${sources.length})`}
      </button>

      {isOpen && (
        <div className="rag-message__sources" aria-label="Related document information">
          {sources.map((source, index) => (
            <SourcePill
              index={index}
              key={`${getSourceDocumentId(source)}-${getSourceLocationLabel(source)}-${index}`}
              organizationId={organizationId}
              source={source}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChatMessage({ message, organizationId }) {
  const isUser = message.role === 'USER'
  const sources = getSourceDocuments({ sources: message.sources ?? [] }, message.content)
  const unavailable = !isUser && isUnavailableAnswer(message.content)

  return (
    <article
      className={`rag-message ${isUser ? 'rag-message--user' : 'rag-message--assistant'}`}
    >
      <div className="rag-message__meta">
        <strong>{isUser ? 'You' : 'Documind AI'}</strong>
        <span>{formatDate(message.createdAt)}</span>
      </div>
      <div className="rag-message__bubble">
        {isUser ? <p>{message.content}</p> : <AnswerMarkdown text={message.content} />}
      </div>
      {!isUser && (
        unavailable ? (
          <RelatedInfoToggle organizationId={organizationId} sources={sources} />
        ) : (
          <CitationToggle organizationId={organizationId} sources={sources} />
        )
      )}
      {false && !isUser && sources.length > 0 && (
        <div className="rag-message__sources" aria-label="Answer sources">
          {sources.map((source, index) => {
            const sourceDocumentId = getSourceDocumentId(source)
            const label = [
              getSourceDocumentName(source),
              getSourceLocationLabel(source),
            ].join(' — ')

            if (!sourceDocumentId) {
              return (
                <span
                  className="rag-source-pill"
                  key={`${source.id ?? label}-${index}`}
                  title={label}
                >
                  {label}
                </span>
              )
            }

            return (
              <a
                className="rag-source-pill"
                href={getCitationUrl(organizationId, source)}
                key={`${sourceDocumentId}-${getSourceLocationLabel(source)}-${index}`}
                rel="noreferrer"
                title={label}
                target="_blank"
              >
                {label}
              </a>
            )
          })}
        </div>
      )}
    </article>
  )
}

function getFocusedChatMessages(messages = []) {
  if (!messages.length) {
    return {
      latestMessages: [],
      previousMessages: [],
    }
  }

  let latestAnswerIndex = -1

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'ASSISTANT') {
      latestAnswerIndex = index
      break
    }
  }

  const endIndex = latestAnswerIndex >= 0 ? latestAnswerIndex : messages.length - 1
  const startIndex =
    endIndex > 0 &&
    messages[endIndex]?.role === 'ASSISTANT' &&
    messages[endIndex - 1]?.role === 'USER'
      ? endIndex - 1
      : endIndex

  return {
    latestMessages: messages.slice(startIndex, endIndex + 1),
    previousMessages: [
      ...messages.slice(0, startIndex),
      ...messages.slice(endIndex + 1),
    ],
  }
}

function buildRagPayload({
  query,
  scope,
  selectedDocumentIds,
  selectedKnowledgeBaseIds,
  selectedCollectionIds,
  chatSessionId,
}) {
  return {
    chatSessionId: chatSessionId || undefined,
    documentIds: scope === 'selected' ? selectedDocumentIds : undefined,
    knowledgeBaseIds:
      scope === 'knowledge_base' || scope === 'collection'
        ? selectedKnowledgeBaseIds
        : undefined,
    collectionIds: scope === 'collection' ? selectedCollectionIds : undefined,
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

function RagDocumentOption({
  disabled,
  document,
  indexStatus,
  onToggle,
  selected,
}) {
  const ragStatus = indexStatus?.status ?? 'NOT_INDEXED'
  const meta = [
    document.originalFilename,
    formatBytes(document.sizeBytes),
    getActorLabel(document.createdBy),
  ]
    .filter(Boolean)
    .join(' - ')

  return (
    <label className={`rag-document-option ${selected ? 'rag-document-option--selected' : ''}`}>
      <input
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        type="checkbox"
      />
      <span className="file-icon" aria-hidden="true">
        {document.extension?.slice(0, 3).toUpperCase() || 'DOC'}
      </span>
      <span className="rag-document-option__main">
        <strong title={document.name}>{document.name}</strong>
        <small title={meta}>{meta}</small>
      </span>
      <RagStatusIndicator statusView={indexStatus ?? { status: ragStatus }} />
    </label>
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
  const [documentStatusFilter, setDocumentStatusFilter] = useState('')
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
  const [knowledgeBases, setKnowledgeBases] = useState([])
  const [knowledgeBaseCollections, setKnowledgeBaseCollections] = useState([])
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState([])
  const [selectedCollectionIds, setSelectedCollectionIds] = useState([])
  const [searchResponse, setSearchResponse] = useState(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [chatSessions, setChatSessions] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [currentChatId, setCurrentChatId] = useState('')
  const [isChatsLoading, setIsChatsLoading] = useState(false)
  const [isOpeningChat, setIsOpeningChat] = useState(false)
  const [chatDeleteTargetId, setChatDeleteTargetId] = useState('')

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
    () => getSourceDocuments(searchResponse, searchResponse?.answer),
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
  const currentChat = useMemo(
    () => chatSessions.find((chat) => chat.id === currentChatId) ?? null,
    [chatSessions, currentChatId],
  )
  const focusedChat = useMemo(
    () => getFocusedChatMessages(chatMessages),
    [chatMessages],
  )

  const loadRagData = useCallback(async () => {
    if (!organizationId || !canReadDocuments) return

    setIsLoading(true)
    setError(null)

    try {
      const [documentList, statuses, knowledgeBaseList] = await Promise.all([
        listOrganizationDocuments(organizationId, {
          page: documentPage,
          pageSize: documentPageSize,
          ragStatus: documentStatusFilter,
          search: documentFilter.trim(),
          view: 'active',
        }),
        getRagDocumentStatuses(organizationId),
        listKnowledgeBases(organizationId, { page: 1, pageSize: 100 }),
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
      setKnowledgeBases(knowledgeBaseList.knowledgeBases ?? [])
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
    documentStatusFilter,
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

  const loadRagChats = useCallback(async () => {
    if (!organizationId || !canAskDocuments) {
      setChatSessions([])
      return
    }

    setIsChatsLoading(true)

    try {
      setChatSessions(await listRagChats(organizationId))
    } catch (requestError) {
      notifications.error(
        getDocumentAiErrorMessage(
          requestError,
          'We could not load your chat history. Refresh the page and try again.',
        ),
      )
    } finally {
      setIsChatsLoading(false)
    }
  }, [canAskDocuments, notifications, organizationId])

  useEffect(() => {
    if (status === 'ready') {
      const handle = window.setTimeout(() => {
        void loadRagData()
      }, 250)

      return () => window.clearTimeout(handle)
    }
  }, [loadRagData, status])

  useEffect(() => {
    setCurrentChatId('')
    setChatMessages([])
    setSearchResponse(null)
    setQuery('')
    setSelectedKnowledgeBaseIds([])
    setSelectedCollectionIds([])
  }, [organizationId])

  useEffect(() => {
    let active = true

    if (!organizationId || selectedKnowledgeBaseIds.length === 0) {
      setKnowledgeBaseCollections([])
      setSelectedCollectionIds([])
      return undefined
    }

    Promise.all(
      selectedKnowledgeBaseIds.map((knowledgeBaseId) =>
        listKnowledgeBaseCollections(organizationId, knowledgeBaseId),
      ),
    )
      .then((collectionGroups) => {
        if (!active) return
        const nextCollections = collectionGroups.flat()
        setKnowledgeBaseCollections(nextCollections)
        setSelectedCollectionIds((current) =>
          current.filter((collectionId) =>
            nextCollections.some((collection) => collection.id === collectionId),
          ),
        )
      })
      .catch(() => {
        if (!active) return
        setKnowledgeBaseCollections([])
        setSelectedCollectionIds([])
      })

    return () => {
      active = false
    }
  }, [organizationId, selectedKnowledgeBaseIds])

  useEffect(() => {
    if (status === 'ready') {
      void loadRagChats()
    }
  }, [loadRagChats, status])

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

  function toggleKnowledgeBase(knowledgeBaseId) {
    setSelectedKnowledgeBaseIds((current) => {
      const next = current.includes(knowledgeBaseId)
        ? current.filter((selectedId) => selectedId !== knowledgeBaseId)
        : [...current, knowledgeBaseId]

      setSelectedCollectionIds([])
      return next
    })
  }

  function toggleCollection(collectionId) {
    setSelectedCollectionIds((current) =>
      current.includes(collectionId)
        ? current.filter((selectedId) => selectedId !== collectionId)
        : [...current, collectionId],
    )
  }

  function handleNewChat() {
    setCurrentChatId('')
    setChatMessages([])
    setSearchResponse(null)
    setResultMode(null)
    setQuery('')
  }

  function handleScopeChange(nextScope) {
    setScope(nextScope)

    if (nextScope === 'all') {
      setSelectedDocumentIds([])
    }

    if (nextScope === 'selected') {
      setSelectedKnowledgeBaseIds([])
      setSelectedCollectionIds([])
    }

    if (nextScope === 'knowledge_base') {
      setSelectedDocumentIds([])
      setSelectedCollectionIds([])
    }

    if (nextScope === 'collection') {
      setSelectedDocumentIds([])
    }
  }

  async function handleOpenChat(chatSessionId) {
    if (!chatSessionId || isOpeningChat) return

    setIsOpeningChat(true)
    setError(null)

    try {
      const chatDetail = await getRagChat(organizationId, chatSessionId)
      const selectedIds = chatDetail.chat?.selectedDocumentIds ?? []

      setCurrentChatId(chatDetail.chat?.id ?? chatSessionId)
      setChatMessages(chatDetail.messages ?? [])
      setSelectedDocumentIds(selectedIds)
      setScope(selectedIds.length > 0 ? 'selected' : 'all')
      setSearchResponse(null)
      setResultMode(null)
      setQuery('')
    } catch (requestError) {
      setError(requestError)
      notifications.error(
        getDocumentAiErrorMessage(
          requestError,
          'We could not open that chat. Refresh the page and try again.',
        ),
      )
    } finally {
      setIsOpeningChat(false)
    }
  }

  async function handleDeleteChat(chatSessionId) {
    if (!chatSessionId) return

    try {
      await deleteRagChat(organizationId, chatSessionId)
      setChatSessions((current) =>
        current.filter((chat) => chat.id !== chatSessionId),
      )

      if (currentChatId === chatSessionId) {
        handleNewChat()
      }

      notifications.success('Chat deleted.')
    } catch (requestError) {
      notifications.error(
        getDocumentAiErrorMessage(
          requestError,
          'We could not delete that chat. Please try again.',
        ),
      )
    } finally {
      setChatDeleteTargetId('')
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

    if (scope === 'knowledge_base' && selectedKnowledgeBaseIds.length === 0) {
      notifications.info('Select at least one Knowledge Base before asking AI.')
      return false
    }

    if (scope === 'collection') {
      if (selectedKnowledgeBaseIds.length === 0) {
        notifications.info('Select a Knowledge Base before choosing Collections.')
        return false
      }

      if (selectedCollectionIds.length === 0) {
        notifications.info('Select at least one Collection before asking AI.')
        return false
      }
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
        chatSessionId: mode === 'ask' ? currentChatId : '',
        query: query.trim(),
        scope,
        selectedDocumentIds,
        selectedKnowledgeBaseIds,
        selectedCollectionIds,
      })
      const response =
        mode === 'ask'
          ? await askRagDocuments(organizationId, payload)
          : await searchRagDocuments(organizationId, payload)

      if (mode === 'ask' && response.chatMessages?.length) {
        setCurrentChatId(response.chatSession?.id ?? currentChatId)
        setChatMessages((current) => [...current, ...response.chatMessages])
        setSearchResponse(null)
        setQuery('')
        void loadRagChats()
      } else {
        setSearchResponse(response)
      }
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

  async function prepareFilesForAi(targetIds, successMessage) {
    if (isReindexing) {
      notifications.info('File preparation is already running. Watch the file status for progress.')
      return
    }

    if (Array.isArray(targetIds) && targetIds.length === 0) {
      notifications.error('Select at least one file before preparing it for AI.')
      return
    }

    setIsReindexing(true)
    setError(null)

    try {
      const statuses = await reindexRagDocuments(organizationId, {
        documentIds: targetIds?.length ? targetIds : undefined,
        force: true,
      })

      setDocumentStatuses((currentStatuses) =>
        mergeDocumentStatuses(currentStatuses, statuses ?? []),
      )
      const workingCount = (statuses ?? []).filter((statusView) =>
        isRagStatusWorking(statusView.status),
      ).length

      notifications.success(
        successMessage ??
          (workingCount > 0
          ? `Preparing ${workingCount} file(s). Status will update automatically.`
          : 'Selected file(s) are already ready.'),
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

  async function handleReindex() {
    const targetIds = scope === 'selected' ? selectedDocumentIds : undefined

    await prepareFilesForAi(targetIds)
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
          <h1>Ask documents</h1>
          <p>
            Ask questions from files you can access in {organizationName}.
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

      <section className={`rag-workspace ${!canAskDocuments ? 'rag-workspace--single' : ''}`}>
        {canAskDocuments && (
        <aside className="card rag-chat-panel">
          <div className="section-heading">
            <div>
              <span className="card__label">History</span>
              <h2>Chats</h2>
            </div>
            <button
              className="icon-button"
              onClick={handleNewChat}
              title="Start a new chat"
              type="button"
            >
              <RagIcon name="plus" size={16} />
            </button>
          </div>

          {isChatsLoading ? (
            <Loader label="Loading chats..." />
          ) : chatSessions.length ? (
            <div className="rag-chat-list">
              {chatSessions.map((chat) => {
                const isActive = chat.id === currentChatId
                const lastMessage = chat.lastMessage?.content || 'No messages yet'

                return (
                  <article
                    className={`rag-chat-item ${isActive ? 'rag-chat-item--active' : ''}`}
                    key={chat.id}
                  >
                    <button
                      className="rag-chat-item__button"
                      disabled={isOpeningChat}
                      onClick={() => void handleOpenChat(chat.id)}
                      type="button"
                    >
                      <span aria-hidden="true" className="rag-chat-item__icon">
                        <RagIcon name="history" size={15} />
                      </span>
                      <span className="rag-chat-item__content">
                        <strong title={chat.title}>{chat.title}</strong>
                        <small title={lastMessage}>{lastMessage}</small>
                        <em>{formatDate(chat.updatedAt)}</em>
                      </span>
                    </button>
                    <button
                      className="rag-chat-item__delete"
                      onClick={() => setChatDeleteTargetId(chat.id)}
                      title="Delete chat"
                      type="button"
                    >
                      <RagIcon name="trash" size={14} />
                    </button>
                  </article>
                )
              })}
            </div>
          ) : (
            <section className="empty-state empty-state--compact rag-chat-empty">
              <div>
                <h2>No chats yet</h2>
                <p>Ask a question to save your first document chat.</p>
              </div>
            </section>
          )}
        </aside>
        )}

        <div className="rag-main-panel">
          <section className="card rag-ask-card">
            <label className="field rag-question-field" htmlFor="rag-question-clean">
              <textarea
                id="rag-question-clean"
                maxLength={4000}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault()
                    void runRagRequest('ask')
                  }
                }}
                placeholder="Ask something about your documents..."
                rows={4}
                value={query}
              />
              <span className="field__hint rag-question-hint">
                <span>Press Ctrl/⌘ Enter to ask</span>
                <span>{query.trim().length}/4000</span>
              </span>
            </label>

            <div className="rag-scope-block">
              <span className="card__label">Knowledge scope</span>
              <div className="rag-scope-toggle" role="group" aria-label="Choose answer scope">
                <button
                  className={scope === 'knowledge_base' ? 'is-active' : ''}
                  onClick={() => handleScopeChange('knowledge_base')}
                  type="button"
                >
                  Knowledge Bases
                </button>
                <button
                  className={scope === 'collection' ? 'is-active' : ''}
                  onClick={() => handleScopeChange('collection')}
                  type="button"
                >
                  Collections
                </button>
                <button
                  className={scope === 'selected' ? 'is-active' : ''}
                  onClick={() => handleScopeChange('selected')}
                  type="button"
                >
                  Documents
                </button>
                <button
                  className={scope === 'all' ? 'is-active' : ''}
                  onClick={() => handleScopeChange('all')}
                  type="button"
                >
                  All readable files
                </button>
              </div>
              {scope === 'selected' ? (
                <p className="rag-selected-summary">
                  <span>
                    {selectedCount} file{selectedCount === 1 ? '' : 's'} selected
                  </span>
                  {selectedCount > 0 && (
                    <button
                      className="rag-clear-selection"
                      onClick={() => setSelectedDocumentIds([])}
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                </p>
              ) : scope === 'all' ? (
                <p className="rag-selected-summary">
                  AI will search every readable file in this organization.
                </p>
              ) : scope === 'collection' ? (
                <p className="rag-selected-summary">
                  Choose a Knowledge Base first, then select the Collections you want AI to search.
                </p>
              ) : (
                <p className="rag-selected-summary">
                  AI will search only the selected Knowledge Bases.
                </p>
              )}
              {(scope === 'knowledge_base' || scope === 'collection') && (
                <div className="rag-scope-picker">
                  <span className="field__label">
                    {scope === 'collection'
                      ? 'Step 1: Choose Knowledge Base'
                      : 'Knowledge Bases'}
                  </span>
                  {scope === 'collection' && (
                    <p className="field__hint">
                      Collections will appear from the Knowledge Base you select here.
                    </p>
                  )}
                  {knowledgeBases.length === 0 ? (
                    <p className="field__hint">
                      No Knowledge Bases are available yet.
                    </p>
                  ) : (
                    <div className="rag-scope-options">
                      {knowledgeBases.map((knowledgeBase) => (
                        <label key={knowledgeBase.id} className="rag-scope-option">
                          <input
                            checked={selectedKnowledgeBaseIds.includes(
                              knowledgeBase.id,
                            )}
                            onChange={() => toggleKnowledgeBase(knowledgeBase.id)}
                            type="checkbox"
                          />
                          <span>
                            <strong>{knowledgeBase.name}</strong>
                            <small>
                              {knowledgeBase.counts?.documents ?? 0} document
                              {(knowledgeBase.counts?.documents ?? 0) === 1
                                ? ''
                                : 's'}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {scope === 'collection' && selectedKnowledgeBaseIds.length > 0 && (
                <div className="rag-scope-picker">
                  <span className="field__label">Step 2: Choose Collections</span>
                  {knowledgeBaseCollections.length === 0 ? (
                    <p className="field__hint">
                      No Collections are available for the selected Knowledge Base.
                    </p>
                  ) : (
                    <div className="rag-scope-options">
                      {knowledgeBaseCollections.map((collection) => {
                        const knowledgeBase = knowledgeBases.find(
                          (kb) => kb.id === collection.knowledgeBaseId,
                        )

                        return (
                          <label key={collection.id} className="rag-scope-option">
                            <input
                              checked={selectedCollectionIds.includes(collection.id)}
                              onChange={() => toggleCollection(collection.id)}
                              type="checkbox"
                            />
                            <span>
                              <strong>{collection.name}</strong>
                              <small>{knowledgeBase?.name ?? 'Knowledge Base'}</small>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isSelectionRequired && selectedCount === 0 && (
              <p className="field__hint">Select one or more files before asking AI.</p>
            )}

            <div className="rag-ask-actions">
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
              <Button
                disabled={isSearching || !canAskDocuments}
                onClick={() => void runRagRequest('ask')}
              >
                <RagIcon name="spark" size={15} />
                {askAiProcessing ? 'Working...' : 'Ask AI'}
              </Button>
            </div>
          </section>

          {scope === 'selected' && (
          <section className="card rag-files-card">
            <div className="rag-files-header">
              <div>
                <strong>
                  Files
                  {selectedCount > 0 && <span>{selectedCount} selected</span>}
                </strong>
                {documentPagination && (
                  <small>
                    {documentPagination.total} file
                    {documentPagination.total === 1 ? '' : 's'} · page{' '}
                    {documentPagination.page} of {documentPagination.pageCount}
                  </small>
                )}
              </div>
              <div className="rag-files-filters">
                <select
                  aria-label="Filter by file status"
                  onChange={(event) => {
                    setDocumentStatusFilter(event.target.value)
                    setDocumentPage(1)
                  }}
                  value={documentStatusFilter}
                >
                  <option value="">All statuses</option>
                  <option value="ready">Ready</option>
                  <option value="preparing">Preparing</option>
                  <option value="needs_attention">Needs attention</option>
                  <option value="no_readable_text">No readable text</option>
                </select>
                <input
                  aria-label="Search files"
                  onChange={(event) => {
                    setDocumentFilter(event.target.value)
                    setDocumentPage(1)
                  }}
                  placeholder="Search files..."
                  type="search"
                  value={documentFilter}
                />
              </div>
            </div>

            {isLoading ? (
              <Loader label="Loading files..." />
            ) : documents.length ? (
              <div className="rag-document-list rag-document-list--clean">
                {documents.map((document) => {
                  const selected = selectedDocumentIds.includes(document.id)
                  const indexStatus = statusByDocumentId.get(document.id)
                  const disabled =
                    !selected && selectedCount >= MAX_SELECTED_DOCUMENTS

                  return (
                    <RagDocumentOption
                      disabled={disabled}
                      document={document}
                      indexStatus={indexStatus}
                      key={document.id}
                      onToggle={() => toggleDocument(document.id)}
                      selected={selected}
                    />
                  )
                })}
              </div>
            ) : (
              <section className="empty-state empty-state--compact">
                <div>
                  <h2>No readable files found</h2>
                  <p>Try a different filter or upload documents first.</p>
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
          </section>
          )}

      {false && (
      <section className="card rag-query-card rag-legacy-query-card">
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
              onChange={(event) => handleScopeChange(event.target.value)}
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
                          {[
                            document.originalFilename,
                            formatBytes(document.sizeBytes),
                            getActorLabel(document.createdBy),
                            indexStatus?.updatedAt
                              ? `ready ${formatDate(indexStatus.updatedAt)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                        <small className="rag-hidden-meta" aria-hidden="true">
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
      )}

          {chatMessages.length > 0 && (
            <section className="card rag-conversation-card">
              <div className="section-heading">
                <div>
                  <span className="card__label">Conversation</span>
                  <h2>{currentChat?.title || 'Current chat'}</h2>
                </div>
                <span className="status-badge">
                  {chatMessages.length} message
                  {chatMessages.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="rag-message-list rag-message-list--latest">
                {focusedChat.latestMessages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    organizationId={organizationId}
                  />
                ))}
              </div>

              {focusedChat.previousMessages.length > 0 && (
                <details className="rag-previous-messages">
                  <summary>
                    Previous messages
                    <span>
                      {focusedChat.previousMessages.length} message
                      {focusedChat.previousMessages.length === 1 ? '' : 's'}
                    </span>
                  </summary>
                  <div className="rag-message-list rag-message-list--previous">
                    {focusedChat.previousMessages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        organizationId={organizationId}
                      />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

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
              {isUnavailableAnswer(searchResponse.answer) ? (
                <RelatedInfoToggle
                  organizationId={organizationId}
                  sources={sourceDocuments}
                />
              ) : (
                <CitationToggle
                  organizationId={organizationId}
                  sources={sourceDocuments}
                />
              )}
              {false && sourceDocuments.length > 0 && (
                <div className="rag-source-list">
                  {sourceDocuments.map((source, index) => {
                    const sourceDocumentId = getSourceDocumentId(source)
                    const label = [
                      getSourceDocumentName(source),
                      getSourceLocationLabel(source),
                    ].join(' — ')

                    return (
                      <a
                        className="rag-source-pill"
                        href={getCitationUrl(organizationId, source)}
                        key={`${sourceDocumentId}-${getSourceLocationLabel(source)}-${index}`}
                        rel="noopener noreferrer"
                        title={label}
                        target="_blank"
                      >
                        {label}
                      </a>
                    )
                  })}
                </div>
              )}
            </article>
          )}

          <section className="card">
            <div className="section-heading">
              <div>
                <span className="card__label">Sources used</span>
                <h2>
                  {sourceDocuments.length} source
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
                      key={`${getSourceDocumentId(result)}-${getSourceLocationLabel(result)}`}
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
        </div>
      </section>
      <Modal
        isOpen={Boolean(chatDeleteTargetId)}
        onClose={() => setChatDeleteTargetId('')}
        title="Delete chat"
      >
        <div className="modal__body">
          <p>
            This removes the chat from your history. Your documents will not be
            changed.
          </p>
        </div>
        <footer className="modal__actions">
          <Button
            disabled={isOpeningChat}
            onClick={() => setChatDeleteTargetId('')}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={!chatDeleteTargetId}
            onClick={() => void handleDeleteChat(chatDeleteTargetId)}
            variant="danger"
          >
            Delete chat
          </Button>
        </footer>
      </Modal>
    </main>
  )
}
