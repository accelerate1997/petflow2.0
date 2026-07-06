import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — PetFlow',
  description: 'Terms and conditions for using the PetFlow pet spa management platform.',
}

export default function TermsOfServicePage() {
  const lastUpdated = 'July 2026'
  const effectiveDate = 'July 1, 2026'

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--sage-muted)' }}
            >
              <span className="text-lg">📄</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
              <p className="text-sm text-gray-400 mt-0.5">Effective: {effectiveDate} · Last updated: {lastUpdated}</p>
            </div>
          </div>
          <div className="rounded-xl p-4 text-sm text-gray-600" style={{ background: 'var(--sage-muted)' }}>
            Please read these Terms carefully before using the PetFlow platform. By accessing or using
            PetFlow, you agree to be bound by these Terms.
          </div>
        </div>

        <section className="space-y-8 text-sm leading-relaxed text-gray-700">

          {/* 1. Definitions */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Definitions</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>"PetFlow"</strong> refers to the pet spa management SaaS platform and its operator.</li>
              <li><strong>"Business" / "Tenant"</strong> refers to the pet spa or grooming business that subscribes to and uses PetFlow.</li>
              <li><strong>"End Client"</strong> refers to the pet owners whose data is managed through the platform by the Business.</li>
              <li><strong>"User"</strong> refers to any staff member, administrator, or representative of the Business who accesses the platform.</li>
              <li><strong>"Services"</strong> refers to all features and functionality provided by PetFlow, including CRM, scheduling, AI assistant (Petro), marketing, and billing tools.</li>
            </ul>
          </div>

          {/* 2. Acceptance */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Acceptance of Terms</h2>
            <p>
              By registering for, accessing, or using PetFlow, you confirm that you have read, understood, and agree to
              be legally bound by these Terms of Service and our{' '}
              <Link href="/privacy-policy" className="underline" style={{ color: 'var(--sage-dark)' }}>
                Privacy Policy
              </Link>
              . If you are using PetFlow on behalf of a Business, you represent that you have the authority to bind
              that Business to these Terms.
            </p>
          </div>

          {/* 3. Services */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Description of Services</h2>
            <p className="mb-2">PetFlow provides a cloud-based management platform that includes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Client and pet CRM</li>
              <li>Appointment scheduling and management</li>
              <li>Boarding reservation management</li>
              <li>AI-powered WhatsApp & Instagram assistant (Petro)</li>
              <li>Inventory and retail management</li>
              <li>Marketing campaign tools</li>
              <li>Invoicing and payment processing</li>
              <li>Analytics and reporting</li>
            </ul>
            <p className="mt-2">
              We reserve the right to modify, suspend, or discontinue any feature of the Services at any time with
              reasonable notice.
            </p>
          </div>

          {/* 4. Account */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Account Registration &amp; Security</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You must notify PetFlow immediately of any unauthorized use of your account.</li>
              <li>PetFlow is not liable for any loss or damage arising from unauthorized account access due to your failure to secure your credentials.</li>
            </ul>
          </div>

          {/* 5. Acceptable Use */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Acceptable Use Policy</h2>
            <p className="mb-2">You agree <strong>not</strong> to use PetFlow to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Violate any applicable law, regulation, or third-party rights</li>
              <li>Send unsolicited marketing messages (spam) to End Clients</li>
              <li>Process data of individuals who have not consented under applicable privacy laws</li>
              <li>Attempt to gain unauthorized access to PetFlow systems or other users' accounts</li>
              <li>Introduce malicious code, viruses, or disruptive software</li>
              <li>Resell or sublicense access to the platform without written permission</li>
              <li>Use the AI assistant (Petro) to generate harmful, misleading, or illegal content</li>
            </ul>
          </div>

          {/* 6. Data & Privacy */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Responsibilities</h2>
            <p className="mb-2">
              <strong>The Business is the Data Controller</strong> for all personal data of End Clients entered
              into PetFlow. PetFlow acts as a <strong>Data Processor</strong> on behalf of the Business.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The Business is responsible for obtaining valid consent from End Clients before entering their data into the platform.</li>
              <li>The Business must respond to data subject requests (access, erasure, portability) within legally required timeframes.</li>
              <li>PetFlow provides tools (DSAR management, anonymization) to assist the Business in fulfilling these obligations.</li>
              <li>By using PetFlow, the Business agrees to our Data Processing terms set out in the{' '}
                <Link href="/privacy-policy" className="underline" style={{ color: 'var(--sage-dark)' }}>
                  Privacy Policy
                </Link>.
              </li>
            </ul>
          </div>

          {/* 7. Payment */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Fees &amp; Payment</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Subscription fees are billed in advance on a monthly or annual basis.</li>
              <li>All fees are non-refundable unless otherwise stated or required by applicable law.</li>
              <li>PetFlow reserves the right to change pricing with 30 days' notice to the Business.</li>
              <li>Failure to pay may result in suspension or termination of the Business's account.</li>
              <li>Payment is processed through our payment partners (Razorpay / Stripe). PetFlow does not store card data.</li>
            </ul>
          </div>

          {/* 8. Intellectual Property */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Intellectual Property</h2>
            <p>
              PetFlow and all its content, features, and functionality (including the Petro AI, source code,
              design, logos, and branding) are the exclusive property of PetFlow and are protected by
              intellectual property laws. Your subscription grants you a limited, non-exclusive,
              non-transferable license to use the Services for your internal business purposes only.
            </p>
          </div>

          {/* 9. Third Parties */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Third-Party Integrations</h2>
            <p>
              PetFlow integrates with third-party services including OpenAI, Twilio, WhatsApp, Razorpay, Stripe,
              Amazon S3, and Firebase. Your use of these integrations is subject to the respective third-party
              terms of service. PetFlow is not responsible for the availability, accuracy, or privacy practices
              of these third parties.
            </p>
          </div>

          {/* 10. Limitation of Liability */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Limitation of Liability</h2>
            <p className="mb-2">
              To the maximum extent permitted by law, PetFlow shall not be liable for:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Service interruptions or downtime beyond our reasonable control</li>
              <li>Actions taken by third-party integrations</li>
              <li>Unauthorized access to your account due to your failure to secure credentials</li>
            </ul>
            <p className="mt-2">
              Our total aggregate liability shall not exceed the fees paid by you to PetFlow in the three (3)
              months preceding the claim.
            </p>
          </div>

          {/* 11. Termination */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Termination</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You may cancel your subscription at any time through your account settings or by contacting support.</li>
              <li>PetFlow may suspend or terminate your account for violations of these Terms, non-payment, or for legal compliance reasons.</li>
              <li>Upon termination, you may request an export of your data within 30 days. After that, data will be deleted in accordance with our retention policy.</li>
            </ul>
          </div>

          {/* 12. Governing Law */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Governing Law &amp; Disputes</h2>
            <p>
              These Terms are governed by the laws of India. Any disputes shall be resolved through binding
              arbitration in accordance with Indian arbitration rules, unless prohibited by local law in your
              jurisdiction.
            </p>
          </div>

          {/* 13. Changes */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Changes to These Terms</h2>
            <p>
              We may update these Terms periodically. We will notify you of significant changes via email or
              in-app notification at least 14 days before the changes take effect. Continued use of PetFlow
              after the effective date constitutes acceptance of the revised Terms.
            </p>
          </div>

          {/* 14. Contact */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">14. Contact Us</h2>
            <p>
              For any questions about these Terms, please contact PetFlow support. For privacy-specific
              requests, please visit our{' '}
              <Link href="/delete-my-data" className="underline" style={{ color: 'var(--sage-dark)' }}>
                Data Rights page
              </Link>
              .
            </p>
          </div>

        </section>

        {/* Footer links */}
        <div
          className="mt-10 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs"
          style={{ color: 'var(--sage-dark)' }}
        >
          <Link href="/privacy-policy" className="underline hover:opacity-80">Privacy Policy</Link>
          <Link href="/delete-my-data" className="underline hover:opacity-80">Your Data Rights</Link>
          <Link href="/login" className="underline hover:opacity-80">← Back to Login</Link>
        </div>
      </div>
    </div>
  )
}
