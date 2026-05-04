'use client'

import { useState, useEffect } from 'react'
import { User, Clock, Globe, Save, CheckCircle2, AlertCircle, MessageSquare, RefreshCw, ExternalLink, Wifi, WifiOff, QrCode, Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Settings, BusinessHours } from '@/types'

const days = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'hours' | 'system' | 'whatsapp'>('profile')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // WhatsApp Integration state
  const [waConfig, setWaConfig] = useState({
    evolution_api_url: '',
    evolution_api_key: '',
    instance_name: '',
    openai_api_key: '',
    agent_public_url: '',
    booking_link: '',
    spa_name: '',
  })
  const [waConnected, setWaConnected] = useState(false)
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'awaiting_scan' | 'connected'>('disconnected')
  const [waQrCode, setWaQrCode] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [waChecking, setWaChecking] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [waSaving, setWaSaving] = useState(false)
  const [waMessage, setWaMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (data) setSettings(data as Settings)
    setLoading(false)
  }

  const loadWhatsAppConfig = async () => {
    const { data } = await supabase.from('whatsapp_config').select('*').eq('id', 1).single()
    if (data) {
      setWaConfig({
        evolution_api_url: data.evolution_api_url || '',
        evolution_api_key: data.evolution_api_key || '',
        instance_name: data.instance_name || '',
        openai_api_key: data.openai_api_key || '',
        agent_public_url: data.agent_public_url || '',
        booking_link: data.booking_link || '',
        spa_name: data.spa_name || '',
      })
      if (data.evolution_api_url && data.evolution_api_key && data.instance_name) {
        checkWhatsAppStatus(data.evolution_api_url, data.evolution_api_key, data.instance_name)
      }
    }
  }

  useEffect(() => {
    fetchSettings()
    loadWhatsAppConfig()
  }, [])

  const checkWhatsAppStatus = async (url?: string, key?: string, instance?: string) => {
    const apiUrl = url || waConfig.evolution_api_url
    const apiKey = key || waConfig.evolution_api_key
    const instanceName = instance || waConfig.instance_name

    if (!apiUrl || !apiKey || !instanceName) return

    setWaChecking(true)
    try {
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
      const res = await fetch(`${cleanUrl}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': apiKey }
      })
      if (res.ok) {
        const data = await res.json()
        const state = data?.instance?.state || data?.state || ''
        if (state === 'open' || state === 'connected') {
          setWaConnected(true)
          setWaStatus('connected')
        } else {
          setWaConnected(false)
          setWaStatus('disconnected')
        }
      } else {
        setWaConnected(false)
        setWaStatus('disconnected')
      }
    } catch {
      setWaConnected(false)
      setWaStatus('disconnected')
    }
    setWaChecking(false)
  }

  const handleWhatsAppConnect = async () => {
    if (!waConfig.evolution_api_url || !waConfig.evolution_api_key || !waConfig.instance_name) {
      setWaMessage({ type: 'error', text: 'Please fill in Evolution API URL, API Key, and Instance Name first.' })
      return
    }

    setWaStatus('connecting')
    setShowQrModal(true)
    setWaQrCode(null)

    try {
      const cleanUrl = waConfig.evolution_api_url.endsWith('/') ? waConfig.evolution_api_url.slice(0, -1) : waConfig.evolution_api_url

      // Try to create instance first (may already exist)
      await fetch(`${cleanUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': waConfig.evolution_api_key
        },
        body: JSON.stringify({
          instanceName: waConfig.instance_name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        })
      }).catch(() => { })

      // Get QR code for connection
      const qrRes = await fetch(`${cleanUrl}/instance/connect/${waConfig.instance_name}`, {
        headers: { 'apikey': waConfig.evolution_api_key }
      })

      if (qrRes.ok) {
        const qrData = await qrRes.json()
        const qrBase64 = qrData?.base64 || qrData?.qrcode?.base64 || null
        if (qrBase64) {
          setWaQrCode(qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`)
          setWaStatus('awaiting_scan')

          // Poll for connection status
          const pollInterval = setInterval(async () => {
            try {
              const stateRes = await fetch(`${cleanUrl}/instance/connectionState/${waConfig.instance_name}`, {
                headers: { 'apikey': waConfig.evolution_api_key }
              })
              if (stateRes.ok) {
                const stateData = await stateRes.json()
                const state = stateData?.instance?.state || stateData?.state || ''
                if (state === 'open' || state === 'connected') {
                  clearInterval(pollInterval)
                  setWaConnected(true)
                  setWaStatus('connected')
                  setShowQrModal(false)
                  setWaMessage({ type: 'success', text: 'WhatsApp connected successfully! 🎉' })
                  setTimeout(() => setWaMessage(null), 3000)
                }
              }
            } catch { }
          }, 3000)

          // Stop polling after 2 minutes
          setTimeout(() => clearInterval(pollInterval), 120000)
        } else {
          // Might already be connected
          await checkWhatsAppStatus()
          if (!waConnected) {
            setWaMessage({ type: 'error', text: 'Could not get QR code. Instance may already be connected.' })
          }
          setShowQrModal(false)
        }
      } else {
        setWaMessage({ type: 'error', text: 'Failed to connect to Evolution API. Check your URL and API Key.' })
        setShowQrModal(false)
        setWaStatus('disconnected')
      }
    } catch (err) {
      setWaMessage({ type: 'error', text: 'Could not reach Evolution API. Make sure the server is running.' })
      setShowQrModal(false)
      setWaStatus('disconnected')
    }
  }

  const handleWhatsAppDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return

    try {
      const cleanUrl = waConfig.evolution_api_url.endsWith('/') ? waConfig.evolution_api_url.slice(0, -1) : waConfig.evolution_api_url
      await fetch(`${cleanUrl}/instance/logout/${waConfig.instance_name}`, {
        method: 'DELETE',
        headers: { 'apikey': waConfig.evolution_api_key }
      })
    } catch { }

    setWaConnected(false)
    setWaStatus('disconnected')
    setWaMessage({ type: 'success', text: 'WhatsApp disconnected.' })
    setTimeout(() => setWaMessage(null), 3000)
  }

  const handleSaveWhatsAppConfig = async () => {
    setWaSaving(true)
    setWaMessage(null)

    // Upsert into whatsapp_config table
    const { error } = await supabase.from('whatsapp_config').upsert({
      id: 1,
      evolution_api_url: waConfig.evolution_api_url,
      evolution_api_key: waConfig.evolution_api_key,
      instance_name: waConfig.instance_name,
      openai_api_key: waConfig.openai_api_key,
      agent_public_url: waConfig.agent_public_url,
      booking_link: waConfig.booking_link,
      spa_name: waConfig.spa_name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    setWaSaving(false)
    if (error) {
      setWaMessage({ type: 'error', text: error.message })
    } else {
      setWaMessage({ type: 'success', text: 'WhatsApp configuration saved! ✅' })
      setTimeout(() => setWaMessage(null), 3000)
    }
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('settings').update({
      spa_name: settings.spa_name,
      spa_whatsapp: settings.spa_whatsapp,
      spa_email: settings.spa_email,
      spa_address: settings.spa_address,
      business_hours: settings.business_hours,
      currency_symbol: settings.currency_symbol,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)

    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const toggleShowKey = (field: string) => {
    setShowKeys(prev => ({ ...prev, [field]: !prev[field] }))
  }

  if (loading) return <div className="p-10 animate-pulse text-gray-400">Loading settings...</div>

  if (!settings) return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1000 }}>
      <div className="card p-12 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-700">Database Setup Required</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          It looks like the <code>settings</code> table hasn&apos;t been initialized in your Supabase database yet.
        </p>
        <div className="bg-gray-50 p-4 rounded-xl text-left text-sm font-mono border border-gray-100 mt-2">
          <p className="color-sage-dark font-600 mb-2"># Instructions:</p>
          <ol className="list-decimal pl-4 space-y-1 text-gray-600">
            <li>Open your Supabase SQL Editor</li>
            <li>Copy the code from <code>supabase_migration.sql</code> (lines 138-166)</li>
            <li>Run it to create the settings table and default profile</li>
          </ol>
        </div>
        <button className="btn-sage mt-4" onClick={fetchSettings}>
          Refresh Page
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>Settings ⚙️</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            Configure your spa profile, business hours, and integrations
          </p>
        </div>
        {activeTab !== 'whatsapp' && (
          <button 
            className="btn-sage" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        )}
      </div>

      {message && (
        <div 
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm font-500">{message.text}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-gray-50 p-1 rounded-xl border border-gray-100 w-fit">
        {[
          { id: 'profile', label: 'Spa Profile', icon: User },
          { id: 'hours', label: 'Business Hours', icon: Clock },
          { id: 'system', label: 'System', icon: Globe },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-600 transition-all ${
              activeTab === tab.id 
                ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={activeTab === 'whatsapp' ? '' : 'card p-8'}>
        {activeTab === 'profile' && settings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full mb-2">
              <h3 className="text-lg font-700 mb-1">General Information</h3>
              <p className="text-sm text-gray-400">Basic details about your pet spa</p>
            </div>
            <div>
              <label className="text-sm font-600 color-gray-700 block mb-2">Spa Name</label>
              <input
                className="input-field"
                value={settings.spa_name}
                onChange={e => setSettings({ ...settings, spa_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-600 color-gray-700 block mb-2">WhatsApp Number</label>
              <input
                className="input-field"
                value={settings.spa_whatsapp || ''}
                onChange={e => setSettings({ ...settings, spa_whatsapp: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-600 color-gray-700 block mb-2">Business Email</label>
              <input
                className="input-field"
                value={settings.spa_email || ''}
                onChange={e => setSettings({ ...settings, spa_email: e.target.value })}
              />
            </div>
            <div className="col-span-full">
              <label className="text-sm font-600 color-gray-700 block mb-2">Address</label>
              <textarea
                className="input-field"
                rows={3}
                value={settings.spa_address || ''}
                onChange={e => setSettings({ ...settings, spa_address: e.target.value })}
              />
            </div>
          </div>
        )}

        {activeTab === 'hours' && settings && (
          <div className="flex flex-col gap-4">
            <div className="mb-2">
              <h3 className="text-lg font-700 mb-1">Service Schedule</h3>
              <p className="text-sm text-gray-400">Configure your weekly operating hours</p>
            </div>
            <div className="flex flex-col gap-3">
              {days.map(day => {
                const hour = settings.business_hours[day.id] || { open: '09:00', close: '18:00', closed: false }
                
                const updateDay = (key: keyof BusinessHours, val: any) => {
                  const newHours = { ...settings.business_hours }
                  newHours[day.id] = { ...hour, [key]: val }
                  setSettings({ ...settings, business_hours: newHours })
                }

                return (
                  <div key={day.id} className="flex items-center gap-6 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="w-32 font-700 text-sm">{day.label}</div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        className="input-field w-32 py-1.5"
                        disabled={hour.closed}
                        value={hour.open}
                        onChange={e => updateDay('open', e.target.value)}
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        className="input-field w-32 py-1.5"
                        disabled={hour.closed}
                        value={hour.close}
                        onChange={e => updateDay('close', e.target.value)}
                      />
                    </div>

                    <div className="flex-1 flex justify-end">
                      <button
                        onClick={() => updateDay('closed', !hour.closed)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-700 transition-all ${
                          hour.closed 
                            ? 'bg-red-50 text-red-600' 
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {hour.closed ? 'CLOSED' : 'OPEN'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'system' && settings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full mb-2">
              <h3 className="text-lg font-700 mb-1">Preferences</h3>
              <p className="text-sm text-gray-400">System-wide configurations and localization</p>
            </div>
            <div>
              <label className="text-sm font-600 color-gray-700 block mb-2">Currency Symbol</label>
              <select
                className="input-field"
                value={settings.currency_symbol}
                onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
              >
                <option value="₹">Rupee (₹)</option>
                <option value="$">US Dollar ($)</option>
                <option value="€">Euro (€)</option>
                <option value="£">Pound (£)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-600 color-gray-700 block mb-2">Time Zone</label>
              <div className="input-field bg-gray-50 text-gray-400 select-none cursor-not-allowed">
                UTC +05:30 (India Standard Time)
              </div>
            </div>
          </div>
        )}

        {/* ─── WhatsApp Integration Tab ─── */}
        {activeTab === 'whatsapp' && (
          <div className="flex flex-col gap-6">

            {/* WhatsApp Message Banner */}
            {waMessage && (
              <div 
                className={`p-4 rounded-xl flex items-center gap-3 border ${
                  waMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}
              >
                {waMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-sm font-500">{waMessage.text}</p>
              </div>
            )}

            {/* ── Connection Status Card ── */}
            <div 
              className="card"
              style={{ 
                position: 'relative', 
                overflow: 'hidden',
                border: waConnected ? '1px solid rgba(37,211,102,0.3)' : '1px solid rgba(0,0,0,0.05)',
                boxShadow: waConnected ? '0 8px 24px rgba(37,211,102,0.08)' : undefined,
              }}
            >
              {/* Top accent bar */}
              {waConnected && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#25D366' }} />
              )}

              <div style={{ padding: '1.75rem' }}>
                <div className="flex items-start gap-4 mb-5">
                  {/* WhatsApp Icon */}
                  <div 
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: 'rgba(37,211,102,0.08)',
                      border: '1px solid rgba(37,211,102,0.15)',
                    }}
                  >
                    <MessageSquare size={26} color="#25D366" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                        WhatsApp Business
                      </h3>
                      {waConnected && <CheckCircle2 size={18} color="#25D366" />}
                    </div>
                    <p className="text-sm text-gray-500 mt-1" style={{ lineHeight: 1.6 }}>
                      Connect your WhatsApp via Evolution API to power Petro — your AI grooming assistant that auto-responds to clients 24/7.
                    </p>
                  </div>
                </div>

                {/* Connection Info (if connected) */}
                {waConnected && waConfig.instance_name && (
                  <div 
                    className="mb-5"
                    style={{ 
                      background: '#f8fdf9', padding: '1rem', borderRadius: 12,
                      border: '1px solid rgba(37,211,102,0.15)', fontSize: '0.8rem',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontWeight: 600, color: '#6b7280' }}>Instance:</span>
                      <span style={{ fontWeight: 700, color: '#111' }}>{waConfig.instance_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontWeight: 600, color: '#6b7280' }}>Status:</span>
                      <span className="flex items-center gap-2">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600, color: '#25D366' }}>Connected</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {waConnected ? (
                    <>
                      <button
                        onClick={handleWhatsAppDisconnect}
                        style={{
                          flex: 1, padding: '0.75rem', borderRadius: 12,
                          border: '1px solid #e5e7eb', background: 'white',
                          fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                          transition: 'all 0.2s', color: '#6b7280',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                      >
                        Disconnect
                      </button>
                      <button
                        onClick={() => checkWhatsAppStatus()}
                        style={{
                          flex: 1, padding: '0.75rem', borderRadius: 12,
                          border: '1px solid #e5e7eb', background: '#f9fafb',
                          fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          color: '#111',
                        }}
                      >
                        {waChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Check Status
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleWhatsAppConnect}
                      disabled={waStatus === 'connecting'}
                      style={{
                        width: '100%', padding: '0.875rem', border: 'none',
                        background: '#25D366', borderRadius: 14, color: 'white',
                        fontWeight: 700, fontSize: '0.9rem', cursor: waStatus === 'connecting' ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: waStatus === 'connecting' ? 0.8 : 1, transition: 'all 0.3s',
                        boxShadow: '0 8px 20px rgba(37,211,102,0.25)',
                      }}
                    >
                      {waStatus === 'connecting' ? (
                        <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                      ) : (
                        <><Wifi size={16} /> Connect WhatsApp</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                className="btn-sage"
                onClick={handleSaveWhatsAppConfig}
                disabled={waSaving}
                style={{ minWidth: 200 }}
              >
                {waSaving ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} /> Save WhatsApp Config</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── QR Code Modal ─── */}
      {showQrModal && (
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(8px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowQrModal(false) }}
        >
          <div style={{
            background: 'white', borderRadius: 24, width: '100%', maxWidth: 420,
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)', overflow: 'hidden', padding: '2rem',
            textAlign: 'center',
          }}>
            {/* WhatsApp icon */}
            <div 
              className="flex items-center justify-center mx-auto mb-4"
              style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)',
              }}
            >
              <MessageSquare size={28} color="#25D366" />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.4rem' }}>Connect WhatsApp</h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Scan the QR code below with your WhatsApp mobile app to link your account.
            </p>

            {/* QR Code Area */}
            <div style={{
              background: '#fafafa', border: '1px solid #f3f4f6', borderRadius: 16,
              padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 260, marginBottom: '1.5rem',
            }}>
              {waQrCode ? (
                <img src={waQrCode} alt="WhatsApp QR Code" style={{ width: '100%', maxWidth: 220, borderRadius: 8 }} />
              ) : (
                <div style={{ color: '#9ca3af' }} className="flex flex-col items-center gap-3">
                  {waStatus === 'connecting' ? (
                    <>
                      <Loader2 size={36} className="animate-spin" style={{ color: '#25D366' }} />
                      <span>Generating QR code...</span>
                    </>
                  ) : (
                    <>
                      <QrCode size={36} />
                      <span>Waiting for QR code...</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-center gap-2 mb-4" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: waQrCode ? '#fbbf24' : waStatus === 'connected' ? '#25D366' : '#94a3b8',
                display: 'inline-block',
                animation: waQrCode ? 'pulse 1.5s ease-in-out infinite' : undefined,
              }} />
              {waStatus === 'connected' ? 'Connected!' : waQrCode ? 'Awaiting scan...' : 'Initializing...'}
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowQrModal(false)}
              style={{
                width: '100%', padding: '0.875rem', borderRadius: 12,
                border: '1px solid #e5e7eb', background: 'white',
                fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
