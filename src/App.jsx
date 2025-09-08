import React from 'react'
import CookieCraze from './components/CookieCraze.jsx'
import { AuthProvider, withAuth } from './hooks/useAuth.jsx'
import { SecurityMiddleware } from './components/SecurityMiddleware.jsx'

// Wrap CookieCraze with authentication
const SecureCookieCraze = withAuth(CookieCraze);

export default function App() {
  return (
    <AuthProvider>
      <SecurityMiddleware>
        <div className="min-h-screen w-full relative overflow-hidden bg-bakery-warm text-amber-50">
          {/* beams + grid néon */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid-glow" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[120vw] h-56 rounded-full beam-top" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[120vw] h-56 rounded-full beam-bottom" />

          <SecureCookieCraze />
        </div>
      </SecurityMiddleware>
    </AuthProvider>
  )
}
