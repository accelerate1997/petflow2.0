import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sub-Processor List — PetFlow',
  description: 'List of all third-party data processors used by PetFlow and how they handle your data.',
}

const processors = [
  {
    category: '🤖 AI & Automation',
    items: [
      {
        name: 'OpenAI',
        purpose: 'Powers the Petro AI assistant (WhatsApp & Instagram chatbot). Client conversation messages are sent to OpenAI for natural language processing.',
        dataShared: 'Chat message content, pet names (via conversation context)',
        location: '🇺🇸 USA',
        retention: 'Not retained beyond API request (per OpenAI policy)',
        policy: 'https://openai.com/policies/privacy-policy',
        policyLabel: 'openai.com/policies',
      },
    ]
  },
  {
    category: '📱 Messaging & Communications',
    items: [
      {
        name: 'Twilio',
        purpose: 'Sends and receives WhatsApp messages and SMS on behalf of the pet spa.',
        dataShared: 'Phone numbers, message content',
        location: '🇺🇸 USA',
        retention: 'Per Twilio data retention policy (typically 30 days)',
        policy: 'https://www.twilio.com/legal/privacy',
        policyLabel: 'twilio.com/legal/privacy',
      },
      {
        name: 'Meta (WhatsApp Business API)',
        purpose: 'WhatsApp messaging platform used for appointment reminders and AI assistant conversations.',
        dataShared: 'Phone numbers, message content',
        location: '🇺🇸 USA / 🇮🇪 Ireland (EU users)',
        retention: 'Per Meta/WhatsApp platform policies',
        policy: 'https://www.whatsapp.com/legal/privacy-policy',
        policyLabel: 'whatsapp.com/legal/privacy',
      },
      {
        name: 'Meta (Instagram)',
        purpose: 'Instagram Direct Message integration for the Petro AI assistant.',
        dataShared: 'Instagram user IDs, message content',
        location: '🇺🇸 USA / 🇮🇪 Ireland (EU users)',
        retention: 'Per Meta platform policies',
        policy: 'https://privacycenter.instagram.com/policy',
        policyLabel: 'instagram.com/privacy',
      },
    ]
  },
  {
    category: '💳 Payments',
    items: [
      {
        name: 'Razorpay',
        purpose: 'Payment processing for Indian market customers. Card data is never stored on PetFlow servers.',
        dataShared: 'Invoice amount, currency, customer email/phone (for payment link)',
        location: '🇮🇳 India',
        retention: 'Per Razorpay policies (PCI-DSS compliant)',
        policy: 'https://razorpay.com/privacy/',
        policyLabel: 'razorpay.com/privacy',
      },
      {
        name: 'Stripe',
        purpose: 'Payment processing for international/UAE/US market customers.',
        dataShared: 'Invoice amount, currency, customer email (for payment intent)',
        location: '🇺🇸 USA / 🇮🇪 Ireland (EU users)',
        retention: 'Per Stripe data retention (PCI-DSS compliant)',
        policy: 'https://stripe.com/privacy',
        policyLabel: 'stripe.com/privacy',
      },
    ]
  },
  {
    category: '☁️ Infrastructure & Storage',
    items: [
      {
        name: 'Amazon Web Services (S3)',
        purpose: 'Stores pet photos, before/after grooming images, and other media files uploaded to PetFlow.',
        dataShared: 'Pet images, media files (no personal PII stored in filenames)',
        location: '🇸🇬 Singapore / varies by bucket configuration',
        retention: 'Retained until explicitly deleted by the spa or client',
        policy: 'https://aws.amazon.com/privacy/',
        policyLabel: 'aws.amazon.com/privacy',
      },
      {
        name: 'Coolify / VPS Host',
        purpose: 'Self-hosted infrastructure for running the PetFlow application and database.',
        dataShared: 'All application data (hosted on private servers)',
        location: 'Varies by deployment region',
        retention: 'Retained per data retention policy',
        policy: 'https://coolify.io/privacy',
        policyLabel: 'coolify.io/privacy',
      },
      {
        name: 'Neon / PostgreSQL',
        purpose: 'Primary database storing all CRM data (clients, pets, appointments, invoices).',
        dataShared: 'All structured data including personal data',
        location: '🇺🇸 USA (configurable)',
        retention: 'Retained per data retention policy; backups retained 30 days',
        policy: 'https://neon.tech/privacy-policy',
        policyLabel: 'neon.tech/privacy-policy',
      },
    ]
  },
  {
    category: '🔐 Authentication',
    items: [
      {
        name: 'Google Firebase Authentication',
        purpose: 'Handles Google Sign-In for staff and admin users of the CRM dashboard.',
        dataShared: 'Staff Google account email, display name, Google UID',
        location: '🇺🇸 USA / 🌍 Global',
        retention: 'Per Firebase/Google data policies',
        policy: 'https://firebase.google.com/support/privacy',
        policyLabel: 'firebase.google.com/support/privacy',
      },
    ]
  },
]

