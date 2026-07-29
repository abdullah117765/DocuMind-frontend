import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'

export async function getUsers(params = {}) {
  const query = new URLSearchParams(params)
  const response = await apiRequest(`/users?${query}`)
  return getResponseData(response)
}

export async function getUser(id) {
  const response = await apiRequest(`/users/${id}`)
  return getResponseData(response)
}

export async function createUser(user) {
  const response = await apiRequest('/users', { method: 'POST', body: user })
  return getResponseData(response)
}
