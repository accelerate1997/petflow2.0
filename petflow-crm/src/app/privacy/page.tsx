'use client'

import { useEffect, useState, useCallback } from 'react'

interface DataRequest {
  id: string
  type: string
  status: string
  phone?: string
  email?: string
  country?: string
  deadline_at?: string
  fulfilled_at?: string
  created: string
  is_overdue?: boolean
  client?: { id: string; name: string; is_anonymized: boolean } | null
}

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  InProgress: 'bg-blue-100 text-blue-800',
  Fulfilled: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
}

const TYPE_LABELS: Record<string, string> = {
  ACCESS: '📋 Access',
  ERASURE: '🗑️ Erasure',
  PORTABILITY: '📦 Portability',
  RECTIFICATION: '✏️ Rectification',
  RESTRICTION: '🚫 Restriction',
}

const REGULATION_LABELS: Record<string, string> = {
  IN: '🇮🇳 DPDP (7 days)',
  AE: '🇦🇪 PDPL (30 days)',
  US: '🇺🇸 CCPA (45 days)',
}

export default function PrivacyDashboardPage() {
  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [exportData, setExportData] = useState<any>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/privacy/fulfill')
      const data = await res.json()
      if (Array.isArray(data)) {
        setRequests(data)
      } else {
        console.error('Failed to load privacy requests, expected array:', data)
        setRequests([])
      }
    } catch (err) {
      console.error('Failed to load privacy requests', err)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleExport = async (requestId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/privacy/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'export' })
      })
      const data = await res.json()
      if (data.success) {
        setExportData(data.data)
        await fetchRequests()
      } else {
        alert('Export failed: ' + (data.error || 'Unknown error'))
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleAnonymize = async (requestId: string) => {
    if (!confirm('This will permanently anonymize the client\'s PII. Financial records will be kept. This cannot be undone. Continue?')) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/privacy/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'anonymize' })
      })
      const data = await res.json()
      if (data.success) {
        alert('Client data has been anonymized successfully.')
        setSelectedRequest(null)
        await fetchRequests()
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'))
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusUpdate = async (requestId: string, status: string) => {
    setActionLoading(true)
    try {
      await fetch('/api/privacy/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'update_status', status })
      })
      await fetchRequests()
    } finally {
      setActionLoading(false)
    }
  }

  const downloadExport = (data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `client_data_export_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const overdue = requests.filter(r => r.is_overdue)
  const pending = requests.filter(r => r.status === 'Pending' && !r.is_overdue)
  const inProgress = requests.filter(r => r.status === 'InProgress')
  const fulfilled = requests.filter(r => r.status === 'Fulfilled' || r.status === 'Rejected')

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">🔒 Privacy & Data Rights</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage Data Subject Access Requests (DSAR) under DPDP Act, PDPL, and CCPA
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Overdue', count: overdue.length, color: 'border-red-400 bg-red-50', text: 'text-red-700' },
            { label: 'Pending', count: pending.length, color: 'border-yellow-400 bg-yellow-50', text: 'text-yellow-700' },
            { label: 'In Progress', count: inProgress.length, color: 'border-blue-400 bg-blue-50', text: 'text-blue-700' },
            { label: 'Fulfilled', count: fulfilled.length, color: 'border-green-400 bg-green-50', text: 'text-green-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border-2 p-4 ${s.color}`}>
              <div className={`text-3xl font-bold ${s.text}`}>{s.count}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Requests Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="text-lg font-semibold text-gray-700">No pending requests</h3>
            <p className="text-gray-500 text-sm">All data subject requests have been handled.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Request</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Regulation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deadline</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map(req => (
                  <tr key={req.id} className={`hover:bg-gray-50 ${req.is_overdue ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{TYPE_LABELS[req.type] || req.type}</div>
                      <div className="text-xs text-gray-400">{new Date(req.created).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{req.client?.name || req.phone || req.email || 'Unknown'}</div>
                      {req.client?.is_anonymized && (
                        <span className="text-xs text-gray-400">[Anonymized]</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {REGULATION_LABELS[req.country || ''] || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {req.deadline_at ? (
                        <span className={`text-xs font-medium ${req.is_overdue ? 'text-red-600' : 'text-gray-600'}`}>
                          {req.is_overdue ? '⚠️ ' : ''}{new Date(req.deadline_at).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {req.status !== 'Fulfilled' && req.status !== 'Rejected' && (
                          <>
                            {(req.type === 'ACCESS' || req.type === 'PORTABILITY') && req.client && !req.client.is_anonymized && (
                              <button
                                onClick={() => handleExport(req.id)}
                                disabled={actionLoading}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                Export Data
                              </button>
                            )}
                            {(req.type === 'ERASURE') && req.client && !req.client.is_anonymized && (
                              <button
                                onClick={() => handleAnonymize(req.id)}
                                disabled={actionLoading}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Anonymize
                              </button>
                            )}
                            <button
                              onClick={() => handleStatusUpdate(req.id, req.status === 'Pending' ? 'InProgress' : 'Fulfilled')}
                              disabled={actionLoading}
                              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                            >
                              {req.status === 'Pending' ? 'Mark In Progress' : 'Mark Fulfilled'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Export modal */}
        {exportData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <h3 className="text-lg font-bold mb-2">📦 Data Export Ready</h3>
              <p className="text-sm text-gray-600 mb-4">
                The client's data export is ready. Download and send it to the client to fulfill their portability/access request.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => downloadExport(exportData)}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
                >
                  ⬇️ Download JSON
                </button>
                <button
                  onClick={() => setExportData(null)}
                  className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
