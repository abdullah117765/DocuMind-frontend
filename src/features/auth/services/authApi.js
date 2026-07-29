import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'

export async function login(credentials) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  })
  return getResponseData(response)
}

export async function register(user) {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: user,
  })
  return getResponseData(response)
}
