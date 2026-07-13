'use client'

import { SessionProvider } from "next-auth/react"
import dynamic from 'next/dynamic'

const Agentation = dynamic(
  () => import('agentation').then((mod) => mod.Agentation),
  { ssr: false }
)

export default function Providers({ children, session }: { children: React.ReactNode; session: any }) {
  return (
    <SessionProvider session={session}>
      {children}
      {process.env.NODE_ENV === 'development' && <Agentation />}
    </SessionProvider>
  )
}
