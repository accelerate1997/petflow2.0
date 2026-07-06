'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { validateInviteToken, registerViaInvite } from '@/lib/invite-actions'
import { PawPrint, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, UserPlus } from 'lucide-react'

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') || ''

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading')
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); setError('No invite token found in this link.'); return }
    validateInviteToken(token).then(res => {
      if (res.valid && res.invite) {
        setInvite(res.invite)
        setStatus('valid')
      } else {
        setStatus('invalid')
        setError(res.error || 'Invalid invite.')
      }
    })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Name is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setSubmitting(true)
    try {
      await registerViaInvite(token, name, password)
      setStatus('success')
    } catch (err: any) {
      setError(err.message || 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f0f5f2 0%, #e8f0ec 100%)' }}
    >
      <div
        className="w-full max-w-[420px] bg-white rounded-[24px] shadow-xl p-8"
        style={{ border: '1px solid rgba(137,168,148,0.2)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #89A894 0%, #6d8f7a 100%)' }}
          >
            <PawPrint size={22} color="white" />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#111' }}>PetFlow</p>
            <p style={{ fontSize: '0.7rem', color: '#89A894', fontWeight: 500 }}>Spa CRM</p>
          </div>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-10 text-gray-400">
            <Loader2 size={36} className="animate-spin" style={{ color: '#89A894' }} />
            <p className="text-sm">Validating your invite...</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Invite Invalid</h2>
            <p className="text-sm text-gray-500">{error}</p>
            <a href="/login" className="text-sm font-semibold" style={{ color: '#89A894' }}>
              Go to Login →
            </a>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">You're all set! 🎉</h2>
            <p className="text-sm text-gray-500">Your account has been created. You can now log in.</p>
            <button
              onClick={() => router.push('/login')}
              className="btn-sage w-full justify-center mt-2"
            >
              Go to Login
            </button>
          </div>
        )}

        {status === 'valid' && invite && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus size={18} style={{ color: '#89A894' }} />
                <h2 className="text-xl font-bold text-gray-900">Create Your Account</h2>
              </div>
              <p className="text-sm text-gray-500">
                You've been invited to join PetFlow as <strong>{invite.role}</strong>.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-600 text-gray-700 block mb-1.5">Email Address</label>
                <input
                  className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={invite.email}
                  readOnly
                />
              </div>

              <div>
                <label className="text-sm font-600 text-gray-700 block mb-1.5">Full Name</label>
                <input
                  className="input-field"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-600 text-gray-700 block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-600 text-gray-700 block mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-sage w-full justify-center py-3 mt-1"
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating account...</>
                ) : (
                  'Create Account'
                )}
              </button>

              <p className="text-center text-xs text-gray-400 mt-1">
                By creating an account you agree to our{' '}
                <a href="/terms" className="underline" style={{ color: 'var(--sage-dark)' }}>Terms</a>
                {' '}&amp;{' '}
                <a href="/privacy-policy" className="underline" style={{ color: 'var(--sage-dark)' }}>Privacy Policy</a>.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
