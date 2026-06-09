'use client'

import { useState, useEffect } from 'react'
import {
  Bot, Save, CheckCircle2, AlertCircle, Plus, Trash2,
  Brain, Calendar, Wrench, BookOpen, ChevronDown, ChevronUp,
  Sparkles, Loader2, ToggleLeft, ToggleRight, Info
} from 'lucide-react'
import { getPetroConfig, savePetroConfig, previewPetroChat } from '@/lib/petro-config-actions'
import {
  DEFAULT_BOOKING_RULES, ALL_TOOLS,
  type PetroConfigData, type KnowledgeEntry, type BookingRules
} from '@/lib/petro-config-types'

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const REQUIRED_TOOLS = ['search_client_and_pets', 'create_client_profile', 'add_pet_to_profile']

const DEFAULT_CONFIG: PetroConfigData = {
  agent_name: 'Petro',
  persona: '',
  tone: 'friendly',
  language: 'en',
  booking_rules: DEFAULT_BOOKING_RULES,
  tools_enabled: [
    'search_client_and_pets', 'create_client_profile', 'add_pet_to_profile',
    'create_appointment', 'get_upcoming_appointments', 'reschedule_appointment',
    'list_available_services', 'get_vaccination_records',
  ],
  knowledge_base: [],
  plan_tier: 'business',
  is_active: true,
}

type Tab = 'identity' | 'knowledge' | 'booking' | 'tools' | 'playground'

