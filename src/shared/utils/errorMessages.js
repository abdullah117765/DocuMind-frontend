const TECHNICAL_ERROR_MARKERS = [
  'aborterror',
  'backend',
  'connection refused',
  'content endpoint',
  'conversion worker',
  'document ai service',
  'embedding',
  'enoent',
  'fastapi',
  'hmac',
  'image text extraction failed',
  'indexing',
  'invalid `',
  'libreoffice',
  'metadata',
  'nest]',
  'prisma',
  'pymupdf',
  'qdrant',
  'relation "',
  'serviceunavailable',
  'soft-delete',
  'stack',
  'storage',
  'tesseract',
  'this operation was aborted',
  'traceback',
  'vector',
]

const FRIENDLY_STATUS_MESSAGES = {
  400: 'Please check the details and try again.',
  401: 'Please sign in again to continue.',
  403: 'Your current role cannot perform this action.',
  404: 'We could not find the requested item.',
  409: 'This action conflicts with existing information. Please review and try again.',
  413: 'The selected file is too large.',
  415: 'This file type is not supported.',
  429: 'Too many requests right now. Please wait a moment and try again.',
  500: 'Something went wrong. Please try again.',
  502: 'This feature is temporarily unavailable. Please try again shortly.',
  503: 'This feature is temporarily unavailable. Please try again shortly.',
  504: 'The request took too long. Please try again shortly.',
}

function hasTechnicalMarker(message) {
  const lowerMessage = String(message ?? '').toLowerCase()

  return TECHNICAL_ERROR_MARKERS.some((marker) =>
    lowerMessage.includes(marker),
  )
}

export function getFriendlyErrorMessage(error, fallback) {
  const code = Number(error?.code ?? error?.status ?? error?.statusCode)
  const message = String(error?.message ?? error ?? '').trim()
  const statusFallback = Number.isFinite(code)
    ? FRIENDLY_STATUS_MESSAGES[code]
    : null
  const defaultMessage =
    fallback ?? statusFallback ?? 'Something went wrong. Please try again.'

  if (!message || hasTechnicalMarker(message)) {
    return defaultMessage
  }

  return message
}
