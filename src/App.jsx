import { AuthProvider } from './features/auth/context/AuthContext.jsx'
import { AppRoutes } from './routes/AppRoutes.jsx'

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
