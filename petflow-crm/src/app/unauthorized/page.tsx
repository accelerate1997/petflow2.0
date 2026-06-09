'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  useEffect(() => {
    signOut({ callbackUrl: '/login?error=deactivated' })
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 font-sans">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="mx-auto w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-6">
          <ShieldAlert size={32} className="animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your account is inactive. You are being signed out...
        </p>
      </div>
    </div>
  )
}
