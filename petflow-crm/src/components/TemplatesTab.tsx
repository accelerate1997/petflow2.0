'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2
} from 'lucide-react'
import {
  createWhatsAppTemplateAction,
  getWhatsAppTemplates,
  deleteWhatsAppTemplateAction,
  syncWhatsAppTemplatesAction
} from '@/lib/actions'

interface Template {
  id: string
  name: string
  body: string
  language: string
  category: string
  status: string
  contentSid: string
  created: Date
}

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('MARKETING')
  const [language, setLanguage] = useState('en')
  const [creating, setCreating] = useState(false)

  const loadTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getWhatsAppTemplates()
      setTemplates(data as any)
    } catch (err: any) {
      setError(err.message || 'Failed to load templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Template name is required.')
    if (!body.trim()) return setError('Template body is required.')
    
    // Validate template name format (no spaces, alphanumeric/underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(name.trim())) {
      return setError('Template name must contain only letters, numbers, and underscores (no spaces).')
    }

    setCreating(true)
    setError('')
    setSuccess('')
    try {
      await createWhatsAppTemplateAction(name.trim(), body.trim(), category, language)
      setSuccess('Template created and submitted to WhatsApp for approval!')
      setName('')
      setBody('')
      setShowCreateForm(false)
      loadTemplates()
    } catch (err: any) {
      setError(err.message || 'Failed to create template.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template from the CRM?')) return
    setError('')
    setSuccess('')
    try {
      await deleteWhatsAppTemplateAction(id)
      setSuccess('Template deleted.')
      loadTemplates()
    } catch (err: any) {
      setError(err.message || 'Failed to delete template.')
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    setSuccess('')
    try {
      const res = await syncWhatsAppTemplatesAction()
      setSuccess(`Sync completed. Updated ${res?.updatedCount || 0} template(s).`)
      loadTemplates()
    } catch (err: any) {
      setError(err.message || 'Failed to sync templates.')
    } finally {
      setSyncing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
      case 'rejected':
        return <XCircle size={16} style={{ color: '#dc2626' }} />
      default:
        return <AlertCircle size={16} style={{ color: '#d97706' }} />
    }
  }

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
      case 'rejected':
        return { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }
      default:
        return { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">WhatsApp Message Templates</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Create and submit templates directly to WhatsApp for approval to bypass the 24-hour delivery restriction.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-3"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Sync Status
          </button>
          <button
            type="button"
            className="btn-sage flex items-center gap-1.5 text-xs py-1.5 px-3"
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setError('')
              setSuccess('')
            }}
          >
            <Plus size={14} />
            New Template
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 flex gap-2 text-xs" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl p-3 flex gap-2 text-xs" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
          <CheckCircle2 size={16} className="flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col gap-4">
          <h4 className="text-sm font-semibold text-gray-900">Create & Submit WhatsApp Template</h4>
          
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  className="input-field text-xs py-1.5"
                  placeholder="e.g. promo_offer_july"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="MARKETING">Marketing / Promotional</option>
                  <option value="UTILITY">Utility / Appointment Alert</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Language *</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                >
                  <option value="en">English (en)</option>
                  <option value="es">Spanish (es)</option>
                  <option value="fr">French (fr)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Template Body *</label>
              <textarea
                rows={4}
                className="input-field text-xs py-2 h-auto"
                placeholder="e.g. Hello {{1}}! We have a special weekend bubble wash discount for {{2}}. Reply STOP to unsubscribe."
                value={body}
                onChange={e => setBody(e.target.value)}
              />
              <div className="rounded-xl p-3 bg-blue-50 border border-blue-100 flex gap-2 mt-2">
                <HelpCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-blue-700 leading-normal">
                  <strong>Placeholders Rule:</strong> Use <code>{"{{1}}"}</code> for the Customer Name, and <code>{"{{2}}"}</code> for their Pet Name. WhatsApp templates require these sequential variables to personalize messages automatically on send.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                className="btn-outline text-xs py-1.5 px-3"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-sage text-xs py-1.5 px-3 flex items-center gap-1.5"
                disabled={creating}
              >
                {creating && <Loader2 size={12} className="animate-spin" />}
                Submit to WhatsApp
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
          <FileText size={32} className="text-gray-300 mx-auto" />
          <h4 className="text-sm font-semibold text-gray-400 mt-2">No templates configured yet</h4>
          <p className="text-xs text-gray-400 mt-1">Submit your first WhatsApp template using the button above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                <th className="p-3">Friendly Name</th>
                <th className="p-3">Template Content</th>
                <th className="p-3">Category / Lang</th>
                <th className="p-3">Status</th>
                <th className="p-3">Content SID</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-900">{t.name}</td>
                  <td className="p-3 text-gray-600 max-w-xs truncate" title={t.body}>{t.body}</td>
                  <td className="p-3 text-gray-500 uppercase">
                    {t.category} ({t.language})
                  </td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1"
                      style={getStatusBadgeStyle(t.status)}
                    >
                      {getStatusIcon(t.status)}
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 font-mono text-[10px]">{t.contentSid}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
