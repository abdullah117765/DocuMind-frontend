import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { PermissionSelector } from './PermissionSelector.jsx'

function normalizeRoleName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function RoleForm({
  existingRoleNames = [],
  isSaving,
  onCancel,
  onSubmit,
  permissions,
  role,
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [nameError, setNameError] = useState('')
  const [permissionCodes, setPermissionCodes] = useState(
    role?.permissions?.map(({ code }) => code) ?? [],
  )

  function validateRoleName(value) {
    const normalizedName = normalizeRoleName(value)
    const currentName = normalizeRoleName(role?.name ?? '').toLowerCase()
    const duplicateName = existingRoleNames.some((existingName) => {
      const normalizedExistingName =
        normalizeRoleName(existingName).toLowerCase()

      return (
        normalizedExistingName === normalizedName.toLowerCase() &&
        normalizedExistingName !== currentName
      )
    })

    if (!normalizedName) return 'Role name is required.'
    if (normalizedName.length < 2) return 'Use at least 2 characters.'
    if (normalizedName.length > 100) return 'Use no more than 100 characters.'
    if (!/^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/.test(normalizedName)) {
      return 'Use letters, numbers, and single spaces only.'
    }
    if (duplicateName) return 'A role with this name already exists.'

    return ''
  }

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedName = normalizeRoleName(name)
    const nextNameError = validateRoleName(normalizedName)

    setNameError(nextNameError)
    if (nextNameError) return

    void onSubmit({
      description: description.trim() || null,
      name: normalizedName,
      permissionCodes,
    })
  }

  return (
    <form className="form role-form" onSubmit={handleSubmit}>
      <Input
        disabled={isSaving}
        error={nameError}
        hint="Letters, numbers, and single spaces only."
        label="Role name"
        maxLength="100"
        minLength="2"
        onChange={(event) => {
          setName(event.target.value)
          setNameError('')
        }}
        placeholder="Document Reviewer"
        required
        value={name}
      />
      <label className="field">
        <span className="field__label">Description</span>
        <textarea
          disabled={isSaving}
          maxLength="500"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Explain what this role is responsible for."
          rows="3"
          value={description}
        />
        <span className="field__hint">
          Optional - {description.length}/500 characters
        </span>
      </label>
      <div>
        <span className="field__label">Access</span>
        <p className="permission-selector__hint">
          Choose what people with this role should be allowed to do.
        </p>
        <PermissionSelector
          disabled={isSaving}
          onChange={setPermissionCodes}
          permissions={permissions}
          selectedCodes={permissionCodes}
        />
      </div>
      <div className="form-actions">
        <Button disabled={isSaving} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : role ? 'Save role' : 'Create role'}
        </Button>
      </div>
    </form>
  )
}
