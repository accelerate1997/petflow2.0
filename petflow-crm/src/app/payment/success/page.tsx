'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle2, PawPrint, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6 font-sans"
      style={{ background: 'linear-gradient(135deg, #f0f5f1 0%, #e2ece5 50%, #d4e0d8 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg, #89A894 0%, #6d8f7a 100%)' }}
          >
            <PawPrint className="text-white" size={22} />
          </div>
          <span className="text-gray-800 font-bold text-xl tracking-wide">PetFlow</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[24px] shadow-xl border border-gray-100 p-10 text-center">
          {/* Animated Checkmark */}
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center animate-bounce"
              style={{
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                animationDuration: '2s',
                animationIterationCount: '3',
              }}
            >
              <CheckCircle2 className="text-white" size={40} strokeWidth={2.5} />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Your payment has been received. Thank you!
          </p>

          {sessionId && (
            <p className="text-xs text-gray-400 mb-6 font-mono break-all">
              Reference: {sessionId}
            </p>
          )}

          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg no-underline"
            style={{ background: 'linear-gradient(135deg, #89A894 0%, #6d8f7a 100%)' }}
          >
            Go to PetFlow
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} PetFlow CRM. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center font-sans"
          style={{ background: 'linear-gradient(135deg, #f0f5f1 0%, #e2ece5 50%, #d4e0d8 100%)' }}
        >
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
