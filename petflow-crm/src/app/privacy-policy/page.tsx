import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — PetFlow',
  description: 'How PetFlow collects, uses, and protects your personal data. Compliant with DPDP Act 2023 (India), PDPL (UAE), and CCPA (USA).',
}

export default function PrivacyPolicyPage() {
  const lastUpdated = 'July 2026'
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>

        <section className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Who We Are</h2>
            <p>
              PetFlow is a pet spa management platform operated by your local pet spa (the <strong>"Business"</strong>).
              The Business is the Data Controller for the personal data you share with them through PetFlow.
              PetFlow (the platform provider) acts as a Data Processor on behalf of the Business.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. What Data We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Identity data:</strong> Your name</li>
              <li><strong>Contact data:</strong> Phone number (WhatsApp), email address, postal address</li>
              <li><strong>Pet data:</strong> Pet name, species, breed, weight, temperament notes, medical alerts, vaccination records</li>
              <li><strong>Transaction data:</strong> Appointment history, invoices, payment records</li>
              <li><strong>Communication data:</strong> WhatsApp chat history with our AI assistant</li>
              <li><strong>Technical data:</strong> IP address (for security), browser type (for the web dashboard)</li>
              <li><strong>Consent data:</strong> Records of your consent and marketing preferences</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Why We Collect Your Data (Legal Basis)</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-3 py-2 text-left">Purpose</th>
                  <th className="border border-gray-200 px-3 py-2 text-left">Legal Basis</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Booking & managing appointments', 'Consent (DPDP S.4) / Contract performance'],
                  ['Sending appointment reminders', 'Legitimate interest / Consent'],
                  ['Managing pet health records', 'Consent'],
                  ['Processing payments', 'Contract performance / Legal obligation'],
                  ['Sending marketing promotions', 'Explicit marketing consent'],
                  ['Fraud prevention & security', 'Legitimate interest / Legal obligation'],
                  ['Legal compliance & record-keeping', 'Legal obligation'],
                ].map(([purpose, basis], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-3 py-2">{purpose}</td>
                    <td className="border border-gray-200 px-3 py-2">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Third Parties We Share Data With</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>OpenAI</strong> — AI assistant powering our WhatsApp chatbot. Your conversation messages are processed by OpenAI. See <a href="https://openai.com/policies/privacy-policy" className="text-blue-600 underline" target="_blank">OpenAI Privacy Policy</a>.</li>
              <li><strong>Twilio / WhatsApp</strong> — For sending and receiving WhatsApp messages.</li>
              <li><strong>Razorpay / Stripe</strong> — For processing payments. Payment card data is never stored on our servers.</li>
              <li><strong>Amazon S3</strong> — For storing pet photos and media files.</li>
              <li><strong>Firebase (Google)</strong> — For authentication services.</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal data to any third party.{' '}
              <a href="/sub-processors" className="underline" style={{ color: 'var(--sage-dark)' }}>
                View our full sub-processor list →
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Chat messages:</strong> Automatically deleted after 90 days from your last conversation.</li>
              <li><strong>Appointment records:</strong> Retained for 3 years for service history.</li>
              <li><strong>Financial records (invoices):</strong> Retained for 7 years as required by law.</li>
              <li><strong>Marketing campaign logs:</strong> Anonymized after 12 months.</li>
              <li><strong>Consent records:</strong> Retained indefinitely as proof of lawful processing.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Your Rights</h2>
            <p className="mb-3">Depending on your country, you have the following rights over your data:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Right to Access</strong> — Request a copy of all data we hold about you.</li>
              <li><strong>Right to Rectification</strong> — Ask us to correct inaccurate information.</li>
              <li><strong>Right to Erasure</strong> — Ask us to delete your personal data ("right to be forgotten").</li>
              <li><strong>Right to Data Portability</strong> — Receive your data in a machine-readable format.</li>
              <li><strong>Right to Restrict Processing</strong> — Ask us to pause processing your data.</li>
              <li><strong>Right to Object</strong> — Object to marketing communications at any time.</li>
            </ul>
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="font-medium text-blue-900 mb-1">How to exercise your rights:</p>
              <ul className="text-blue-800 space-y-1">
                <li>• WhatsApp: Reply <strong>MY DATA</strong> to any of our messages</li>
                <li>• Marketing opt-out: Reply <strong>STOP</strong> to any marketing message</li>
                <li>• Contact the spa directly during business hours</li>
              </ul>
              <p className="mt-2 text-xs text-blue-700">
                We will respond within 7 days (India / DPDP Act), 30 days (UAE / PDPL), or 45 days (USA / CCPA).
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Security</h2>
            <p>
              We use AES-256-GCM encryption for sensitive credentials, HTTPS for all data transmission,
              bcrypt hashing for passwords, and role-based access controls. Payment data is encrypted
              at rest and processed only through PCI-compliant providers (Razorpay / Stripe).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Cookies</h2>
            <p>
              Our web dashboard uses cookies for authentication (session cookies) and security.
              We do not use tracking or advertising cookies without your explicit consent.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Applicable Laws</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>🇮🇳 <strong>India:</strong> Digital Personal Data Protection Act, 2023 (DPDP Act)</li>
              <li>🇦🇪 <strong>UAE:</strong> Federal Decree-Law No. 45 of 2021 on Personal Data Protection (PDPL)</li>
              <li>🇺🇸 <strong>USA:</strong> California Consumer Privacy Act (CCPA / CPRA)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of significant changes
              via WhatsApp or email. Continued use of our services after the effective date constitutes
              acceptance of the updated policy.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Contact</h2>
            <p>
              For any privacy-related queries, contact your local pet spa directly.
              For platform-level issues, contact PetFlow support.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
