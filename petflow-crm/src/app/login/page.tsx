'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PawPrint, Loader2 } from 'lucide-react'
import { Suspense } from 'react'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const errParam = searchParams?.get('error')
    if (errParam === 'deactivated') {
      setError('Your account has been deactivated. Please contact support.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (res?.error) {
        setError('Invalid email or password. Please try again.')
        setLoading(false)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)

    try {
      const { auth, googleProvider } = await import('@/lib/firebase')
      const { signInWithPopup } = await import('firebase/auth')
      
      const result = await signInWithPopup(auth, googleProvider)
      const token = await result.user.getIdToken()

      const res = await signIn('credentials', {
        redirect: false,
        token,
      })

      if (res?.error) {
        setError(res.error || 'Google authentication failed.')
        setLoading(false)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      console.error(err)
      
      let friendlyMessage = 'An error occurred during Google Sign-In.'
      const errorCode = err.code || ''
      const errorMessage = err.message || ''

      if (errorCode === 'auth/popup-closed-by-user' || errorMessage.includes('popup-closed-by-user')) {
        friendlyMessage = 'The Google sign-in window was closed before completion. Please try again.'
      } else if (errorCode === 'auth/popup-blocked' || errorMessage.includes('popup-blocked')) {
        friendlyMessage = 'The sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
      } else if (errorCode === 'auth/cancelled-popup-request' || errorMessage.includes('cancelled-popup-request')) {
        friendlyMessage = 'Only one sign-in popup can be opened at a time. Please complete or close the existing popup.'
      } else if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
        friendlyMessage = 'A network error occurred. Please check your internet connection and try again.'
      } else if (errorMessage) {
        friendlyMessage = errorMessage
      }

      setError(friendlyMessage)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* Left Column: Visual Branding */}
      <div 
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #89A894 0%, #5d7c69 100%)' }}
      >
        <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20">
            <PawPrint className="text-white" size={22} />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">PetFlow Pro</span>
        </div>

        <div className="my-auto max-w-md z-10">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
            Simplify your pet spa management.
          </h1>
          <p className="text-white/80 leading-relaxed text-base">
            Access appointment calendars, client CRM, automated campaigns, and boarding reservations in one unified, modern platform.
          </p>
        </div>

        <div className="text-white/60 text-xs z-10">
          © {new Date().getFullYear()} PetFlow CRM. All rights reserved.
        </div>
      </div>

      {/* Right Column: Sign In Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 transition-all duration-300">
          <div className="mb-8">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#89A894' }}>
                <PawPrint className="text-white" size={18} />
              </div>
              <span className="text-gray-900 font-bold">PetFlow</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
            <p className="text-gray-500 text-sm mt-1">Please sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                required
                placeholder="admin@petflow.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError('')
                }}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#89A894] focus:ring-2 focus:ring-[#89A894]/15 transition-all text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Password</label>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError('')
                }}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#89A894] focus:ring-2 focus:ring-[#89A894]/15 transition-all text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-medium text-sm transition-all duration-300 shadow-md shadow-[#89A894]/10 hover:shadow-[#89A894]/25 flex items-center justify-center gap-2 cursor-pointer border-0"
              style={{
                background: loading ? '#b3c7bc' : 'linear-gradient(135deg, #89A894 0%, #6d8f7a 100%)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Google Sign-in separator */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-100"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase">Or continue with</span>
              <div className="flex-grow border-t border-gray-100"></div>
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </button>
          </form>

          {/* Privacy & Terms links */}
          <p className="text-center text-xs text-gray-400 mt-5">
            By signing in, you agree to our{' '}
            <a href="/terms" className="underline hover:text-gray-600" style={{ color: 'var(--sage-dark)' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy-policy" className="underline hover:text-gray-600" style={{ color: 'var(--sage-dark)' }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] gap-4">
        <Loader2 className="w-8 h-8 text-[#89A894] animate-spin" />
        <p className="text-sm font-medium text-gray-500 font-sans">Loading login...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
