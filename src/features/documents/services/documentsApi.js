import { API_BASE_URL } from '../../../shared/constants/env.js'
import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'
import { csrfRequest } from '../../../shared/utils/csrfRequest.js'

function encode(value) {
  return encodeURIComponent(value)
}

function queryString(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )

  return query.toString() ? `?${query}` : ''
}

function organizationDocumentPath(organizationId, suffix = '') {
  return `/organizations/${encode(organizationId)}/documents${suffix}`
}

function platformDocumentPath(suffix = '') {
  return `/platform/documents${suffix}`
}

function formDataWithFiles(fieldName, files) {
  const formData = new FormData()

  for (const file of files) {
    formData.append(fieldName, file)
  }

  return formData
}

export function getOrganizationDocumentContentUrl(organizationId, documentId) {
  return `${API_BASE_URL}${organizationDocumentPath(
    organizationId,
    `/${encode(documentId)}/content`,
  )}`
}

export function getOrganizationDocumentDownloadUrl(organizationId, documentId) {
  return `${API_BASE_URL}${organizationDocumentPath(
    organizationId,
    `/${encode(documentId)}/download`,
  )}`
}

export function getStagedFileContentUrl(organizationId, sessionId, fileId) {
  return `${API_BASE_URL}${organizationDocumentPath(
    organizationId,
    `/stage/${encode(sessionId)}/files/${encode(fileId)}/content`,
  )}`
}

export function getUploadJobEventsUrl(organizationId, jobId) {
  return `${API_BASE_URL}${organizationDocumentPath(
    organizationId,
    `/upload-jobs/${encode(jobId)}/events`,
  )}`
}

export function getPlatformDocumentContentUrl(documentId) {
  return `${API_BASE_URL}${platformDocumentPath(`/${encode(documentId)}/content`)}`
}

export async function listOrganizationDocuments(organizationId, params = {}) {
  const response = await apiRequest(
    organizationDocumentPath(organizationId, queryString(params)),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}

export async function searchRagDocuments(organizationId, payload) {
  const response = await apiRequest(organizationDocumentPath(organizationId, '/rag/search'), {
    body: payload,
    cache: 'no-store',
    method: 'POST',
    requiresAuth: true,
  })

  return getResponseData(response)
}

export async function askRagDocuments(organizationId, payload) {
  const response = await csrfRequest(organizationDocumentPath(organizationId, '/rag/ask'), {
    body: payload,
    cache: 'no-store',
    method: 'POST',
    requiresAuth: true,
  })

  return getResponseData(response)
}

export async function listRagChats(organizationId) {
  const response = await apiRequest(organizationDocumentPath(organizationId, '/rag/chats'), {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response).chats ?? []
}

export async function getRagChat(organizationId, chatSessionId) {
  const response = await apiRequest(
    organizationDocumentPath(organizationId, `/rag/chats/${encode(chatSessionId)}`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}

export async function deleteRagChat(organizationId, chatSessionId) {
  await csrfRequest(
    organizationDocumentPath(organizationId, `/rag/chats/${encode(chatSessionId)}`),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )
}

export async function getRagDocumentStatuses(organizationId) {
  const response = await apiRequest(organizationDocumentPath(organizationId, '/rag/status'), {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response).documents
}

export async function reindexRagDocuments(organizationId, payload = {}) {
  const response = await csrfRequest(
    organizationDocumentPath(organizationId, '/rag/reindex'),
    {
      body: payload,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).documents
}

export async function listPlatformDocuments(params = {}) {
  const response = await apiRequest(platformDocumentPath(queryString(params)), {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response)
}

export async function getDocumentPreview(organizationId, documentId) {
  const response = await apiRequest(
    organizationDocumentPath(organizationId, `/${encode(documentId)}/preview`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).preview
}

export async function getDocumentVersions(organizationId, documentId) {
  const response = await apiRequest(
    organizationDocumentPath(organizationId, `/${encode(documentId)}/versions`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).versions
}

export async function stageOrganizationDocuments(organizationId, files) {
  const response = await csrfRequest(
    organizationDocumentPath(organizationId, '/stage'),
    {
      body: formDataWithFiles('files', files),
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).uploadSession
}

export async function getZipManifest(organizationId, archive) {
  const formData = new FormData()
  formData.append('archive', archive)

  const response = await csrfRequest(
    organizationDocumentPath(organizationId, '/zip-manifest'),
    {
      body: formData,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}

export async function stageZipOrganizationDocuments(
  organizationId,
  archive,
  selectedPaths,
) {
  const formData = new FormData()
  formData.append('archive', archive)
  formData.append('selectedPaths', JSON.stringify(selectedPaths))

  const response = await csrfRequest(
    organizationDocumentPath(organizationId, '/stage-zip'),
    {
      body: formData,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).uploadSession
}

export async function removeStagedDocumentFile(organizationId, sessionId, fileId) {
  const response = await csrfRequest(
    organizationDocumentPath(
      organizationId,
      `/stage/${encode(sessionId)}/files/${encode(fileId)}`,
    ),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )

  return getResponseData(response).uploadSession
}

export async function commitUploadSession(organizationId, sessionId) {
  const response = await csrfRequest(
    organizationDocumentPath(organizationId, `/stage/${encode(sessionId)}/commit`),
    {
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).uploadJob
}

export async function uploadDocumentVersion(organizationId, documentId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await csrfRequest(
    organizationDocumentPath(organizationId, `/${encode(documentId)}/versions`),
    {
      body: formData,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).document
}

export async function deleteOrganizationDocument(organizationId, documentId) {
  const response = await csrfRequest(
    organizationDocumentPath(organizationId, `/${encode(documentId)}`),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )

  return getResponseData(response).document
}

export async function restoreOrganizationDocument(organizationId, documentId) {
  const response = await csrfRequest(
    organizationDocumentPath(organizationId, `/${encode(documentId)}/restore`),
    {
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).document
}

export async function restorePlatformDocument(documentId) {
  const response = await csrfRequest(
    platformDocumentPath(`/${encode(documentId)}/restore`),
    {
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).document
}

export async function purgePlatformDocument(documentId) {
  const response = await csrfRequest(
    platformDocumentPath(`/${encode(documentId)}/permanent`),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )

  return getResponseData(response).document
}
