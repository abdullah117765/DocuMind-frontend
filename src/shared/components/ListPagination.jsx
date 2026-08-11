import { Button } from './Button/Button.jsx'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50]

export function ListPagination({
  label = 'List pagination',
  onPageChange,
  onPageSizeChange,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  pagination,
}) {
  const total = pagination?.total ?? 0

  if (!pagination || total <= 0) {
    return null
  }

  const page = pagination.page ?? 1
  const pageCount = Math.max(pagination.pageCount ?? 1, 1)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="pagination-bar" aria-label={label}>
      <p>
        Showing <strong>{start}</strong>-<strong>{end}</strong> of{' '}
        <strong>{total}</strong>
      </p>

      <div className="pagination-bar__controls">
        <label className="pagination-bar__size">
          <span>Rows</span>
          <select
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
        >
          Previous
        </Button>
        <span className="pagination-bar__page">
          Page {page} of {pageCount}
        </span>
        <Button
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
        >
          Next
        </Button>
      </div>
    </div>
  )
}
