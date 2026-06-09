'use client'

import { AlertCircle, PawPrint, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PaymentCancelledPage() {
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
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}
            >
              <AlertCircle className="text-white" size={40} strokeWidth={2.5} />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Cancelled
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Your payment was not completed. No charges have been made to your account.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg border-0 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #89A894 0%, #6d8f7a 100%)' }}
            >
              <ArrowLeft size={16} />
              Try Again
            </button>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-gray-600 font-medium text-sm transition-all duration-300 border border-gray-200 hover:bg-gray-50 no-underline"
            >
              Go to PetFlow
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} PetFlow CRM. All rights reserved.
        </p>
      </div>
    </div>
  )
}
