import { useState } from 'react'
import { useAuth } from './useAuth.js'

export function useLogin() {
  const { signIn } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function login(credentials) {
    setIsLoading(true)
    setError(null)

    try {
      return await signIn(credentials)
    } catch (requestError) {
      setError(requestError)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }

  return { error, isLoading, login }
}
