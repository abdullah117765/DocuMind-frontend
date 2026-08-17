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

function knowledgeBasePath(organizationId, suffix = '') {
  return `/organizations/${encode(organizationId)}/knowledge-bases${suffix}`
}

export async function listKnowledgeBases(organizationId, params = {}) {
  const response = await apiRequest(
    knowledgeBasePath(organizationId, queryString(params)),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}

export async function createKnowledgeBase(organizationId, payload) {
  const response = await csrfRequest(knowledgeBasePath(organizationId), {
    body: payload,
    method: 'POST',
    requiresAuth: true,
  })

  return getResponseData(response).knowledgeBase
}

export async function getKnowledgeBase(organizationId, knowledgeBaseId) {
  const response = await apiRequest(
    knowledgeBasePath(organizationId, `/${encode(knowledgeBaseId)}`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).knowledgeBase
}

export async function listKnowledgeBaseCollections(organizationId, knowledgeBaseId) {
  const response = await apiRequest(
    knowledgeBasePath(organizationId, `/${encode(knowledgeBaseId)}/collections`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).collections ?? []
}

export async function listKnowledgeBaseFolders(organizationId, knowledgeBaseId) {
  const response = await apiRequest(
    knowledgeBasePath(organizationId, `/${encode(knowledgeBaseId)}/folders`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).folders ?? []
}

export async function listKnowledgeBaseCategories(organizationId) {
  const response = await apiRequest(knowledgeBasePath(organizationId, '/categories'), {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response).categories ?? []
}

export async function listKnowledgeBaseTags(organizationId) {
  const response = await apiRequest(knowledgeBasePath(organizationId, '/tags'), {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response).tags ?? []
}

export async function createKnowledgeBaseCollection(
  organizationId,
  knowledgeBaseId,
  payload,
) {
  const response = await csrfRequest(
    knowledgeBasePath(organizationId, `/${encode(knowledgeBaseId)}/collections`),
    {
      body: payload,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).collection
}

export async function deleteKnowledgeBase(organizationId, knowledgeBaseId) {
  const response = await csrfRequest(
    knowledgeBasePath(organizationId, `/${encode(knowledgeBaseId)}`),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )

  return getResponseData(response).knowledgeBase
}

export async function addDocumentsToCollection(
  organizationId,
  knowledgeBaseId,
  collectionId,
  documentIds,
) {
  const response = await csrfRequest(
    knowledgeBasePath(
      organizationId,
      `/${encode(knowledgeBaseId)}/collections/${encode(collectionId)}/documents`,
    ),
    {
      body: { documentIds },
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}

export async function removeDocumentFromCollection(
  organizationId,
  knowledgeBaseId,
  collectionId,
  documentId,
) {
  const response = await csrfRequest(
    knowledgeBasePath(
      organizationId,
      `/${encode(knowledgeBaseId)}/collections/${encode(collectionId)}/documents/${encode(documentId)}`,
    ),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}
