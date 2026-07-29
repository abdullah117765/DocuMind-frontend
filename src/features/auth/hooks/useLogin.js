import { useState } from 'react'
import { useAuth } from './useAuth.js'
import { login as loginRequest } from '../services/authApi.js'

export function useLogin() {
  const { setUser } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function login(credentials) {
    setIsLoading(true)
    setError(null)

    try {
      const data = await loginRequest(credentials)
      setUser(data.user)
      return data
    } catch (requestError) {
      setError(requestError)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }

  return { error, isLoading, login }
}
