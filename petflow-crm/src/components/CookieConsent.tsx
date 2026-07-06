'use client'

import { useEffect, useState } from 'react'
import { Cookie, Shield, BarChart2, Settings2, X, ChevronDown, ChevronUp } from 'lucide-react'

type ConsentState = {
  necessary: boolean
  analytics: boolean
  preferences: boolean
}

const CONSENT_KEY = 'petflow_cookie_consent'

function loadConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveConsent(state: ConsentState) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state))
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    analytics: false,
    preferences: false,
  })
  const [mounted, setMounted] = useState(false)
  const [hasConsented, setHasConsented] = useState(false)

  useEffect(() => {
    setMounted(true)
    const existing = loadConsent()
    if (!existing) {
      // Small delay so the page renders first
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    } else {
      setHasConsented(true)
      setConsent(existing)
    }
  }, [])

  const acceptAll = () => {
    const full: ConsentState = { necessary: true, analytics: true, preferences: true }
    saveConsent(full)
    setConsent(full)
    setVisible(false)
    setHasConsented(true)
  }

  const rejectAll = () => {
    const minimal: ConsentState = { necessary: true, analytics: false, preferences: false }
    saveConsent(minimal)
    setConsent(minimal)
    setVisible(false)
    setHasConsented(true)
  }

  const saveCustom = () => {
    saveConsent(consent)
    setVisible(false)
    setHasConsented(true)
  }

  const openPreferences = () => {
    const existing = loadConsent()
    if (existing) setConsent(existing)
    setShowDetails(true)
    setVisible(true)
  }

  if (!mounted) return null

  return (
    <>
      {visible && (
        <>
      {/* Backdrop blur on mobile */}
      <div
        className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-[9990] md:hidden"
        onClick={rejectAll}
      />

      {/* Banner */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9991] w-[calc(100%-2rem)] max-w-xl"
        style={{ animation: 'cookieSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <div
          className="rounded-2xl shadow-2xl border border-white/60"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-5 pb-3">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--sage-muted)' }}
            >
              <Cookie size={20} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                We value your privacy 🐾
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                We use cookies to keep the app running smoothly, remember your preferences, and understand how it&apos;s used.
              </p>
            </div>
            <button
              onClick={rejectAll}
              className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>

          {/* Details toggle */}
          <div className="px-5">
            <button
              onClick={() => setShowDetails(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors mb-3"
              style={{ color: 'var(--sage-dark)' }}
            >
              {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showDetails ? 'Hide details' : 'Customize preferences'}
            </button>

            {showDetails && (
              <div
                className="rounded-xl p-3 mb-3 space-y-3"
                style={{
                  background: 'var(--sage-muted)',
                  animation: 'cookieFadeIn 0.2s ease',
                }}
              >
                {/* Necessary */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center bg-white/70">
                    <Shield size={14} style={{ color: 'var(--sage-dark)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Necessary</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/60 text-gray-500">
                        Always on
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Session auth, security tokens, and core app functionality.
                    </p>
                  </div>
                </div>

                {/* Analytics */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center bg-white/70">
                    <BarChart2 size={14} style={{ color: 'var(--sage-dark)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Analytics</p>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={consent.analytics}
                          onChange={e =>
                            setConsent(c => ({ ...c, analytics: e.target.checked }))
                          }
                        />
                        <div
                          className="w-8 h-4 rounded-full transition-all peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"
                          style={{
                            background: consent.analytics ? 'var(--sage)' : '#d1d5db',
                            position: 'relative',
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Anonymous usage data to improve the product.
                    </p>
                  </div>
                </div>

                {/* Preferences */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center bg-white/70">
                    <Settings2 size={14} style={{ color: 'var(--sage-dark)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Preferences</p>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={consent.preferences}
                          onChange={e =>
                            setConsent(c => ({ ...c, preferences: e.target.checked }))
                          }
                        />
                        <div
                          className="w-8 h-4 rounded-full transition-all"
                          style={{
                            background: consent.preferences ? 'var(--sage)' : '#d1d5db',
                            position: 'relative',
                          }}
                        >
                          <div
                            className="absolute top-0.5 h-3 w-3 bg-white rounded-full transition-all"
                            style={{
                              left: consent.preferences ? 'calc(100% - 14px)' : '2px',
                            }}
                          />
                        </div>
                      </label>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Sidebar state, theme, language, and UI layout preferences.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-5 pb-5">
            <button
              onClick={rejectAll}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Reject all
            </button>
            {showDetails ? (
              <button
                onClick={saveCustom}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'var(--sage)' }}
              >
                Save preferences
              </button>
            ) : (
              <button
                onClick={acceptAll}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'var(--sage)' }}
              >
                Accept all
              </button>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Persistent Manage Preferences button — shown after consent given */}
      {hasConsented && !visible && (
        <button
          onClick={openPreferences}
          aria-label="Manage cookie preferences"
          title="Manage cookie preferences"
          className="fixed bottom-8 left-4 z-[9990] flex items-center gap-1.5 px-3 py-2 rounded-full shadow-md border border-gray-200 bg-white/90 backdrop-blur text-xs font-medium text-gray-500 hover:text-gray-700 hover:shadow-lg transition-all"
          style={{ animation: 'cookieFadeIn 0.3s ease' }}
        >
          <Cookie size={13} style={{ color: 'var(--sage-dark)' }} />
          Cookies
        </button>
      )}


      <style jsx global>{`
        @keyframes cookieSlideUp {
          from { opacity: 0; transform: translate(-50%, 24px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes cookieFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
