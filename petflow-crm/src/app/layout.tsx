import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'
import AppLayout from '@/components/AppLayout'
import CookieConsent from '@/components/CookieConsent'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantFromHost } from '@/lib/tenant-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'PetFlow CRM — Pet Spa Management',
  description: 'Professional CRM for managing pet spa clients and their beloved pets.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  let settings = null

  if (session?.user && (session.user as any).tenantId) {
    settings = await prisma.settings.findFirst({
      where: { tenantId: (session.user as any).tenantId }
    })
  } else {
    const tenant = await getTenantFromHost()
    settings = tenant?.settings?.[0] || null
  }

  const primary = settings?.primary_color || '#89A894'
  const secondary = settings?.secondary_color || '#6d8f7a'
  const accent = settings?.accent_color || '#e8f0eb'

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          html:root {
            --sage: ${primary};
            --sage-dark: ${secondary};
            --sage-muted: ${accent};
            --sage-light: ${primary}80;
          }
        `}} />
      </head>
      <body suppressHydrationWarning={true}>
        <Providers>
          <AppLayout settings={settings as any}>{children}</AppLayout>
          <CookieConsent />
          <div className="fixed bottom-2 right-2 text-[10px] text-gray-300 pointer-events-none z-[9999]">
            v1.0.2
          </div>
        </Providers>
      </body>
    </html>
  )
}


