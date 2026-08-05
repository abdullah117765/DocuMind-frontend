import { useContext } from 'react'
import { AccessControlContext } from '../context/accessControlContext.js'

export function useAccessControl() {
  const context = useContext(AccessControlContext)

  if (!context) {
    throw new Error('useAccessControl must be used inside AccessControlProvider')
  }

  return context
}
