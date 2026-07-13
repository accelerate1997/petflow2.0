'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Root Global Error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ 
        margin: 0, 
        padding: 0, 
        fontFamily: 'system-ui, sans-serif', 
        backgroundColor: '#F8F7F4', 
        color: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'white',
          padding: '2.5rem',
          borderRadius: '1.25rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.06)',
          maxWidth: '480px',
          width: '90%'
        }}>
          <div style={{
            background: '#fee2e2',
            color: '#ef4444',
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.75rem',
            fontWeight: 'bold'
          }}>
            !
          </div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 800 }}>Something went wrong!</h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 2rem', lineHeight: 1.5 }}>
            An unexpected error occurred in the system. Click the button below to attempt reloading the application.
          </p>
          <button 
            onClick={() => reset()} 
            style={{
              backgroundColor: '#89A894',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.625rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#6d8f7a'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#89A894'}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
