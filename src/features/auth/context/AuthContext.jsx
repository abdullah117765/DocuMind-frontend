import { useCallback, useEffect, useMemo, useState } from 'react'
import { setAuthenticationRecovery } from '../../../shared/utils/apiClient.js'
import {
  getCurrentAuthentication,
  login,
  logoutAllSessions,
  logoutCurrentSession,
  refreshSession,
} from '../services/authApi.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('loading')

  const applyAuthentication = useCallback((data) => {
    setUser(data.user)
    setSession(data.session)
    setStatus('authenticated')
  }, [])

  const clearAuthentication = useCallback(() => {
    setUser(null)
    setSession(null)
    setStatus('unauthenticated')
  }, [])

  const recoverAuthentication = useCallback(async () => {
    try {
      const data = await refreshSession()
      applyAuthentication(data)
      return data
    } catch (error) {
      if ([401, 403, 498].includes(error?.code)) {
        clearAuthentication()
      }

      throw error
    }
  }, [applyAuthentication, clearAuthentication])

  useEffect(
    () => setAuthenticationRecovery(recoverAuthentication),
    [recoverAuthentication],
  )

  useEffect(() => {
    let active = true

    async function bootstrapAuthentication() {
      try {
        const data = await getCurrentAuthentication()

        if (active) applyAuthentication(data)
      } catch (error) {
        if (error?.code === 401) {
          try {
            const data = await refreshSession()

            if (active) applyAuthentication(data)
            return
          } catch {
            // An absent or invalid refresh cookie means the visitor is signed out.
          }
        }

        if (active) clearAuthentication()
      }
    }

    void bootstrapAuthentication()

    return () => {
      active = false
    }
  }, [applyAuthentication, clearAuthentication])

  const signIn = useCallback(
    async (credentials) => {
      const data = await login(credentials)
      applyAuthentication(data)
      return data
    },
    [applyAuthentication],
  )

  const refreshAuthentication = useCallback(async () => {
    const data = await getCurrentAuthentication()
    applyAuthentication(data)
    return data
  }, [applyAuthentication])

  const signOut = useCallback(async () => {
    await logoutCurrentSession()
    clearAuthentication()
  }, [clearAuthentication])

  const signOutAll = useCallback(async () => {
    await logoutAllSessions()
    clearAuthentication()
  }, [clearAuthentication])

  const value = useMemo(
    () => ({
      clearAuthentication,
      isAuthenticated: status === 'authenticated',
      session,
      refreshAuthentication,
      signIn,
      signOut,
      signOutAll,
      status,
      user,
    }),
    [
      clearAuthentication,
      refreshAuthentication,
      session,
      signIn,
      signOut,
      signOutAll,
      status,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
