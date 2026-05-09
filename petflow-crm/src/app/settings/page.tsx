'use client'

import { useState, useEffect } from 'react'
import { User, Clock, Globe, Save, CheckCircle2, AlertCircle, MessageSquare, RefreshCw, Wifi, QrCode, Loader2 } from 'lucide-react'
import type { Settings, BusinessHours } from '@/types'
import { getSettings, updateSettings, getWhatsAppConfig, updateWhatsAppConfig } from '@/lib/actions'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  // WhatsApp Integration state
  const [waConfig, setWaConfig] = useState({
    id: '',
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
  const [waSaving, setWaSaving] = useState(false)
  const [waMessage, setWaMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchSettingsData = async () => {
    setLoading(true)
    try {
      const data = await getSettings()
      if (data) {
        setSettings(data as unknown as Settings)
      } else {
        setSettings({
          id: '',
          spa_name: 'Pet Flow Spa',
          spa_whatsapp: '',
          spa_email: '',
          spa_address: '',
          currency_symbol: '₹',
          business_hours: days.reduce((acc, day) => ({
            ...acc,
            [day.id]: { open: '09:00', close: '18:00', closed: false }
          }), {}),
          updated_at: new Date().toISOString()
        } as Settings)
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error)
    }
    setLoading(false)
  }

  const loadWhatsAppConfigData = async () => {
    try {
      const data = await getWhatsAppConfig()
      if (data) {
        setWaConfig({
          id: data.id,
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
    } catch (error: any) {
      console.error('Error loading WhatsApp config:', error)
    }
  }

  useEffect(() => {
    fetchSettingsData()
    loadWhatsAppConfigData()
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

    try {
      const { id, ...data } = waConfig
      await updateWhatsAppConfig(id || null, data)
      setWaMessage({ type: 'success', text: 'WhatsApp configuration saved! ✅' })
      setTimeout(() => setWaMessage(null), 3000)
      loadWhatsAppConfigData()
      router.refresh()
    } catch (error: any) {
      setWaMessage({ type: 'error', text: error.message || 'Error saving config' })
    }
    setWaSaving(false)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setMessage(null)

    try {
      const { id, updated_at, ...data } = settings as any
      await updateSettings(id || null, data)
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setMessage(null), 3000)
      fetchSettingsData()
      router.refresh()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error saving settings' })
    }
    setSaving(false)
  }

  if (loading) return <div className="p-10 animate-pulse text-gray-400">Loading settings...</div>

  return (
    <div className="p-4 md:p-8 max-w-[1000px] pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Settings ⚙️</h1>
          <p className="text-gray-400 text-sm">
            Configure your spa profile, business hours, and integrations
          </p>
        </div>
        {activeTab !== 'whatsapp' && (
          <button 
            className="btn-sage w-full md:w-auto justify-center" 
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
      <div className="flex gap-1 mb-8 bg-gray-50 p-1 rounded-xl border border-gray-100 w-full md:w-fit overflow-x-auto hide-scrollbar">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'hours', label: 'Hours', icon: Clock },
          { id: 'system', label: 'System', icon: Globe },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-600 transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <tab.icon size={14} className="md:w-4 md:h-4" />
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
                  <div key={day.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="sm:w-32 font-bold text-sm text-gray-700">{day.label}</div>
                    
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        className="input-field flex-1 sm:w-32 py-1.5"
                        disabled={hour.closed}
                        value={hour.open}
                        onChange={e => updateDay('open', e.target.value)}
                      />
                      <span className="text-gray-400 text-xs">to</span>
                      <input
                        type="time"
                        className="input-field flex-1 sm:w-32 py-1.5"
                        disabled={hour.closed}
                        value={hour.close}
                        onChange={e => updateDay('close', e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end sm:ml-4">
                      <button
                        onClick={() => updateDay('closed', !hour.closed)}
                        className={`w-full sm:w-24 py-1.5 rounded-lg text-[0.65rem] font-bold transition-all ${
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

        {activeTab === 'whatsapp' && (
          <div className="flex flex-col gap-6">
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

            <div 
              className="card"
              style={{ 
                position: 'relative', 
                overflow: 'hidden',
                border: waConnected ? '1px solid rgba(37,211,102,0.3)' : '1px solid rgba(0,0,0,0.05)',
                boxShadow: waConnected ? '0 8px 24px rgba(37,211,102,0.08)' : undefined,
              }}
            >
              {waConnected && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#25D366' }} />
              )}

              <div style={{ padding: '1.75rem' }}>
                <div className="flex items-start gap-4 mb-5">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">API URL</label>
                    <input
                      className="input-field text-sm"
                      value={waConfig.evolution_api_url}
                      onChange={e => setWaConfig({ ...waConfig, evolution_api_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Instance Name</label>
                    <input
                      className="input-field text-sm"
                      value={waConfig.instance_name}
                      onChange={e => setWaConfig({ ...waConfig, instance_name: e.target.value })}
                    />
                  </div>
                </div>

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

                <div className="flex gap-3">
                  {waConnected ? (
                    <>
                      <button
                        onClick={handleWhatsAppDisconnect}
                        className="btn-outline flex-1 py-3"
                      >
                        Disconnect
                      </button>
                      <button
                        onClick={() => checkWhatsAppStatus()}
                        className="btn-outline flex-1 py-3 flex items-center justify-center gap-2"
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

            <div className="flex justify-end">
              <button
                className="btn-sage min-w-[200px]"
                onClick={handleSaveWhatsAppConfig}
                disabled={waSaving}
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

      {showQrModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowQrModal(false) }}
        >
          <div className="bg-white rounded-[24px] w-full max-w-[420px] shadow-2xl overflow-hidden p-8 text-center">
            <div className="flex items-center justify-center mx-auto mb-4 w-14 h-14 rounded-[16px] bg-[#25D366]/10 border border-[#25D366]/20">
              <MessageSquare size={28} color="#25D366" />
            </div>

            <h2 className="text-[1.4rem] font-800 mb-1">Connect WhatsApp</h2>
            <p className="text-gray-500 text-sm mb-6">
              Scan the QR code below with your WhatsApp mobile app to link your account.
            </p>

            <div className="bg-gray-50 border border-gray-100 rounded-[16px] p-6 flex items-center justify-center min-h-[260px] mb-6">
              {waQrCode ? (
                <img src={waQrCode} alt="WhatsApp QR Code" className="w-full max-w-[220px] rounded-lg" />
              ) : (
                <div className="text-gray-400 flex flex-col items-center gap-3">
                  <Loader2 size={36} className="animate-spin text-[#25D366]" />
                  <span className="text-sm">Generating QR code...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mb-6 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${waQrCode ? 'bg-amber-400 animate-pulse' : 'bg-gray-300'}`} />
              {waQrCode ? 'Awaiting scan...' : 'Initializing...'}
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="btn-outline w-full py-3"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
