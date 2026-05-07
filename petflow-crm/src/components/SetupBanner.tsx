'use client'

import { AlertTriangle, ExternalLink } from 'lucide-react'

export default function SetupBanner() {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)',
        border: '1.5px solid #fed7aa',
        borderRadius: '1rem',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        marginBottom: '1.5rem',
      }}
    >
      <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e', marginBottom: '0.25rem' }}>
          PocketBase not connected
        </p>
        <p style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5 }}>
          Create a <code style={{ background: 'rgba(0,0,0,0.06)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>.env.local</code> file in the project root with your{' '}
          <strong>NEXT_PUBLIC_POCKETBASE_URL</strong>.
          Make sure your PocketBase server is running on your VPS.
        </p>
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: '0.5rem', textDecoration: 'none' }}
        >
          Check VPS Status <ExternalLink size={12} />
        </a>
      </div>
    </div>
  )
}

