import { getFriendlyErrorMessage } from './errorMessages.js'

export class ApiError extends Error {
  constructor(message, code, details = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }

  static fromResponse(response, payload = {}) {
    const code = payload.code ?? response.status
    const rawMessage = payload.message ?? response.statusText ?? 'Request failed'

    return new ApiError(
      getFriendlyErrorMessage(
        { code, message: rawMessage },
        'Something went wrong. Please try again.',
      ),
      code,
      payload.details ?? null,
    )
  }
}
