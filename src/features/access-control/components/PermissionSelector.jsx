import { useId } from 'react'

function groupPermissions(permissions) {
  return permissions.reduce((groups, permission) => {
    const category = permission.category || 'Other'

    if (!groups.has(category)) groups.set(category, [])
    groups.get(category).push(permission)

    return groups
  }, new Map())
}

export function PermissionSelector({
  disabled = false,
  onChange,
  permissions = [],
  selectedCodes = [],
}) {
  const fieldsetId = useId()
  const selected = new Set(selectedCodes)
  const groups = [...groupPermissions(permissions).entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )

  function togglePermission(code) {
    const nextSelected = new Set(selected)

    if (nextSelected.has(code)) {
      nextSelected.delete(code)
    } else {
      nextSelected.add(code)
    }

    onChange([...nextSelected].sort((left, right) => left.localeCompare(right)))
  }

  function toggleCategory(categoryPermissions) {
    const nextSelected = new Set(selected)
    const everySelected = categoryPermissions.every(({ code }) =>
      nextSelected.has(code),
    )

    categoryPermissions.forEach(({ code }) => {
      if (everySelected) {
        nextSelected.delete(code)
      } else {
        nextSelected.add(code)
      }
    })

    onChange([...nextSelected].sort((left, right) => left.localeCompare(right)))
  }

  if (permissions.length === 0) {
    return <p className="supporting-copy">No access options are available.</p>
  }

  return (
    <div className="permission-selector">
      {groups.map(([category, categoryPermissions], groupIndex) => {
        const selectedCount = categoryPermissions.filter(({ code }) =>
          selected.has(code),
        ).length
        const categoryId = `${fieldsetId}-${groupIndex}`

        return (
          <fieldset className="permission-group" key={category}>
            <legend id={categoryId}>
              <span>{category}</span>
              <button
                className="text-button"
                disabled={disabled}
                onClick={() => toggleCategory(categoryPermissions)}
                type="button"
              >
                {selectedCount === categoryPermissions.length
                  ? 'Clear category'
                  : 'Select category'}
              </button>
            </legend>
            <div
              aria-labelledby={categoryId}
              className="permission-group__options"
            >
              {categoryPermissions.map((permission) => (
                <label className="permission-option" key={permission.code}>
                  <input
                    checked={selected.has(permission.code)}
                    disabled={disabled}
                    onChange={() => togglePermission(permission.code)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{permission.name}</strong>
                    <small>{permission.description ?? 'No description available.'}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
