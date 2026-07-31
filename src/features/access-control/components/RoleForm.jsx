import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { PermissionSelector } from './PermissionSelector.jsx'

export function RoleForm({
  isSaving,
  onCancel,
  onSubmit,
  permissions,
  role,
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [permissionCodes, setPermissionCodes] = useState(
    role?.permissions?.map(({ code }) => code) ?? [],
  )

  function handleSubmit(event) {
    event.preventDefault()
    void onSubmit({
      description: description.trim() || null,
      name: name.trim().replace(/\s+/g, ' '),
      permissionCodes,
    })
  }

  return (
    <form className="form role-form" onSubmit={handleSubmit}>
      <Input
        disabled={isSaving}
        label="Role name"
        maxLength="100"
        minLength="2"
        onChange={(event) => setName(event.target.value)}
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
          Optional · {description.length}/500 characters
        </span>
      </label>
      <div>
        <span className="field__label">Permissions</span>
        <p className="permission-selector__hint">
          Permissions come from the backend catalog and are saved as a complete
          replacement set.
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
          {isSaving ? 'Saving…' : role ? 'Save role' : 'Create role'}
        </Button>
      </div>
    </form>
  )
}
