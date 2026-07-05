'use client'

import { useState, useEffect } from 'react'
import { User, Clock, Globe, Save, CheckCircle2, AlertCircle, MessageSquare, RefreshCw, Wifi, QrCode, Loader2, UserCog, Lock, Mail, Settings as SettingsIcon, CreditCard, Eye, EyeOff, Copy, Check, Zap, Plus, Trash2, ExternalLink, ChevronDown, ChevronUp, Activity, Truck } from 'lucide-react'
import type { Settings, BusinessHours, Van } from '@/types'
import { getSettings, updateSettings, getWhatsAppConfig, updateWhatsAppConfig, sendTestWhatsApp, updateUserAccount, getVans, createVan, updateVan, deleteVan } from '@/lib/actions'
import { getPaymentConfig, updatePaymentConfig } from '@/lib/payment-actions'
import { COUNTRY_CONFIGS } from '@/lib/countryConfigs'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const days = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
]

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR)' },
  { code: 'USD', symbol: '$', name: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CAD)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (AUD)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY)' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (CNY)' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar (NZD)' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham (AED)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (SGD)' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand (ZAR)' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real (BRL)' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso (MXN)' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal (SAR)' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble (RUB)' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won (KRW)' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira (TRY)' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar (HKD)' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona (SEK)' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone (NOK)' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone (DKK)' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty (PLN)' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht (THB)' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah (IDR)' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (MYR)' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso (PHP)' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong (VND)' },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel (ILS)' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound (EGP)' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee (PKR)' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (BDT)' },
  { code: 'LKR', symbol: '₨', name: 'Sri Lankan Rupee (LKR)' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (NGN)' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling (KES)' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi (GHS)' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso (COP)' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso (ARS)' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso (CLP)' },
  { code: 'PEN', symbol: 'S/.', name: 'Peruvian Sol (PEN)' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia (UAH)' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint (HUF)' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna (CZK)' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu (RON)' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev (BGN)' },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna (HRK)' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona (ISK)' },
  { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar (JOD)' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar (KWD)' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial (OMR)' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal (QAR)' },
  { code: 'DZD', symbol: 'د.ج', name: 'Algerian Dinar (DZD)' },
  { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham (MAD)' },
  { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar (TND)' },
  { code: 'IQD', symbol: 'د.ع', name: 'Iraqi Dinar (IQD)' },
  { code: 'LBP', symbol: 'ل.ل', name: 'Lebanese Pound (LBP)' },
  { code: 'SDG', symbol: 'ج.س.', name: 'Sudanese Pound (SDG)' },
  { code: 'SYP', symbol: 'ل.س', name: 'Syrian Pound (SYP)' },
  { code: 'YER', symbol: '﷼', name: 'Yemeni Rial (YER)' }
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'hours' | 'system' | 'vans' | 'whatsapp' | 'payments' | 'integrations' | 'account'>('profile')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const router = useRouter()

  // Account settings state
  const { data: session, update: updateSession } = useSession()
  const isStaff = (session?.user as any)?.role === 'Staff'
  const [accountName, setAccountName] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountMessage, setAccountMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // White-label states & handlers
  const [logoUploading, setLogoUploading] = useState(false)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.url) {
        setSettings(prev => prev ? { ...prev, logo_url: data.url } : null)
      } else {
        alert(data.error || 'Failed to upload logo')
      }
    } catch (err) {
      console.error(err)
      alert('Error uploading logo')
    }
    setLogoUploading(false)
  }

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
    system_prompt: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
  })
  const [waConnected, setWaConnected] = useState(false)
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'awaiting_scan' | 'connected'>('disconnected')
  const [waQrCode, setWaQrCode] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [waChecking, setWaChecking] = useState(false)
  const [waSaving, setWaSaving] = useState(false)
  const [waMessage, setWaMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [webhookRegistered, setWebhookRegistered] = useState<boolean | null>(null)

  // ─── Integrations / Outgoing Webhooks state ───────────────────────────────
  const ALL_EVENTS = [
    { key: 'appointment.created',   label: 'Appointment Created',   desc: 'New appointment booked' },
    { key: 'appointment.updated',   label: 'Appointment Updated',   desc: 'Status changed (CheckedIn, Done…)' },
    { key: 'appointment.cancelled', label: 'Appointment Cancelled', desc: 'Appointment cancelled' },
    { key: 'client.created',        label: 'Client Created',        desc: 'New client added' },
    { key: 'invoice.created',       label: 'Invoice Created',       desc: 'Invoice generated on checkout' },
    { key: 'invoice.paid',          label: 'Invoice Paid',          desc: 'Payment confirmed' },
    { key: 'boarding.created',      label: 'Boarding Reserved',     desc: 'New boarding reservation' },
    { key: 'boarding.checked_in',   label: 'Boarding Check-In',     desc: 'Pet checked into boarding' },
    { key: 'boarding.checked_out',  label: 'Boarding Check-Out',    desc: 'Pet checked out of boarding' },
    { key: 'campaign.completed',    label: 'Campaign Completed',    desc: 'Marketing campaign finished' },
  ]
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [webhooksLoading, setWebhooksLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<any | null>(null)
  const [wbForm, setWbForm] = useState({ name: '', url: '', secret: '', events: [] as string[] })
  const [wbSaving, setWbSaving] = useState(false)
  const [wbMessage, setWbMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; code: number | null; ms: number | null }>>({})
  const [logsEndpointId, setLogsEndpointId] = useState<string | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Payment Gateway state
  const [payConfig, setPayConfig] = useState({
    id: '',
    razorpay_enabled: false,
    razorpay_key_id: '',
    razorpay_key_secret: '',
    razorpay_webhook_secret: '',
    stripe_enabled: false,
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    stripe_publishable_key: '',
    default_provider: 'razorpay',
  })
  const [paySaving, setPaySaving] = useState(false)
  const [payMessage, setPayMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [copiedWebhook, setCopiedWebhook] = useState('')

  // Grooming Vans state
  const [vans, setVans] = useState<Van[]>([])
  const [vansLoading, setVansLoading] = useState(false)
  const [newVanName, setNewVanName] = useState('')
  const [newVanPlate, setNewVanPlate] = useState('')
  const [vansMessage, setVansMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const loadVansData = async () => {
    setVansLoading(true)
    try {
      const data = await getVans()
      setVans(data as any)
    } catch (err) {
      console.error('Error loading vans:', err)
    }
    setVansLoading(false)
  }

  const handleAddVan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVanName.trim()) return
    try {
      await createVan({ name: newVanName, plate_number: newVanPlate })
      setNewVanName('')
      setNewVanPlate('')
      setVansMessage({ type: 'success', text: 'Van added successfully! 🚚' })
      loadVansData()
      setTimeout(() => setVansMessage(null), 3000)
    } catch (err: any) {
      setVansMessage({ type: 'error', text: err.message || 'Failed to add van' })
    }
  }

  const handleToggleVanStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'Maintenance' : 'Active'
    try {
      await updateVan(id, { status: nextStatus })
      loadVansData()
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
    }
  }

  const handleDeleteVan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this van from your fleet?')) return
    try {
      await deleteVan(id)
      loadVansData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete van')
    }
  }

  const fetchSettingsData = async () => {
    setLoading(true)
    try {
      const data = await getSettings()
      if (data) {
        setSettings({
          ...data,
          business_hours: data.business_hours || days.reduce((acc, day) => ({
            ...acc,
            [day.id]: { open: '09:00', close: '18:00', closed: false }
          }), {})
        } as unknown as Settings)
      } else {
        setSettings({
          id: '',
          spa_name: 'Pet Flow Spa',
          logo_url: null,
          primary_color: '#89A894',
          secondary_color: '#6d8f7a',
          accent_color: '#e8f0eb',
          spa_whatsapp: '',
          spa_email: '',
          spa_address: '',
          currency_symbol: '₹',
          currency_code: 'INR',
          boarding_enabled: true,
          retail_enabled: true,
          business_hours: days.reduce((acc, day) => ({
            ...acc,
            [day.id]: { open: '09:00', close: '18:00', closed: false }
          }), {}),
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        })
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
          system_prompt: data.system_prompt || '',
          twilio_account_sid: data.twilio_account_sid || '',
          twilio_auth_token: data.twilio_auth_token || '',
          twilio_phone_number: data.twilio_phone_number || '',
        })
        if (data.twilio_account_sid && data.twilio_auth_token && data.twilio_phone_number) {
          setWaConnected(true)
          setWaStatus('connected')
        } else {
          setWaConnected(false)
          setWaStatus('disconnected')
        }
      }
    } catch (error: any) {
      console.error('Error loading WhatsApp config:', error)
    }
  }

  useEffect(() => {
    fetchSettingsData()
    loadWhatsAppConfigData()
    loadPaymentConfig()
  }, [])

  useEffect(() => {
    if (activeTab === 'integrations') loadWebhooks()
    if (activeTab === 'vans') loadVansData()
  }, [activeTab])

  useEffect(() => {
    if (session?.user) {
      setAccountName(session.user.name || '')
      setAccountEmail(session.user.email || '')
      if ((session.user as any).role === 'Staff') {
        setActiveTab('account')
      }
    }
  }, [session])

  const loadPaymentConfig = async () => {
    try {
      const data = await getPaymentConfig()
      if (data) {
        setPayConfig({
          id: data.id,
          razorpay_enabled: data.razorpay_enabled,
          razorpay_key_id: data.razorpay_key_id || '',
          razorpay_key_secret: data.razorpay_key_secret || '',
          razorpay_webhook_secret: data.razorpay_webhook_secret || '',
          stripe_enabled: data.stripe_enabled,
          stripe_secret_key: data.stripe_secret_key || '',
          stripe_webhook_secret: data.stripe_webhook_secret || '',
          stripe_publishable_key: data.stripe_publishable_key || '',
          default_provider: data.default_provider,
        })
      }
    } catch (err) {
      console.error('Error loading payment config:', err)
    }
  }

  const handleSavePaymentConfig = async () => {
    setPaySaving(true)
    setPayMessage(null)
    try {
      const { id, ...data } = payConfig
      await updatePaymentConfig(data)
      setPayMessage({ type: 'success', text: 'Payment configuration saved! ✅' })
      setTimeout(() => setPayMessage(null), 3000)
      loadPaymentConfig()
    } catch (err: any) {
      setPayMessage({ type: 'error', text: err.message || 'Error saving payment config.' })
    }
    setPaySaving(false)
  }

  const toggleSecret = (key: string) => setShowSecrets(p => ({ ...p, [key]: !p[key] }))

  const copyWebhookUrl = (provider: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard.writeText(`${base}/api/webhook/${provider}`)
    setCopiedWebhook(provider)
    setTimeout(() => setCopiedWebhook(''), 2000)
  }

  const checkWhatsAppStatus = async (url?: string, key?: string, instance?: string) => {
    const apiUrl = url || waConfig.evolution_api_url
    const apiKey = key || waConfig.evolution_api_key
    const instanceName = instance || waConfig.instance_name

    if (!apiUrl || !apiKey || !instanceName) return

    setWaChecking(true)
    try {
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
      const res = await fetch(`/api/evolution-proxy/instance/connectionState/${instanceName}`, {
        headers: {
          'x-target-url': cleanUrl,
          'x-api-key': apiKey
        }
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

  // ─── Auto-register webhook with Evolution API after connection ───────────────
  const registerWebhook = async (cleanUrl: string): Promise<boolean> => {
    const agentUrl = waConfig.agent_public_url?.trim()

    // Skip if no public agent URL is configured (e.g. localhost dev)
    if (!agentUrl) {
      setWebhookRegistered(false)
      setWaMessage({
        type: 'info',
        text: '⚠️ WhatsApp connected but webhook not registered — no Agent Public URL set. Add it in the config below and reconnect (or use a tunnel like Pinggy for local testing).'
      })
      return false
    }

    let cleanAgentUrl = agentUrl.endsWith('/') ? agentUrl.slice(0, -1) : agentUrl
    if (cleanAgentUrl.toLowerCase().endsWith('/webhook')) {
      cleanAgentUrl = cleanAgentUrl.slice(0, -8)
    }
    const webhookUrl = `${cleanAgentUrl}/webhook`

    try {
      const res = await fetch(`/api/evolution-proxy/webhook/set/${waConfig.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-target-url': cleanUrl,
          'x-api-key': waConfig.evolution_api_key
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            headers: {
              "apikey": waConfig.evolution_api_key
            },
            webhook_by_events: false,
            webhook_base64: false,
            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE']
          }
        })
      })

      if (res.ok) {
        setWebhookRegistered(true)
        console.log(`✅ Webhook registered → ${webhookUrl}`)
        return true
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Webhook registration failed:', err)
        setWebhookRegistered(false)
        return false
      }
    } catch (err) {
      console.error('Webhook registration error:', err)
      setWebhookRegistered(false)
      return false
    }
  }

  const handleWhatsAppConnect = async () => {
    if (!waConfig.evolution_api_url || !waConfig.evolution_api_key || !waConfig.instance_name) {
      setWaMessage({ type: 'error', text: 'Please fill in Evolution API URL, API Key, and Instance Name first.' })
      return
    }

    setWaStatus('connecting')
    setShowQrModal(true)
    setWaQrCode(null)
    setWebhookRegistered(null)

    try {
      const cleanUrl = waConfig.evolution_api_url.endsWith('/') ? waConfig.evolution_api_url.slice(0, -1) : waConfig.evolution_api_url

      // Try to create instance first (may already exist)
      await fetch(`/api/evolution-proxy/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-target-url': cleanUrl,
          'x-api-key': waConfig.evolution_api_key
        },
        body: JSON.stringify({
          instanceName: waConfig.instance_name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        })
      }).catch(() => { })

      // Get QR code for connection
      const qrRes = await fetch(`/api/evolution-proxy/instance/connect/${waConfig.instance_name}`, {
        headers: {
          'x-target-url': cleanUrl,
          'x-api-key': waConfig.evolution_api_key
        }
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
              const stateRes = await fetch(`/api/evolution-proxy/instance/connectionState/${waConfig.instance_name}`, {
                headers: {
                  'x-target-url': cleanUrl,
                  'x-api-key': waConfig.evolution_api_key
                }
              })
              if (stateRes.ok) {
                const stateData = await stateRes.json()
                const state = stateData?.instance?.state || stateData?.state || ''
                if (state === 'open' || state === 'connected') {
                  clearInterval(pollInterval)
                  setWaConnected(true)
                  setWaStatus('connected')
                  setShowQrModal(false)

                  // ✅ Auto-register webhook right after QR scan succeeds
                  const webhookOk = await registerWebhook(cleanUrl)
                  if (webhookOk) {
                    setWaMessage({ type: 'success', text: 'WhatsApp connected & webhook registered! Petro is ready. 🚀' })
                  } else if (waConfig.agent_public_url?.trim()) {
                    // Had a URL but registration failed
                    setWaMessage({ type: 'error', text: 'WhatsApp connected ✅ but webhook registration failed. Try saving config and reconnecting.' })
                  }
                  // Note: if no agent_public_url, registerWebhook already set the info message
                  setTimeout(() => setWaMessage(null), 7000)
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

  const handleSendTest = async () => {
    if (!testPhone) {
      setWaMessage({ type: 'error', text: 'Please enter a phone number to test.' })
      return
    }
    setIsSendingTest(true)
    try {
      const res = await sendTestWhatsApp(testPhone)
      if (res) {
        setWaMessage({ type: 'success', text: 'Test message sent! Check your WhatsApp.' })
      } else {
        setWaMessage({ type: 'error', text: 'Failed to send test message. Check your connection.' })
      }
    } catch (err) {
      setWaMessage({ type: 'error', text: 'An error occurred while sending test message.' })
    } finally {
      setIsSendingTest(false)
      setTimeout(() => setWaMessage(null), 3000)
    }
  }

  const handleWhatsAppDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return

    try {
      const cleanUrl = waConfig.evolution_api_url.endsWith('/') ? waConfig.evolution_api_url.slice(0, -1) : waConfig.evolution_api_url
      await fetch(`/api/evolution-proxy/instance/logout/${waConfig.instance_name}`, {
        method: 'DELETE',
        headers: {
          'x-target-url': cleanUrl,
          'x-api-key': waConfig.evolution_api_key
        }
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
      
      // If connected via Evolution (not Twilio), sync/register the webhook on Evolution API
      const isTwilioActive = !!(waConfig.twilio_account_sid && waConfig.twilio_auth_token && waConfig.twilio_phone_number);
      if (waConnected && !isTwilioActive && waConfig.evolution_api_url && waConfig.evolution_api_key) {
        const cleanUrl = waConfig.evolution_api_url.endsWith('/') ? waConfig.evolution_api_url.slice(0, -1) : waConfig.evolution_api_url
        await registerWebhook(cleanUrl)
      }

      setWaMessage({ type: 'success', text: 'WhatsApp configuration saved and synced! ✅' })
      setTimeout(() => setWaMessage(null), 3000)
      loadWhatsAppConfigData()
      router.refresh()
    } catch (error: any) {
      setWaMessage({ type: 'error', text: error.message || 'Error saving config' })
    }
    setWaSaving(false)
  }

  const handleSaveAccount = async () => {
    const user = session?.user as any
    if (!user?.id) {
      setAccountMessage({ type: 'error', text: 'You must be logged in to update your account.' })
      return
    }
    if (!accountName.trim() || !accountEmail.trim()) {
      setAccountMessage({ type: 'error', text: 'Name and email are required.' })
      return
    }

    setAccountSaving(true)
    setAccountMessage(null)

    try {
      const emailChanged = accountEmail.trim().toLowerCase() !== user.email?.toLowerCase()

      await updateUserAccount(user.id, {
        name: accountName,
        email: accountEmail,
        password: accountPassword
      })

      // Trigger NextAuth JWT callback with trigger='update' to re-fetch user from DB
      await updateSession()

      setAccountPassword('')

      if (emailChanged) {
        // Email changed — must sign out so JWT re-issues with new email
        setAccountMessage({ type: 'success', text: 'Email updated! Signing you out so you can log in with your new email...' })
        setTimeout(async () => {
          const { signOut } = await import('next-auth/react')
          signOut({ callbackUrl: '/login' })
        }, 2500)
      } else {
        setAccountMessage({ type: 'success', text: 'Account updated successfully! 🎉' })
        setTimeout(() => {
          setAccountMessage(null)
          router.refresh()
        }, 1500)
      }
    } catch (error: any) {
      setAccountMessage({ type: 'error', text: error.message || 'Error updating account details.' })
    } finally {
      setAccountSaving(false)
    }
  }

  // ─── Integrations / Webhook Handlers ─────────────────────────────────────
  const loadWebhooks = async () => {
    setWebhooksLoading(true)
    try {
      const res = await fetch('/api/webhooks')
      const data = await res.json()
      if (data.success) setWebhooks(data.endpoints)
    } catch { }
    setWebhooksLoading(false)
  }

  const openAddModal = (existing?: any) => {
    if (existing) {
      setEditingWebhook(existing)
      setWbForm({ name: existing.name, url: existing.url, secret: existing.secret || '', events: existing.events })
    } else {
      setEditingWebhook(null)
      setWbForm({ name: '', url: '', secret: '', events: [] })
    }
    setWbMessage(null)
    setShowAddModal(true)
  }

  const generateSecret = () => {
    const arr = new Uint8Array(24)
    crypto.getRandomValues(arr)
    const secret = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('')
    setWbForm(f => ({ ...f, secret }))
  }

  const toggleEvent = (key: string) => {
    setWbForm(f => ({
      ...f,
      events: f.events.includes(key) ? f.events.filter(e => e !== key) : [...f.events, key]
    }))
  }

  const saveWebhook = async () => {
    if (!wbForm.name.trim() || !wbForm.url.trim()) {
      setWbMessage({ type: 'error', text: 'Name and URL are required.' })
      return
    }
    setWbSaving(true)
    setWbMessage(null)
    try {
      const method = editingWebhook ? 'PATCH' : 'POST'
      const url = editingWebhook ? `/api/webhooks/${editingWebhook.id}` : '/api/webhooks'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wbForm)
      })
      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        loadWebhooks()
      } else {
        setWbMessage({ type: 'error', text: data.error || 'Failed to save.' })
      }
    } catch {
      setWbMessage({ type: 'error', text: 'Network error.' })
    }
    setWbSaving(false)
  }

  const deleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
    loadWebhooks()
  }

  const testWebhook = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult(r => ({ ...r, [id]: { ok: data.success, code: data.status_code, ms: data.duration_ms } }))
      setTimeout(() => setTestResult(r => { const nr = { ...r }; delete nr[id]; return nr }), 8000)
    } catch {
      setTestResult(r => ({ ...r, [id]: { ok: false, code: null, ms: null } }))
    }
    setTestingId(null)
  }

  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current })
    })
    loadWebhooks()
  }

  const openLogs = async (id: string) => {
    if (logsEndpointId === id) { setLogsEndpointId(null); return }
    setLogsEndpointId(id)
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/webhooks/${id}/logs`)
      const data = await res.json()
      if (data.success) setLogs(data.logs)
    } catch { }
    setLogsLoading(false)
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
        {activeTab !== 'whatsapp' && activeTab !== 'account' && activeTab !== 'payments' && activeTab !== 'integrations' && (
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
          { id: 'profile',      label: 'Spa Profile',   icon: Globe },
          { id: 'hours',        label: 'Hours',          icon: Clock },
          { id: 'system',       label: 'System',         icon: SettingsIcon },
          ...(settings?.mobile_enabled ? [{ id: 'vans', label: 'Grooming Vans', icon: Truck }] : []),
          { id: 'whatsapp',     label: 'WhatsApp',       icon: MessageSquare },
          { id: 'payments',     label: 'Payments',       icon: CreditCard },
          { id: 'integrations', label: 'Integrations',   icon: Zap },
          { id: 'account',      label: 'My Account',     icon: UserCog },
        ].filter(tab => !isStaff || tab.id === 'account').map(tab => (
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
              <label className="text-sm font-600 text-gray-700 block mb-2">Spa Name</label>
              <input
                className="input-field"
                value={settings.spa_name}
                onChange={e => setSettings({ ...settings, spa_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-600 text-gray-700 block mb-2">WhatsApp Number</label>
              <input
                className="input-field"
                value={settings.spa_whatsapp || ''}
                onChange={e => setSettings({ ...settings, spa_whatsapp: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-600 text-gray-700 block mb-2">Business Email</label>
              <input
                className="input-field"
                value={settings.spa_email || ''}
                onChange={e => setSettings({ ...settings, spa_email: e.target.value })}
              />
            </div>
            <div className="col-span-full">
              <label className="text-sm font-600 text-gray-700 block mb-2">Address</label>
              <textarea
                className="input-field"
                rows={3}
                value={settings.spa_address || ''}
                onChange={e => setSettings({ ...settings, spa_address: e.target.value })}
              />
            </div>

            {/* White-Label Settings */}
            <div className="col-span-full mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-md font-700 mb-1">Branding & Identity</h3>
              <p className="text-xs text-gray-400 mb-4">Customize colors, logo, and brand name for your pet spa</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div>
                  <label className="text-sm font-600 text-gray-700 block mb-2">Spa Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {settings.logo_url ? (
                        <img src={settings.logo_url} alt="Logo preview" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400">No Logo</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="btn-sage cursor-pointer text-xs font-semibold py-1.5 px-3">
                        {logoUploading ? 'Uploading...' : 'Upload Image'}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={logoUploading} className="hidden" />
                      </label>
                      {settings.logo_url && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, logo_url: null })}
                          className="text-red-500 hover:text-red-600 text-[11px] font-semibold text-left bg-transparent border-none p-0 cursor-pointer"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Color Pickers */}
                <div>
                  <label className="text-sm font-600 text-gray-700 block mb-3">Theme Colors</label>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <span className="text-[10px] font-700 text-gray-400 uppercase tracking-wide block mb-1">Primary</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" 
                          value={settings.primary_color || '#89A894'}
                          onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                        />
                        <span className="text-xs font-mono font-600 uppercase text-gray-500">{settings.primary_color || '#89A894'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-700 text-gray-400 uppercase tracking-wide block mb-1">Secondary</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" 
                          value={settings.secondary_color || '#6d8f7a'}
                          onChange={e => setSettings({ ...settings, secondary_color: e.target.value })}
                        />
                        <span className="text-xs font-mono font-600 uppercase text-gray-500">{settings.secondary_color || '#6d8f7a'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-700 text-gray-400 uppercase tracking-wide block mb-1">Accent</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" 
                          value={settings.accent_color || '#e8f0eb'}
                          onChange={e => setSettings({ ...settings, accent_color: e.target.value })}
                        />
                        <span className="text-xs font-mono font-600 uppercase text-gray-500">{settings.accent_color || '#e8f0eb'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings({
                      ...settings,
                      primary_color: '#89A894',
                      secondary_color: '#6d8f7a',
                      accent_color: '#e8f0eb'
                    })}
                    className="mt-4 text-[11px] font-bold text-gray-500 hover:text-gray-700 block border-none bg-transparent p-0 cursor-pointer"
                  >
                    Revert to Default Theme (Sage)
                  </button>
                </div>
              </div>
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
                const businessHours = settings.business_hours || {}
                const hour = (businessHours as any)[day.id] || { open: '09:00', close: '18:00', closed: false }
                
                const updateDay = (key: keyof BusinessHours, val: any) => {
                  const newHours = { ...(settings.business_hours || {}) } as any
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

            {/* Country / Market Selector */}
            <div className="col-span-full">
              <label className="text-sm font-600 text-gray-700 block mb-2">Country / Market</label>
              <select
                className="input-field"
                value={settings.country ?? 'IN'}
                onChange={e => {
                  const code = e.target.value
                  const cfg = COUNTRY_CONFIGS[code]
                  if (cfg) {
                    setSettings(prev => prev ? {
                      ...prev,
                      country: code,
                      currency_code: cfg.currency_code,
                      currency_symbol: cfg.currency_symbol,
                      tax_label: cfg.tax_label,
                      tax_presets: cfg.tax_presets,
                      timezone: cfg.timezone,
                      date_format: cfg.date_format,
                      time_format: cfg.time_format,
                      tip_enabled: cfg.tip_enabled,
                    } : null)
                  }
                }}
              >
                {Object.entries(COUNTRY_CONFIGS).map(([code, cfg]) => (
                  <option key={code} value={code}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className="text-sm font-600 color-gray-700 block mb-2">Currency</label>
              <select
                className="input-field"
                value={settings.currency_code || 'INR'}
                onChange={e => {
                  const code = e.target.value
                  const selected = CURRENCIES.find(c => c.code === code)
                  setSettings({
                    ...settings,
                    currency_code: code,
                    currency_symbol: selected ? selected.symbol : '₹'
                  })
                }}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="text-sm font-600 text-gray-700 block mb-2">Time Zone</label>
              <select
                className="input-field"
                value={settings.timezone || 'Asia/Kolkata'}
                onChange={e => setSettings({ ...settings, timezone: e.target.value })}
              >
                <option value="Asia/Kolkata">Asia/Kolkata — IST (UTC+5:30)</option>
                <option value="Asia/Dubai">Asia/Dubai — GST (UTC+4)</option>
                <option value="America/New_York">America/New_York — EST (UTC-5)</option>
                <option value="America/Chicago">America/Chicago — CST (UTC-6)</option>
                <option value="America/Denver">America/Denver — MST (UTC-7)</option>
                <option value="America/Los_Angeles">America/Los_Angeles — PST (UTC-8)</option>
                <option value="Europe/London">Europe/London — GMT (UTC+0)</option>
                <option value="Australia/Sydney">Australia/Sydney — AEST (UTC+10)</option>
                <option value="Asia/Singapore">Asia/Singapore — SGT (UTC+8)</option>
                <option value="America/Toronto">America/Toronto — EST (UTC-5)</option>
              </select>
            </div>

            {/* Date Format */}
            <div>
              <label className="text-sm font-600 text-gray-700 block mb-2">Date Format</label>
              <select
                className="input-field"
                value={settings.date_format || 'DD/MM/YYYY'}
                onChange={e => setSettings({ ...settings, date_format: e.target.value })}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (India / UAE)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
            </div>

            {/* Tax Label */}
            <div>
              <label className="text-sm font-600 text-gray-700 block mb-2">Tax Label</label>
              <input
                className="input-field"
                placeholder="e.g. GST, VAT, Sales Tax"
                value={settings.tax_label || 'GST'}
                onChange={e => setSettings({ ...settings, tax_label: e.target.value })}
              />
            </div>

            {/* Business Modules */}
            <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
              <h3 className="text-md font-700 mb-1" style={{ fontWeight: 700 }}>Business Modules</h3>
              <p className="text-xs text-gray-400 mb-4">Toggle features based on your pet spa business model</p>
              
              <div className="flex flex-col gap-4">
                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer select-none">
                  <div>
                    <p className="text-sm font-bold text-gray-800" style={{ fontWeight: 700 }}>🏨 Pet Boarding Feature</p>
                    <p className="text-[11px] text-gray-400">Manage kennels, room capacities, check-in wizards, and daily care logs</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.boarding_enabled ?? true}
                    onChange={e => setSettings({ ...settings, boarding_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sage border-gray-300 focus:ring-sage"
                    style={{ accentColor: 'var(--sage)' }}
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer select-none">
                  <div>
                    <p className="text-sm font-bold text-gray-800" style={{ fontWeight: 700 }}>🍖 Retail Store &amp; Products</p>
                    <p className="text-[11px] text-gray-400">Track product inventory, cost price vs retail price, low-stock notifications, and direct product checkouts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.retail_enabled ?? true}
                    onChange={e => setSettings({ ...settings, retail_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sage border-gray-300 focus:ring-sage"
                    style={{ accentColor: 'var(--sage)' }}
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer select-none">
                  <div>
                    <p className="text-sm font-bold text-gray-800" style={{ fontWeight: 700 }}>💰 Tip at Checkout</p>
                    <p className="text-[11px] text-gray-400">Enable tipping at POS checkout — standard for US &amp; Canada markets (15–20%)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tip_enabled ?? false}
                    onChange={e => setSettings({ ...settings, tip_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sage border-gray-300 focus:ring-sage"
                    style={{ accentColor: 'var(--sage)' }}
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer select-none">
                  <div>
                    <p className="text-sm font-bold text-gray-800" style={{ fontWeight: 700 }}>🚚 Mobile Grooming Vans</p>
                    <p className="text-[11px] text-gray-400">Enable dispatching appointments to grooming vans, fleet status management, and route assignment</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mobile_enabled ?? false}
                    onChange={e => setSettings({ ...settings, mobile_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sage border-gray-300 focus:ring-sage"
                    style={{ accentColor: 'var(--sage)' }}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vans' && settings && (
          <div className="flex flex-col gap-6">
            {vansMessage && (
              <div 
                className={`p-4 rounded-xl flex items-center gap-3 border ${
                  vansMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}
              >
                {vansMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-sm font-500">{vansMessage.text}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add Van Form */}
              <div className="lg:col-span-1 p-6 rounded-2xl border border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                <div>
                  <h4 className="text-md font-700 mb-1" style={{ fontWeight: 700 }}>Add Grooming Van</h4>
                  <p className="text-xs text-gray-400">Register a new vehicle in your mobile grooming fleet</p>
                </div>
                <form onSubmit={handleAddVan} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase tracking-wider mb-2 block">Van Name / Identifier</label>
                    <input
                      type="text"
                      className="input-field bg-white"
                      placeholder="e.g. Van Alpha, North Van"
                      required
                      value={newVanName}
                      onChange={e => setNewVanName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase tracking-wider mb-2 block">License Plate Number (Optional)</label>
                    <input
                      type="text"
                      className="input-field bg-white"
                      placeholder="e.g. DXB-12345"
                      value={newVanPlate}
                      onChange={e => setNewVanPlate(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-sage w-full py-3 flex items-center justify-center gap-2">
                    <Plus size={16} /> Register Van
                  </button>
                </form>
              </div>

              {/* Fleet List */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div>
                  <h4 className="text-md font-700 mb-1" style={{ fontWeight: 700 }}>Fleet Management</h4>
                  <p className="text-xs text-gray-400">View and manage dispatch statuses of your grooming vans</p>
                </div>

                {vansLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-sage-dark" size={32} />
                  </div>
                ) : vans.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl bg-white">
                    <Truck className="mx-auto text-gray-300 mb-3" size={40} />
                    <p className="text-sm font-600 text-gray-500">No vans registered yet</p>
                    <p className="text-xs text-gray-400 mt-1">Register your first vehicle on the left to start dispatching appointments</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vans.map(van => (
                      <div key={van.id} className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage-dark">
                              <Truck size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-700 text-gray-800">{van.name}</p>
                              {van.plate_number ? (
                                <p className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-600 uppercase w-fit mt-1 tracking-wider">
                                  {van.plate_number}
                                </p>
                              ) : (
                                <p className="text-[10px] text-gray-400 mt-0.5 italic">No Plate Registered</p>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleToggleVanStatus(van.id, van.status)}
                            className={`px-3 py-1 rounded-full text-[10px] font-800 uppercase tracking-wider transition-all border ${
                              van.status === 'Active'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            {van.status}
                          </button>
                        </div>

                        <div className="flex justify-end border-t border-gray-50 pt-3 mt-1">
                          <button
                            onClick={() => handleDeleteVan(van.id)}
                            className="text-xs font-700 text-red-500 hover:text-red-700 flex items-center gap-1 transition-all"
                          >
                            <Trash2 size={13} /> Decommission
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="flex flex-col gap-6">
            {waMessage && (
              <div 
                className={`p-4 rounded-xl flex items-start gap-3 border ${
                  waMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : waMessage.type === 'info'
                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                    : 'bg-red-50 border-red-100 text-red-700'
                }`}
              >
                {waMessage.type === 'success'
                  ? <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                  : waMessage.type === 'info'
                  ? <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  : <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                }
                <p className="text-sm font-500 leading-relaxed">{waMessage.text}</p>
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                        Twilio WhatsApp / SMS
                      </h3>
                      {waConnected && <CheckCircle2 size={18} color="#25D366" />}
                    </div>
                    <p className="text-sm text-gray-500 mt-1" style={{ lineHeight: 1.6 }}>
                      Connect Twilio to power Petro — your AI grooming assistant that auto-responds to clients 24/7 over SMS or WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Twilio Account SID</label>
                    <input
                      className="input-field text-sm font-mono"
                      placeholder="AC..."
                      value={waConfig.twilio_account_sid}
                      onChange={e => setWaConfig({ ...waConfig, twilio_account_sid: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Twilio Auth Token</label>
                    <input
                      type="password"
                      className="input-field text-sm"
                      placeholder="Enter Twilio Auth Token"
                      value={waConfig.twilio_auth_token}
                      onChange={e => setWaConfig({ ...waConfig, twilio_auth_token: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Twilio Sender Number</label>
                    <input
                      className="input-field text-sm font-mono"
                      placeholder="e.g. whatsapp:+14155238886"
                      value={waConfig.twilio_phone_number}
                      onChange={e => setWaConfig({ ...waConfig, twilio_phone_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">OpenAI API Key</label>
                    <input
                      type="password"
                      className="input-field text-sm"
                      placeholder="sk-..."
                      value={waConfig.openai_api_key}
                      onChange={e => setWaConfig({ ...waConfig, openai_api_key: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Agent Public URL</label>
                    <input
                      className="input-field text-sm font-mono"
                      placeholder="https://agent.yourdomain.com"
                      value={waConfig.agent_public_url}
                      onChange={e => setWaConfig({ ...waConfig, agent_public_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Booking Link</label>
                    <input
                      className="input-field text-sm"
                      placeholder="https://cal.com/your-link"
                      value={waConfig.booking_link}
                      onChange={e => setWaConfig({ ...waConfig, booking_link: e.target.value })}
                    />
                  </div>
                </div>

                {waConnected && (
                  <div className="mb-5 p-4 rounded-xl bg-emerald-50/30 border border-emerald-100/50 text-xs text-emerald-800 leading-relaxed">
                    <strong>🔗 Twilio Webhook Setup:</strong> Copy the Agent Webhook URL below and paste it as the Webhook URL for incoming messages in your <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline font-700 hover:text-emerald-900">Twilio Console</a>:
                    <div className="flex gap-2 mt-2 items-center">
                      <code className="bg-white px-2.5 py-1.5 rounded border border-gray-200 font-mono text-[11px] select-all flex-1 text-gray-800">
                        {(() => {
                          if (!waConfig.agent_public_url) return 'https://<your-agent-url>/webhook';
                          let cleanUrl = waConfig.agent_public_url.trim();
                          cleanUrl = cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl;
                          if (cleanUrl.toLowerCase().endsWith('/webhook')) {
                            cleanUrl = cleanUrl.slice(0, -8);
                          }
                          return `${cleanUrl}/webhook`;
                        })()}
                      </code>
                    </div>
                  </div>
                )}

                <div className="mb-5">
                  <label className="text-xs font-700 text-gray-400 uppercase mb-2 block">AI System Prompt (Petro's Personality)</label>
                  <textarea
                    className="input-field text-sm font-mono"
                    rows={8}
                    placeholder="Enter the system instructions for the AI Agent..."
                    value={waConfig.system_prompt}
                    onChange={e => setWaConfig({ ...waConfig, system_prompt: e.target.value })}
                  />
                  <p className="text-[0.7rem] text-gray-400 mt-2">
                    Use this field to define how Petro interacts with your clients. You can use placeholders like [SPA_NAME] and [BOOKING_LINK].
                  </p>
                </div>

                {waConnected && (
                  <div className="mt-8 pt-6 border-t border-gray-100 mb-5">
                    <h4 className="text-sm font-600 mb-3">Test Integration</h4>
                    <div className="flex gap-2">
                      <input
                        className="input-field text-sm"
                        placeholder="Enter phone number (e.g. 919876543210)"
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        style={{ maxWidth: 300 }}
                      />
                      <button
                        className="btn-primary py-2 px-4 text-xs"
                        onClick={handleSendTest}
                        disabled={isSendingTest}
                      >
                        {isSendingTest ? 'Sending...' : 'Send Test Message'}
                      </button>
                    </div>
                  </div>
                )}

                {waConnected && (
                  <div 
                    className="mb-5"
                    style={{ 
                      background: '#f8fdf9', padding: '1rem', borderRadius: 12,
                      border: '1px solid rgba(37,211,102,0.15)', fontSize: '0.8rem',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontWeight: 600, color: '#6b7280' }}>Sender Number:</span>
                      <span style={{ fontWeight: 700, color: '#111' }}>{waConfig.twilio_phone_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontWeight: 600, color: '#6b7280' }}>Status:</span>
                      <span className="flex items-center gap-2">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600, color: '#25D366' }}>Connected & Configured</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {waConnected && (
                    <button
                      onClick={handleWhatsAppDisconnect}
                      className="btn-outline w-full py-3"
                    >
                      Clear Credentials / Disconnect
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
                  <><Save size={16} /> Save Twilio Config</>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="flex flex-col gap-6">
            {accountMessage && (
              <div 
                className={`p-4 rounded-xl flex items-center gap-3 border ${
                  accountMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}
              >
                {accountMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-sm font-500">{accountMessage.text}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-full mb-2">
                <h3 className="text-lg font-700 mb-1">Account Credentials</h3>
                <p className="text-sm text-gray-400">Manage your name, email ID, and password used to access the CRM portal</p>
              </div>
              
              <div>
                <label className="text-sm font-600 color-gray-700 block mb-2">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                    <User size={16} />
                  </span>
                  <input
                    className="input-field pl-10"
                    placeholder="Enter your name"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-600 color-gray-700 block mb-2">Email Address (Login ID)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    className="input-field pl-10"
                    placeholder="Enter email"
                    value={accountEmail}
                    onChange={e => setAccountEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-span-full">
                <label className="text-sm font-600 color-gray-700 block mb-2">New Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    className="input-field pl-10"
                    placeholder="Leave blank to keep current password"
                    value={accountPassword}
                    onChange={e => setAccountPassword(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  To keep your current password, just leave this field empty.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                className="btn-sage min-w-[200px]"
                onClick={handleSaveAccount}
                disabled={accountSaving}
              >
                {accountSaving ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} /> Update Account</>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="flex flex-col gap-6">
            {payMessage && (
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                payMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
              }`}>
                {payMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-sm font-500">{payMessage.text}</p>
              </div>
            )}

            {/* Razorpay Card */}
            <div className="card" style={{ border: payConfig.razorpay_enabled ? '1px solid rgba(37,99,235,0.25)' : undefined, position: 'relative', overflow: 'hidden' }}>
              {payConfig.razorpay_enabled && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#2563eb' }} />}
              <div style={{ padding: '1.75rem' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>
                      <CreditCard size={22} color="#2563eb" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Razorpay</h3>
                      <p className="text-xs text-gray-400">Accept UPI, Cards, Net Banking, Wallets</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-600 text-gray-500">{payConfig.razorpay_enabled ? 'Enabled' : 'Disabled'}</span>
                    <input type="checkbox" checked={payConfig.razorpay_enabled} onChange={e => setPayConfig({...payConfig, razorpay_enabled: e.target.checked})} className="w-4 h-4" style={{ accentColor: '#2563eb' }} />
                  </label>
                </div>

                {payConfig.razorpay_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Key ID</label>
                      <input className="input-field text-sm" placeholder="rzp_live_xxx or rzp_test_xxx" value={payConfig.razorpay_key_id} onChange={e => setPayConfig({...payConfig, razorpay_key_id: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Key Secret</label>
                      <div className="relative">
                        <input type={showSecrets['rz_secret'] ? 'text' : 'password'} className="input-field text-sm pr-10" placeholder="Enter Key Secret" value={payConfig.razorpay_key_secret} onChange={e => setPayConfig({...payConfig, razorpay_key_secret: e.target.value})} />
                        <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400" onClick={() => toggleSecret('rz_secret')}>{showSecrets['rz_secret'] ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Webhook Secret</label>
                      <div className="relative">
                        <input type={showSecrets['rz_wh'] ? 'text' : 'password'} className="input-field text-sm pr-10" placeholder="Webhook secret from Razorpay dashboard" value={payConfig.razorpay_webhook_secret} onChange={e => setPayConfig({...payConfig, razorpay_webhook_secret: e.target.value})} />
                        <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400" onClick={() => toggleSecret('rz_wh')}>{showSecrets['rz_wh'] ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Webhook URL</label>
                      <div className="flex gap-2">
                        <input className="input-field text-sm bg-gray-50 text-gray-500 flex-1" readOnly value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/razorpay` : '/api/webhook/razorpay'} />
                        <button onClick={() => copyWebhookUrl('razorpay')} className="px-3 py-2 rounded-lg text-xs font-600 flex items-center gap-1.5 transition-all" style={{ background: copiedWebhook === 'razorpay' ? 'rgba(16,185,129,0.1)' : 'rgba(37,99,235,0.08)', color: copiedWebhook === 'razorpay' ? '#059669' : '#2563eb' }}>
                          {copiedWebhook === 'razorpay' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Paste this URL in your Razorpay Dashboard → Settings → Webhooks</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stripe Card */}
            <div className="card" style={{ border: payConfig.stripe_enabled ? '1px solid rgba(99,102,241,0.25)' : undefined, position: 'relative', overflow: 'hidden' }}>
              {payConfig.stripe_enabled && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#6366f1' }} />}
              <div style={{ padding: '1.75rem' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <CreditCard size={22} color="#6366f1" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Stripe</h3>
                      <p className="text-xs text-gray-400">Accept international cards, Apple Pay, Google Pay</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-600 text-gray-500">{payConfig.stripe_enabled ? 'Enabled' : 'Disabled'}</span>
                    <input type="checkbox" checked={payConfig.stripe_enabled} onChange={e => setPayConfig({...payConfig, stripe_enabled: e.target.checked})} className="w-4 h-4" style={{ accentColor: '#6366f1' }} />
                  </label>
                </div>

                {payConfig.stripe_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Secret Key</label>
                      <div className="relative">
                        <input type={showSecrets['st_secret'] ? 'text' : 'password'} className="input-field text-sm pr-10" placeholder="sk_live_xxx or sk_test_xxx" value={payConfig.stripe_secret_key} onChange={e => setPayConfig({...payConfig, stripe_secret_key: e.target.value})} />
                        <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400" onClick={() => toggleSecret('st_secret')}>{showSecrets['st_secret'] ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Publishable Key</label>
                      <input className="input-field text-sm" placeholder="pk_live_xxx or pk_test_xxx" value={payConfig.stripe_publishable_key} onChange={e => setPayConfig({...payConfig, stripe_publishable_key: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Webhook Secret</label>
                      <div className="relative">
                        <input type={showSecrets['st_wh'] ? 'text' : 'password'} className="input-field text-sm pr-10" placeholder="whsec_xxx" value={payConfig.stripe_webhook_secret} onChange={e => setPayConfig({...payConfig, stripe_webhook_secret: e.target.value})} />
                        <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400" onClick={() => toggleSecret('st_wh')}>{showSecrets['st_wh'] ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-700 text-gray-400 uppercase mb-1 block">Webhook URL</label>
                      <div className="flex gap-2">
                        <input className="input-field text-sm bg-gray-50 text-gray-500 flex-1" readOnly value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/stripe` : '/api/webhook/stripe'} />
                        <button onClick={() => copyWebhookUrl('stripe')} className="px-3 py-2 rounded-lg text-xs font-600 flex items-center gap-1.5 transition-all" style={{ background: copiedWebhook === 'stripe' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.08)', color: copiedWebhook === 'stripe' ? '#059669' : '#6366f1' }}>
                          {copiedWebhook === 'stripe' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Paste this URL in your Stripe Dashboard → Developers → Webhooks</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Default Provider */}
            {(payConfig.razorpay_enabled || payConfig.stripe_enabled) && (
              <div className="card p-6">
                <h4 className="text-sm font-700 mb-3">Default Payment Provider</h4>
                <select className="input-field text-sm" value={payConfig.default_provider} onChange={e => setPayConfig({...payConfig, default_provider: e.target.value})}>
                  {payConfig.razorpay_enabled && <option value="razorpay">Razorpay (UPI, Cards, Net Banking)</option>}
                  {payConfig.stripe_enabled && <option value="stripe">Stripe (International Cards)</option>}
                </select>
              </div>
            )}

            <div className="flex justify-end">
              <button className="btn-sage min-w-[200px]" onClick={handleSavePaymentConfig} disabled={paySaving}>
                {paySaving ? (<><Loader2 size={16} className="animate-spin" /> Saving...</>) : (<><Save size={16} /> Save Payment Config</>)}
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

      {/* ─── Integrations Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="flex flex-col gap-6">

          {/* Header card */}
          <div className="card p-6" style={{ background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <Zap size={24} color="#16a34a" />
              </div>
              <div className="flex-1">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#15803d' }}>Outgoing Webhooks</h3>
                <p className="text-sm mt-1" style={{ color: '#166534', lineHeight: 1.6 }}>
                  Connect PetFlow with <strong>Make</strong>, <strong>Zapier</strong>, <strong>n8n</strong>, or any custom HTTP endpoint.
                  Register a URL below — PetFlow will send real-time event data whenever something happens in your CRM.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['Make', 'Zapier', 'n8n', 'Custom HTTP'].map(tool => (
                    <span key={tool} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }}>{tool}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Endpoint list */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Webhook Endpoints</h3>
                <p className="text-xs text-gray-400 mt-0.5">{webhooks.length} endpoint{webhooks.length !== 1 ? 's' : ''} registered</p>
              </div>
              <button
                onClick={() => openAddModal()}
                className="btn-sage flex items-center gap-2"
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                <Plus size={15} /> Add Webhook
              </button>
            </div>

            {webhooksLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-3">
                <Loader2 size={20} className="animate-spin" /> Loading endpoints...
              </div>
            ) : webhooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-3">
                <Zap size={36} strokeWidth={1.5} />
                <p className="text-sm font-500">No webhooks yet</p>
                <p className="text-xs text-center max-w-xs">Add your first webhook endpoint to start receiving real-time event data in Make, Zapier or n8n.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {webhooks.map(ep => {
                  const lastLog = ep.logs?.[0]
                  const tr = testResult[ep.id]
                  return (
                    <div key={ep.id} className="rounded-xl border" style={{ border: ep.is_active ? '1px solid rgba(34,197,94,0.2)' : '1px solid #e5e7eb', background: ep.is_active ? 'rgba(240,253,244,0.5)' : '#fafafa' }}>
                      <div className="flex items-start gap-3 p-4">
                        {/* Active toggle */}
                        <button
                          onClick={() => toggleActive(ep.id, ep.is_active)}
                          style={{
                            marginTop: 2, width: 36, height: 20, borderRadius: 10, flexShrink: 0, cursor: 'pointer', transition: 'background .2s',
                            background: ep.is_active ? '#22c55e' : '#d1d5db', border: 'none', position: 'relative'
                          }}
                        >
                          <span style={{ position: 'absolute', top: 2, left: ep.is_active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{ep.name}</span>
                            {ep.is_active
                              ? <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }}>ACTIVE</span>
                              : <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }}>PAUSED</span>
                            }
                            {lastLog && (
                              lastLog.success
                                ? <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(34,197,94,0.08)', color: '#16a34a' }}>Last: ✓ {lastLog.status_code}</span>
                                : <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>Last: ✗ {lastLog.status_code || 'fail'}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 truncate font-mono">{ep.url}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {ep.events.slice(0, 4).map((ev: string) => (
                              <span key={ev} style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 999, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>{ev}</span>
                            ))}
                            {ep.events.length > 4 && <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 999, background: '#f3f4f6', color: '#6b7280' }}>+{ep.events.length - 4} more</span>}
                          </div>

                          {/* Test result */}
                          {tr && (
                            <div className={`mt-2 text-xs font-600 flex items-center gap-1 ${tr.ok ? 'text-green-600' : 'text-red-500'}`}>
                              {tr.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                              {tr.ok ? `✅ Delivered (${tr.code}) in ${tr.ms}ms` : `❌ Failed (${tr.code ?? 'no response'}) in ${tr.ms ?? '?'}ms`}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => testWebhook(ep.id)}
                            disabled={testingId === ep.id}
                            title="Send test ping"
                            className="btn-outline flex items-center gap-1"
                            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          >
                            {testingId === ep.id ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                            Test
                          </button>
                          <button
                            onClick={() => openLogs(ep.id)}
                            title="View delivery logs"
                            className="btn-outline flex items-center gap-1"
                            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          >
                            {logsEndpointId === ep.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            Logs
                          </button>
                          <button onClick={() => openAddModal(ep)} title="Edit" className="btn-outline" style={{ padding: '5px 8px' }}>
                            <Copy size={13} />
                          </button>
                          <button onClick={() => deleteWebhook(ep.id)} title="Delete" className="btn-outline text-red-500 hover:bg-red-50 hover:border-red-200" style={{ padding: '5px 8px' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Logs drawer */}
                      {logsEndpointId === ep.id && (
                        <div style={{ borderTop: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '0 0 12px 12px' }}>
                          <div style={{ padding: '12px 16px' }}>
                            <p className="text-xs font-700 text-gray-500 uppercase mb-2">Delivery Logs (last 50)</p>
                            {logsLoading ? (
                              <div className="flex items-center gap-2 text-xs text-gray-400 py-4"><Loader2 size={14} className="animate-spin" /> Loading logs...</div>
                            ) : logs.length === 0 ? (
                              <p className="text-xs text-gray-400 py-4">No deliveries yet. Hit the Test button to send a ping.</p>
                            ) : (
                              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                                {logs.map((log: any) => (
                                  <div key={log.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-gray-100 last:border-0">
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: log.success ? '#22c55e' : '#ef4444' }} />
                                    <span style={{ fontWeight: 600, color: log.success ? '#15803d' : '#dc2626', width: 30 }}>{log.status_code || '—'}</span>
                                    <span style={{ fontFamily: 'monospace', color: '#6b7280', flex: 1 }}>{log.event}</span>
                                    <span style={{ color: '#9ca3af' }}>{log.duration_ms}ms</span>
                                    <span style={{ color: '#9ca3af' }}>{new Date(log.created).toLocaleTimeString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Start Guide */}
          <div className="card p-6">
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 12px' }}>📦 Payload Format</h3>
            <p className="text-xs text-gray-500 mb-3">Every event sends a POST request with this JSON structure:</p>
            <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 12, padding: '16px', fontSize: '0.75rem', lineHeight: 1.7, overflowX: 'auto' }}>
{`{
  "event": "appointment.created",
  "timestamp": "2026-06-05T14:00:00Z",
  "data": {
    "id": "clxyz123",
    "pet_name": "Bruno",
    "owner_name": "Ravi Kumar",
    "service": "Full Grooming",
    "date": "2026-06-10",
    "time": "10:00",
    "status": "Booked"
  }
}`}
            </pre>
            <div className="flex flex-wrap gap-3 mt-4">
              <a href="https://www.make.com/en/help/tools/webhooks" target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-1.5" style={{ fontSize: '0.8rem' }}>
                <ExternalLink size={13} /> Make Docs
              </a>
              <a href="https://zapier.com/apps/webhook/integrations" target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-1.5" style={{ fontSize: '0.8rem' }}>
                <ExternalLink size={13} /> Zapier Docs
              </a>
              <a href="https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.webhook/" target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-1.5" style={{ fontSize: '0.8rem' }}>
                <ExternalLink size={13} /> n8n Docs
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add / Edit Webhook Modal ──────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-start justify-center p-4 pt-16 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div className="bg-white rounded-[24px] w-full max-w-[560px] shadow-2xl overflow-hidden">
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #f3f4f6' }}>
              <div className="flex items-center justify-between">
                <h2 style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>{editingWebhook ? 'Edit Webhook' : 'Add Webhook Endpoint'}</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22 }}>×</button>
              </div>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {wbMessage && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-sm ${wbMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  <AlertCircle size={15} /> {wbMessage.text}
                </div>
              )}

              <div>
                <label className="text-xs font-700 text-gray-500 uppercase block mb-1.5">Endpoint Name *</label>
                <input className="input-field text-sm" placeholder='e.g. "Make — New Booking Alert"' value={wbForm.name} onChange={e => setWbForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs font-700 text-gray-500 uppercase block mb-1.5">Webhook URL *</label>
                <input className="input-field text-sm font-mono" placeholder="https://hook.make.com/abc123..." value={wbForm.url} onChange={e => setWbForm(f => ({ ...f, url: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs font-700 text-gray-500 uppercase block mb-1.5">Signing Secret <span className="text-gray-300 font-400 lowercase">(optional — for HMAC verification)</span></label>
                <div className="flex gap-2">
                  <input className="input-field text-sm font-mono flex-1" placeholder="Leave empty to skip signing" value={wbForm.secret} onChange={e => setWbForm(f => ({ ...f, secret: e.target.value }))} />
                  <button onClick={generateSecret} className="btn-outline flex-shrink-0 text-xs px-3">Generate</button>
                </div>
                {wbForm.secret && <p className="text-xs text-gray-400 mt-1">Sent as <code className="bg-gray-100 px-1 rounded">X-PetFlow-Signature</code> header with each request.</p>}
              </div>

              <div>
                <label className="text-xs font-700 text-gray-500 uppercase block mb-2">Events to Subscribe</label>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{wbForm.events.length} selected</span>
                  <div className="flex gap-2">
                    <button onClick={() => setWbForm(f => ({ ...f, events: ALL_EVENTS.map(e => e.key) }))} className="text-xs text-green-600 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Select all</button>
                    <button onClick={() => setWbForm(f => ({ ...f, events: [] }))} className="text-xs text-gray-400 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {ALL_EVENTS.map(ev => (
                    <label key={ev.key} onClick={() => toggleEvent(ev.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: wbForm.events.includes(ev.key) ? 'rgba(34,197,94,0.06)' : '#f9fafb', border: wbForm.events.includes(ev.key) ? '1px solid rgba(34,197,94,0.3)' : '1px solid #f3f4f6', transition: 'all .15s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: wbForm.events.includes(ev.key) ? '#22c55e' : 'white', border: wbForm.events.includes(ev.key) ? '2px solid #22c55e' : '2px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {wbForm.events.includes(ev.key) && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                      <div>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>{ev.label}</p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>{ev.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 28px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} className="btn-outline">Cancel</button>
              <button onClick={saveWebhook} disabled={wbSaving} className="btn-sage flex items-center gap-2">
                {wbSaving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><Save size={15} /> {editingWebhook ? 'Update' : 'Create Webhook'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