export default function SubProcessorsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-10 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
              style={{ background: 'var(--sage-muted)' }}
            >
              🔗
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sub-Processor List</h1>
              <p className="text-gray-500 text-sm mt-1">Last updated: July 2026</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-gray-600 mb-4">
            As a Data Processor acting on behalf of pet spas (Data Controllers), PetFlow uses the
            following third-party sub-processors to deliver its services. Each sub-processor has been
            evaluated for adequate data protection measures.
          </p>

          <div
            className="rounded-xl p-4 text-sm text-gray-700 border"
            style={{ background: 'var(--sage-muted)', borderColor: 'rgba(137,168,148,0.3)' }}
          >
            <strong>Your rights:</strong> If you are a pet spa using PetFlow, you may object to the
            use of any sub-processor by contacting PetFlow support. If you are a pet owner (end client),
            please contact your pet spa directly or visit our{' '}
            <Link href="/delete-my-data" className="underline" style={{ color: 'var(--sage-dark)' }}>
              Data Rights page
            </Link>.
          </div>
        </div>

        {/* Processor categories */}
        <div className="space-y-6">
          {processors.map(group => (
            <div key={group.category} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div
                className="px-6 py-4 border-b"
                style={{ background: 'var(--sage-muted)', borderColor: 'rgba(137,168,148,0.2)' }}
              >
                <h2 className="text-base font-semibold text-gray-800">{group.category}</h2>
              </div>

              <div className="divide-y divide-gray-50">
                {group.items.map(proc => (
                  <div key={proc.name} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 text-sm">{proc.name}</h3>
                          <span className="text-xs text-gray-400">{proc.location}</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed mb-3">{proc.purpose}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="text-xs">
                            <span className="font-medium text-gray-500">Data shared: </span>
                            <span className="text-gray-600">{proc.dataShared}</span>
                          </div>
                          <div className="text-xs">
                            <span className="font-medium text-gray-500">Retention: </span>
                            <span className="text-gray-600">{proc.retention}</span>
                          </div>
                        </div>
                      </div>

                      <a
                        href={proc.policy}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                        style={{
                          color: 'var(--sage-dark)',
                          borderColor: 'var(--sage-light)',
                          background: 'var(--sage-muted)',
                        }}
                      >
                        Privacy Policy ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mt-6 text-sm text-gray-500">
          <p className="mb-3">
            <strong className="text-gray-700">Changes to this list:</strong> PetFlow will notify tenant businesses
            of any new sub-processors at least 14 days before they are engaged. If you object to a new
            sub-processor, you may terminate your subscription without penalty.
          </p>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--sage-dark)' }}>
            <Link href="/privacy-policy" className="underline hover:opacity-80">Privacy Policy</Link>
            <Link href="/terms" className="underline hover:opacity-80">Terms of Service</Link>
            <Link href="/delete-my-data" className="underline hover:opacity-80">Your Data Rights</Link>
          </div>
        </div>

      </div>
    </div>
  )
}
