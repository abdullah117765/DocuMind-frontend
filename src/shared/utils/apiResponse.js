export function getResponseData(response) {
  return response.data
}

export function getPagination(response) {
  return response.data?.pagination ?? null
}

export function getValidationIssues(error) {
  return Array.isArray(error.details) ? error.details : []
}
