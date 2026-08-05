import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'
import { csrfRequest } from '../../../shared/utils/csrfRequest.js'

export async function getUsers(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )
  const suffix = query.toString() ? `?${query}` : ''
  const response = await apiRequest(`/users${suffix}`, {
    cache: 'no-store',
    requiresAuth: true,
  })
  return getResponseData(response)
}

export async function getUser(id) {
  const response = await apiRequest(`/users/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    requiresAuth: true,
  })
  return getResponseData(response).user
}

export async function createUser(user) {
  const response = await csrfRequest('/users', {
    body: user,
    method: 'POST',
    requiresAuth: true,
  })
  return getResponseData(response).user
}

export async function updateUser(id, values) {
  const response = await csrfRequest(`/users/${encodeURIComponent(id)}`, {
    body: values,
    method: 'PATCH',
    requiresAuth: true,
  })
  return getResponseData(response).user
}

export async function getPlatformRoles() {
  const response = await apiRequest('/users/platform-roles', {
    cache: 'no-store',
    requiresAuth: true,
  })
  return getResponseData(response).roles
}

export async function replacePlatformRoles(id, roleIds) {
  const response = await csrfRequest(
    `/users/${encodeURIComponent(id)}/platform-roles`,
    {
      body: { roleIds },
      method: 'PATCH',
      requiresAuth: true,
    },
  )
  return getResponseData(response).user
}
