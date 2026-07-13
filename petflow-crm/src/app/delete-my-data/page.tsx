'use client'

import { useState } from 'react'
import { ShieldCheck, Trash2, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Step = 'form' | 'confirm' | 'done' | 'error'

export default function DeleteMyDataPage() {
  const [step, setStep] = useState<Step>('form')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [requestType, setRequestType] = useState<'ERASURE' | 'ACCESS' | 'PORTABILITY'>('ERASURE')
  const [loading, setLoading] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone && !email) {
      setErrorMsg('Please provide your phone number or email.')
      return
    }
    setStep('confirm')
  }

  const handleConfirm = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/privacy/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: requestType, phone: phone || undefined, email: email || undefined })
      })
      const data = await res.json()
      if (data.success) {
        setRequestId(data.request_id)
        setDeadline(data.deadline ? new Date(data.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
        setStep('done')
      } else {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setStep('error')
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const REQUEST_LABELS: Record<string, { label: string; desc: string; icon: string }> = {
    ERASURE: { label: 'Delete My Data', desc: 'Remove your personal information from our system', icon: '🗑️' },
    ACCESS: { label: 'Access My Data', desc: 'Get a copy of all data we hold about you', icon: '📋' },
    PORTABILITY: { label: 'Download My Data', desc: 'Receive your data in a portable format (JSON)', icon: '📦' },
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm mb-4">
            <ShieldCheck size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Your Data Rights</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit a request to access, delete, or download your personal data.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* ── Step 1: Form ── */}
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Request type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">What would you like to do?</label>
                <div className="flex flex-col gap-2">
                  {(['ERASURE', 'ACCESS', 'PORTABILITY'] as const).map(type => {
                    const opt = REQUEST_LABELS[type]
                    return (
                      <label
                        key={type}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          requestType === type ? 'border-red-400 bg-red-50' : 'border-gray-100 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={type}
                          checked={requestType === type}
                          onChange={() => setRequestType(type)}
                          className="accent-red-500"
                        />
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{opt.icon} {opt.label}</div>
                          <div className="text-xs text-gray-500">{opt.desc}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Identify yourself */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Your Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Or Your Email</label>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">Provide at least one to identify your account.</p>
              </div>

              {errorMsg && (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{errorMsg}</div>
              )}

              <button
                type="submit"
                className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Continue →
              </button>
            </form>
          )}

          {/* ── Step 2: Confirm ── */}
          {step === 'confirm' && (
            <div className="flex flex-col gap-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Please confirm your request</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {requestType === 'ERASURE'
                    ? 'Your personal data (name, phone, email, address, and chat history) will be permanently removed. Your invoices and appointment records will be kept as required by law.'
                    : requestType === 'ACCESS'
                    ? 'You will receive a summary of all personal data we hold about you.'
                    : 'You will receive a downloadable copy of all your data in JSON format.'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-sm">
                <div className="text-gray-500 mb-1 font-medium">Request details</div>
                <div className="flex justify-between text-gray-700">
                  <span>Type</span>
                  <span className="font-semibold">{REQUEST_LABELS[requestType].label}</span>
                </div>
                {phone && (
                  <div className="flex justify-between text-gray-700 mt-1">
                    <span>Phone</span>
                    <span className="font-semibold">{phone}</span>
                  </div>
                )}
                {email && (
                  <div className="flex justify-between text-gray-700 mt-1">
                    <span>Email</span>
                    <span className="font-semibold">{email}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors ${
                    requestType === 'ERASURE' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'
                  } disabled:opacity-50`}
                >
                  {loading ? 'Submitting...' : requestType === 'ERASURE' ? '🗑️ Submit Deletion Request' : '✅ Submit Request'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Request Submitted!</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Your request has been received and will be processed by the spa.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 w-full text-left text-sm">
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>Reference ID</span>
                  <span className="font-mono text-xs">{requestId.slice(-8).toUpperCase()}</span>
                </div>
                {deadline && (
                  <div className="flex justify-between text-gray-600">
                    <span>Response by</span>
                    <span className="font-semibold text-gray-800">{deadline}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Keep your reference ID for follow-up. The spa will contact you once your request is fulfilled.
              </p>
              <Link href="/privacy-policy" className="text-xs text-blue-600 underline">
                View our Privacy Policy
              </Link>
            </div>
          )}

          {/* ── Step 4: Error ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Something went wrong</h2>
                <p className="text-sm text-red-500 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setStep('form'); setErrorMsg('') }}
                className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                ← Try again
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Protected under{' '}
          <span className="font-medium">DPDP Act 🇮🇳 · PDPL 🇦🇪 · CCPA 🇺🇸</span>
        </p>
      </div>
    </div>
  )
}
