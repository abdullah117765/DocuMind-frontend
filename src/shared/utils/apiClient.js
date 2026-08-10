import { ApiError } from './apiError.js'
import { emitNetworkError } from '../networkEvents.js'
import { API_BASE_URL } from '../constants/env.js'

let authenticationRecovery = null

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError'
}

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
  if (isBrowserOffline()) {
    throw new ApiError(
      'Internet disconnected. Please reconnect and try again.',
      'NETWORK_OFFLINE',
    )
  }

  const hasBody = options.body !== undefined
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body:
        hasBody && !isFormData && typeof options.body !== 'string'
          ? JSON.stringify(options.body)
          : options.body,
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw new ApiError('Request was cancelled.', 'REQUEST_ABORTED')
    }

    const message = isBrowserOffline()
      ? 'Internet disconnected. Please reconnect and try again.'
      : 'Unable to reach the server. Please check your connection and try again.'

    emitNetworkError(message)
    throw new ApiError(
      message,
      isBrowserOffline() ? 'NETWORK_OFFLINE' : 'NETWORK_ERROR',
    )
  }

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
