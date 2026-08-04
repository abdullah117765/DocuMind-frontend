import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import {
  normalizeEmail,
  validateEmail,
} from '../../auth/components/validation.js'

export function MemberForm({
  isSaving,
  member,
  mode = 'add',
  onCancel,
  onSubmit,
  roles = [],
}) {
  const [email, setEmail] = useState(member?.user.email ?? '')
  const [emailError, setEmailError] = useState('')
  const [roleIds, setRoleIds] = useState(
    member?.roles.map(({ id }) => id) ?? [],
  )
  const selectedRoles = new Set(roleIds)

  function toggleRole(roleId) {
    const nextRoles = new Set(selectedRoles)

    if (nextRoles.has(roleId)) {
      nextRoles.delete(roleId)
    } else {
      nextRoles.add(roleId)
    }

    setRoleIds([...nextRoles])
  }

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedEmail = normalizeEmail(email)

    if (!member) {
      const nextEmailError = validateEmail(normalizedEmail)
      setEmailError(nextEmailError)

      if (nextEmailError) return
    }

    void onSubmit({
      ...(member ? {} : { email: normalizedEmail }),
      roleIds,
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {member ? (
        <div className="member-identity">
          <span className="field__label">Member</span>
          <strong>{member.user.email}</strong>
        </div>
      ) : (
        <Input
          autoComplete="email"
          disabled={isSaving}
          error={emailError}
          hint={
            mode === 'invite'
              ? 'They will receive an email invitation.'
              : 'The user must already have a verified account.'
          }
          label="Email"
          maxLength="254"
          onChange={(event) => {
            setEmail(event.target.value)
            setEmailError('')
          }}
          placeholder="employee@example.com"
          required
          type="email"
          value={email}
        />
      )}
      <fieldset className="role-options">
        <legend className="field__label">Organization roles</legend>
        <p>
          Multiple roles are allowed. Effective permissions are merged by the
          backend.
        </p>
        <div className="role-options__list">
          {roles.map((role) => (
            <label className="role-option" key={role.id}>
              <input
                checked={selectedRoles.has(role.id)}
                disabled={isSaving}
                onChange={() => toggleRole(role.id)}
                type="checkbox"
              />
              <span>
                <strong>{role.name}</strong>
                <small>
                  {role.permissions.length} permission
                  {role.permissions.length === 1 ? '' : 's'}
                  {role.isSystem ? ' · System role' : ' · Custom role'}
                </small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-actions">
        <Button disabled={isSaving} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={isSaving} type="submit">
          {isSaving
            ? 'Saving...'
            : member
              ? 'Save roles'
              : mode === 'invite'
                ? 'Send invite'
                : 'Add member'}
        </Button>
      </div>
    </form>
  )
}
