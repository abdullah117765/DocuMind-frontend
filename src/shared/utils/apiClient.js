import { ApiError } from './apiError.js'
import { API_BASE_URL } from '../constants/env.js'

export async function apiRequest(path, options = {}) {
  const hasBody = options.body !== undefined
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
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
  try {
    return await response.json()
  } catch {
    throw new ApiError('The server returned an invalid response.', response.status)
  }
}
