export function getResponseData(response) {
  return response.data
}

export function getPagination(response) {
  return response.data?.pagination ?? null
}

export function getValidationIssues(error) {
  return Array.isArray(error?.details) ? error.details : []
}

export function getFieldErrors(error) {
  return getValidationIssues(error).reduce((fields, issue) => {
    if (issue?.field && issue?.issue && !fields[issue.field]) {
      fields[issue.field] = issue.issue
    }

    return fields
  }, {})
}
