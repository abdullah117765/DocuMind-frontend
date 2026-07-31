import { ApiError } from './apiError.js'
import { API_BASE_URL } from '../constants/env.js'

let authenticationRecovery = null

export function setAuthenticationRecovery(recover) {
  authenticationRecovery = recover

  return () => {
    if (authenticationRecovery === recover) {
      authenticationRecovery = null
    }
  }
}

export async function apiRequest(path, options = {}) {
  const {
    requiresAuth = false,
    retryAuthentication = true,
    ...requestOptions
  } = options

  try {
    return await performRequest(path, requestOptions)
  } catch (error) {
    const canRecover =
      error instanceof ApiError &&
      error.code === 401 &&
      requiresAuth &&
      retryAuthentication &&
      authenticationRecovery

    if (!canRecover) {
      throw error
    }

    await authenticationRecovery()

    return performRequest(path, requestOptions)
  }
}

async function performRequest(path, options = {}) {
  const hasBody = options.body !== undefined
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body:
      hasBody && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  })

  const payload = await parseJson(response)

  if (!response.ok || payload.status === 'error') {
    throw ApiError.fromResponse(response, payload)
  }

  return payload
}

async function parseJson(response) {
  if (response.status === 204) {
    return {}
  }

  try {
    return await response.json()
  } catch {
    throw new ApiError('The server returned an invalid response.', response.status)
  }
}
