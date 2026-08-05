import { useEffect, useState } from 'react'
import { getUsers } from '../services/userApi.js'

export function useUsers(params = {}) {
  const [state, setState] = useState({
    users: [],
    pagination: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let isActive = true

    getUsers(params)
      .then((data) => {
        if (isActive) {
          setState({
            users: data.users ?? [],
            pagination: data.pagination ?? null,
            isLoading: false,
            error: null,
          })
        }
      })
      .catch((error) => {
        if (isActive) setState((current) => ({ ...current, isLoading: false, error }))
      })

    return () => {
      isActive = false
    }
  }, [params])

  return state
}