export default function PetroConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('identity')
  const [config, setConfig] = useState<PetroConfigData>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [newEntry, setNewEntry] = useState({ question: '', answer: '' })

  const [playgroundMessages, setPlaygroundMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [playgroundInput, setPlaygroundInput] = useState('')
  const [playgroundLogs, setPlaygroundLogs] = useState<string[]>([])
  const [playgroundLoading, setPlaygroundLoading] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    if (activeTab === 'playground' && playgroundMessages.length === 0) {
      setPlaygroundMessages([
        { role: 'assistant', content: `🐾 Woof! Hello, I am ${config.agent_name || 'Petro'}. I'm running with your draft settings! Ask me anything or try to book an appointment.` }
      ])
      setPlaygroundLogs([`[Sandbox Ready] Loaded agent "${config.agent_name || 'Petro'}" in "${config.tone || 'friendly'}" tone.`])
    }
  }, [activeTab, config.agent_name, config.tone, playgroundMessages.length])

  async function loadConfig() {
    setLoading(true)
    try {
      const data = await getPetroConfig()
      if (data) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          booking_rules: {
            ...DEFAULT_BOOKING_RULES,
            ...data.booking_rules,
            working_hours: {
              ...DEFAULT_BOOKING_RULES.working_hours,
              ...(data.booking_rules?.working_hours || {}),
            },
          },
        })
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const result = await savePetroConfig(config)
    if (result.success) {
      setMessage({ type: 'success', text: 'Petro configuration saved! Changes will take effect on the next message.' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save configuration.' })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 5000)
  }

  function updateBookingRules(updates: Partial<BookingRules>) {
    setConfig(c => ({ ...c, booking_rules: { ...c.booking_rules, ...updates } }))
  }

  function updateWorkingHour(day: string, field: string, value: any) {
    setConfig(c => ({
      ...c,
      booking_rules: {
        ...c.booking_rules,
        working_hours: {
          ...c.booking_rules.working_hours,
          [day]: { ...c.booking_rules.working_hours[day], [field]: value },
        },
      },
    }))
  }

  function toggleTool(toolName: string) {
    if (REQUIRED_TOOLS.includes(toolName)) return
    setConfig(c => ({
      ...c,
      tools_enabled: c.tools_enabled.includes(toolName)
        ? c.tools_enabled.filter(t => t !== toolName)
        : [...c.tools_enabled, toolName],
    }))
  }

  function addKnowledgeEntry() {
    if (!newEntry.question.trim() || !newEntry.answer.trim()) return
    const entry: KnowledgeEntry = {
      id: Date.now().toString(),
      question: newEntry.question.trim(),
      answer: newEntry.answer.trim(),
    }
    setConfig(c => ({ ...c, knowledge_base: [...c.knowledge_base, entry] }))
    setNewEntry({ question: '', answer: '' })
  }

  function removeKnowledgeEntry(id: string) {
    setConfig(c => ({ ...c, knowledge_base: c.knowledge_base.filter(e => e.id !== id) }))
  }

  function toggleRequiredField(field: string) {
    const current = config.booking_rules.required_fields || []
    if (current.includes(field)) {
      updateBookingRules({ required_fields: current.filter(f => f !== field) })
    } else {
      updateBookingRules({ required_fields: [...current, field] })
    }
  }

  async function handlePlaygroundSend(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!playgroundInput.trim() || playgroundLoading) return

    const userMsg = { role: 'user' as const, content: playgroundInput.trim() }
    const updatedMessages = [...playgroundMessages, userMsg]
    
    setPlaygroundMessages(updatedMessages)
    setPlaygroundInput('')
    setPlaygroundLoading(true)

    try {
      const result = await previewPetroChat(config, updatedMessages)
      if (result.success && result.reply) {
        setPlaygroundMessages(prev => [...prev, { role: 'assistant', content: result.reply! }])
        if (result.logs) {
          setPlaygroundLogs(prev => [...prev, ...result.logs!])
        }
      } else {
        setPlaygroundMessages(prev => [...prev, { role: 'assistant', content: `🐾 Sorry, I encountered an error: ${result.error || 'Connection failed'}` }])
      }
    } catch (err: any) {
      setPlaygroundMessages(prev => [...prev, { role: 'assistant', content: `🐾 Sorry, I encountered a communication error: ${err.message}` }])
    } finally {
      setPlaygroundLoading(false)
    }
  }

  function resetPlayground() {
    setPlaygroundMessages([
      { role: 'assistant', content: `🐾 Woof! Hello, I am ${config.agent_name || 'Petro'}. I'm running with your draft settings! Ask me anything or try to book an appointment.` }
    ])
    setPlaygroundLogs([`[Sandbox Reset] Playground chat history and logs cleared.`])
    setPlaygroundInput('')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--sage-dark)' }} />
        <p style={{ color: '#9ca3af' }}>Loading Petro configuration...</p>
      </div>
    )
  }

  const tabs = [
    { id: 'identity' as Tab, label: 'Identity', icon: Brain },
    { id: 'knowledge' as Tab, label: 'Knowledge Base', icon: BookOpen },
    { id: 'booking' as Tab, label: 'Booking Rules', icon: Calendar },
    { id: 'tools' as Tab, label: 'Tools & Skills', icon: Wrench },
    { id: 'playground' as Tab, label: 'Testing Playground', icon: Sparkles },
  ]

  return (
    <div style={{ padding: '2rem', maxWidth: 900, paddingBottom: '6rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #89A894 0%, #5a7a66 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(137,168,148,0.3)',
          }}>
            <Bot size={26} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Petro AI Configuration</h1>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '4px 0 0' }}>
              Customize how Petro behaves, what he knows, and how he books
            </p>
          </div>
        </div>
        <button
          id="save-petro-config-btn"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0.625rem 1.25rem', borderRadius: 12,
            background: 'linear-gradient(135deg, #89A894 0%, #5a7a66 100%)',
            color: 'white', fontWeight: 700, fontSize: '0.875rem',
            border: 'none', cursor: saving ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(137,168,148,0.35)',
            opacity: saving ? 0.8 : 1,
          }}
        >
          {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div style={{
          marginBottom: '1.5rem', padding: '1rem 1.25rem',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
          background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#15803d' : '#dc2626',
        }}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: '1.5rem',
        background: '#f9fafb', padding: 4, borderRadius: 14,
        border: '1px solid #f0f0f0', width: 'fit-content',
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`petro-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.5rem 1rem', borderRadius: 10,
              border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.82rem',
              transition: 'all 0.15s',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#1f2937' : '#9ca3af',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── IDENTITY TAB ── */}
      {activeTab === 'identity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Live Preview Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(137,168,148,0.1) 0%, rgba(90,122,102,0.05) 100%)',
            border: '1px solid rgba(137,168,148,0.25)', borderRadius: 16,
            padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Sparkles size={20} style={{ color: 'var(--sage-dark)', flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Live Preview</p>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '2px 0 0' }}>
                Your agent will greet clients as: &ldquo;<strong>{config.agent_name || 'Petro'}</strong>&rdquo; in a {config.tone} tone
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Agent Identity</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Agent Name</label>
                <input
                  id="petro-agent-name"
                  className="input-field"
                  value={config.agent_name}
                  onChange={e => setConfig(c => ({ ...c, agent_name: e.target.value }))}
                  placeholder="e.g. Petro, Max, Whiskers"
                />
                <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>This name will replace &ldquo;Petro&rdquo; in all responses</p>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Tone</label>
                <select
                  id="petro-tone-select"
                  className="input-field"
                  value={config.tone}
                  onChange={e => setConfig(c => ({ ...c, tone: e.target.value }))}
                >
                  <option value="friendly">Friendly & Warm</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual & Fun</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Primary Language</label>
                <select
                  id="petro-language-select"
                  className="input-field"
                  value={config.language}
                  onChange={e => setConfig(c => ({ ...c, language: e.target.value }))}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="mr">Marathi</option>
                  <option value="kn">Kannada</option>
                  <option value="ml">Malayalam</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Custom System Prompt (Persona)</label>
              <textarea
                id="petro-persona-textarea"
                className="input-field"
                rows={10}
                value={config.persona}
                onChange={e => setConfig(c => ({ ...c, persona: e.target.value }))}
                placeholder="Leave blank to use the default PetFlow prompt. Or write your own:\n\nYou are [Agent Name], a friendly assistant for [Business Name]...\n\nUse [SPA_NAME] and [BOOKING_LINK] as placeholders."
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
              />
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>
                Use <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 4 }}>[SPA_NAME]</code> and <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 4 }}>[BOOKING_LINK]</code> as dynamic placeholders. Leave blank to use the default prompt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── KNOWLEDGE BASE TAB ── */}
      {activeTab === 'knowledge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Business Knowledge Base</h3>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 4 }}>Petro will use these Q&A pairs to answer client questions accurately</p>
              </div>
              <span style={{
                background: 'var(--sage-muted)', color: 'var(--sage-dark)',
                padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
              }}>{config.knowledge_base.length} entries</span>
            </div>

            {/* Add new entry */}
            <div style={{
              background: '#f9fafb', borderRadius: 12, padding: '1.25rem',
              border: '1px solid #f0f0f0', marginBottom: '1.25rem',
            }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>Add New Entry</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  id="kb-question-input"
                  className="input-field"
                  placeholder="Question (e.g. What are your prices?)"
                  value={newEntry.question}
                  onChange={e => setNewEntry(n => ({ ...n, question: e.target.value }))}
                />
                <textarea
                  id="kb-answer-input"
                  className="input-field"
                  rows={3}
                  placeholder="Answer (e.g. Our grooming prices start at ₹600 for small breeds...)"
                  value={newEntry.answer}
                  onChange={e => setNewEntry(n => ({ ...n, answer: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
                <button
                  id="kb-add-btn"
                  onClick={addKnowledgeEntry}
                  disabled={!newEntry.question.trim() || !newEntry.answer.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '0.5rem 1rem', borderRadius: 10, border: 'none',
                    background: (!newEntry.question.trim() || !newEntry.answer.trim()) ? '#e5e7eb' : 'var(--sage-dark)',
                    color: (!newEntry.question.trim() || !newEntry.answer.trim()) ? '#9ca3af' : 'white',
                    fontWeight: 600, fontSize: '0.82rem', cursor: (!newEntry.question.trim() || !newEntry.answer.trim()) ? 'not-allowed' : 'pointer',
                    width: 'fit-content',
                  }}
                >
                  <Plus size={14} /> Add to Knowledge Base
                </button>
              </div>
            </div>

            {/* Existing entries */}
            {config.knowledge_base.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <p style={{ fontSize: '0.875rem' }}>No knowledge entries yet.</p>
                <p style={{ fontSize: '0.75rem' }}>Add Q&A pairs above to help Petro answer business-specific questions.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {config.knowledge_base.map((entry, i) => (
                  <div key={entry.id} style={{
                    padding: '1rem 1.25rem', borderRadius: 12,
                    border: '1px solid #e5e7eb', background: 'white',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1f2937', marginBottom: 4 }}>
                        Q: {entry.question}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5 }}>
                        A: {entry.answer}
                      </p>
                    </div>
                    <button
                      onClick={() => removeKnowledgeEntry(entry.id)}
                      style={{
                        background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: 8, padding: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}
                    >
                      <Trash2 size={14} color="#dc2626" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BOOKING RULES TAB ── */}
      {activeTab === 'booking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Slot Settings */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Slot Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Slot Duration (mins)</label>
                <input
                  id="booking-slot-duration"
                  type="number" min={15} max={240} step={15}
                  className="input-field"
                  value={config.booking_rules.slot_duration}
                  onChange={e => updateBookingRules({ slot_duration: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Max Advance (days)</label>
                <input
                  id="booking-max-advance"
                  type="number" min={1} max={365}
                  className="input-field"
                  value={config.booking_rules.max_advance_days}
                  onChange={e => updateBookingRules({ max_advance_days: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Max Concurrent</label>
                <input
                  id="booking-max-concurrent"
                  type="number" min={1} max={20}
                  className="input-field"
                  value={config.booking_rules.max_concurrent}
                  onChange={e => updateBookingRules({ max_concurrent: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Working Hours</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DAYS.map(day => {
                const hours = config.booking_rules.working_hours?.[day.key] || { start: '09:00', end: '18:00', is_working: true }
                return (
                  <div key={day.key} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0.75rem 1rem', borderRadius: 12,
                    border: `1px solid ${hours.is_working ? '#e5e7eb' : '#fecaca'}`,
                    background: hours.is_working ? 'white' : '#fff5f5',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ width: 80, fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>{day.label}</div>
                    <input
                      type="time"
                      className="input-field"
                      style={{ flex: 1, padding: '0.375rem 0.625rem', fontSize: '0.85rem', opacity: hours.is_working ? 1 : 0.4 }}
                      disabled={!hours.is_working}
                      value={hours.start}
                      onChange={e => updateWorkingHour(day.key, 'start', e.target.value)}
                    />
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>to</span>
                    <input
                      type="time"
                      className="input-field"
                      style={{ flex: 1, padding: '0.375rem 0.625rem', fontSize: '0.85rem', opacity: hours.is_working ? 1 : 0.4 }}
                      disabled={!hours.is_working}
                      value={hours.end}
                      onChange={e => updateWorkingHour(day.key, 'end', e.target.value)}
                    />
                    <button
                      id={`toggle-day-${day.key}`}
                      onClick={() => updateWorkingHour(day.key, 'is_working', !hours.is_working)}
                      style={{
                        padding: '0.375rem 0.875rem', borderRadius: 8,
                        border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem',
                        background: hours.is_working ? '#dcfce7' : '#fee2e2',
                        color: hours.is_working ? '#15803d' : '#dc2626',
                        minWidth: 64,
                      }}
                    >
                      {hours.is_working ? 'OPEN' : 'CLOSED'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Required Fields */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>Required Fields Before Booking</h3>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem' }}>Petro will collect these before confirming any appointment</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {['pet_name', 'species', 'breed', 'issue', 'owner_name', 'phone'].map(field => {
                const isActive = (config.booking_rules.required_fields || []).includes(field)
                return (
                  <button
                    key={field}
                    id={`req-field-${field}`}
                    onClick={() => toggleRequiredField(field)}
                    style={{
                      padding: '0.375rem 0.875rem', borderRadius: 20,
                      border: `1px solid ${isActive ? 'var(--sage-dark)' : '#e5e7eb'}`,
                      background: isActive ? 'var(--sage-muted)' : 'white',
                      color: isActive ? 'var(--sage-dark)' : '#6b7280',
                      fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                    }}
                  >
                    {isActive ? '✓ ' : ''}{field.replace('_', ' ')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TOOLS & SKILLS TAB ── */}
      {activeTab === 'tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 12, padding: '0.875rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Info size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <p style={{ fontSize: '0.8rem', color: '#1e40af', margin: 0 }}>
              Core tools (Client Lookup, Create Profile, Add Pet) are always enabled and cannot be disabled.
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Available Skills</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ALL_TOOLS.map(tool => {
                const isEnabled = config.tools_enabled.includes(tool.name)
                const isRequired = REQUIRED_TOOLS.includes(tool.name)
                return (
                  <div
                    key={tool.name}
                    id={`tool-${tool.name}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '1rem 1.25rem', borderRadius: 12,
                      border: `1px solid ${isEnabled ? 'rgba(137,168,148,0.3)' : '#f0f0f0'}`,
                      background: isEnabled ? 'rgba(137,168,148,0.05)' : 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1f2937' }}>{tool.label}</span>
                        {isRequired && (
                          <span style={{
                            background: '#fef3c7', color: '#92400e',
                            fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px',
                            borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>Required</span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>{tool.description}</p>
                    </div>
                    <button
                      onClick={() => toggleTool(tool.name)}
                      disabled={isRequired}
                      style={{ background: 'none', border: 'none', cursor: isRequired ? 'not-allowed' : 'pointer', padding: 4 }}
                    >
                      {isEnabled
                        ? <ToggleRight size={28} style={{ color: 'var(--sage-dark)' }} />
                        : <ToggleLeft size={28} style={{ color: '#d1d5db' }} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PLAYGROUND TAB ── */}
      {activeTab === 'playground' && (
        <div style={{ display: 'flex', gap: 24, height: '65vh', minHeight: 480, alignItems: 'stretch' }}>
          {/* Left: Chat Widget */}
          <div style={{
            flex: 1.2, display: 'flex', flexDirection: 'column',
            background: 'white', border: '1px solid #e5e7eb',
            borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            overflow: 'hidden'
          }}>
            {/* Chat Header */}
            <div style={{
              padding: '1rem 1.25rem', borderBottom: '1px solid #f0f0f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#f9fafb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1f2937' }}>
                    {config.agent_name || 'Petro'} Sandbox
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Draft settings active</div>
                </div>
              </div>
              <button
                onClick={resetPlayground}
                style={{
                  padding: '4px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
                  background: 'white', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                Reset Chat
              </button>
            </div>

            {/* Chat Messages */}
            <div style={{
              flex: 1, padding: '1.25rem', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 12,
              background: '#fcfcfc'
            }}>
              {playgroundMessages.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    width: '100%'
                  }}>
                    <div style={{
                      maxWidth: '80%', padding: '0.75rem 1rem', borderRadius: 16,
                      fontSize: '0.82rem', lineHeight: 1.4,
                      background: isUser ? 'linear-gradient(135deg, #89A894 0%, #5a7a66 100%)' : '#f3f4f6',
                      color: isUser ? 'white' : '#1f2937',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      borderBottomRightRadius: isUser ? 2 : 16,
                      borderBottomLeftRadius: isUser ? 16 : 2
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              {playgroundLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0.75rem 1rem', borderRadius: 16,
                    background: '#f3f4f6', color: '#6b7280', fontSize: '0.8rem'
                  }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>{config.agent_name || 'Petro'} is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handlePlaygroundSend} style={{
              padding: '0.875rem 1.25rem', borderTop: '1px solid #f0f0f0',
              display: 'flex', gap: 8, background: '#f9fafb'
            }}>
              <input
                className="input-field"
                style={{ flex: 1, margin: 0, padding: '0.5rem 0.875rem', fontSize: '0.85rem' }}
                placeholder={`Type a message to test ${config.agent_name || 'Petro'}...`}
                value={playgroundInput}
                onChange={e => setPlaygroundInput(e.target.value)}
                disabled={playgroundLoading}
              />
              <button
                type="submit"
                disabled={playgroundLoading || !playgroundInput.trim()}
                style={{
                  padding: '0.5rem 1rem', borderRadius: 10, border: 'none',
                  background: (playgroundLoading || !playgroundInput.trim()) ? '#e5e7eb' : 'var(--sage-dark)',
                  color: (playgroundLoading || !playgroundInput.trim()) ? '#9ca3af' : 'white',
                  fontWeight: 700, fontSize: '0.82rem',
                  cursor: (playgroundLoading || !playgroundInput.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                Send
              </button>
            </form>
          </div>

          {/* Right: Console/Logs Panel */}
          <div style={{
            flex: 0.8, display: 'flex', flexDirection: 'column',
            background: '#0f172a', border: '1px solid #1e293b',
            borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            {/* Logs Header */}
            <div style={{
              padding: '0.75rem 1.25rem', background: '#1e293b',
              borderBottom: '1px solid #334155', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Console Execution Logs
              </span>
              <button
                onClick={() => setPlaygroundLogs([])}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600
                }}
              >
                Clear
              </button>
            </div>

            {/* Logs Body */}
            <div style={{
              flex: 1, padding: '1rem', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 8,
              fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.5,
              background: '#090d16', color: '#94a3b8'
            }}>
              {playgroundLogs.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: '0.7rem' }}>
                  No execution logs yet. Send a message to start tracing.
                </div>
              ) : (
                playgroundLogs.map((log, i) => {
                  let color = '#94a3b8'
                  if (log.startsWith('[System Prompt]')) color = '#eab308' // Yellow
                  if (log.startsWith('[Tools Gating]')) color = '#a855f7' // Purple
                  if (log.startsWith('[OpenAI Tool Calls]') || log.startsWith('[Tool Execution]')) color = '#10b981' // Emerald
                  if (log.startsWith('[Tool Response]')) color = '#06b6d4' // Cyan
                  if (log.startsWith('[Booking Rules Engine]')) color = '#3b82f6' // Blue
                  if (log.startsWith('[Groomer Availability]')) color = '#f97316' // Orange
                  if (log.startsWith('[ERROR]')) color = '#ef4444' // Red
                  
                  return (
                    <div key={i} style={{ color, borderBottom: '1px solid #1e293b', paddingBottom: 4 }}>
                      {log}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
