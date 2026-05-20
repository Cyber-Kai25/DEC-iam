import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { IdentityProvider } from '@/lib/context/identity-context'
import { RoleProvider } from '@/lib/context/role-context'
import { Toaster } from 'sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Decentralized Identity Management | DID Control',
  description: 'Create, manage, and verify digital identities with blockchain-backed decentralized identifiers (DIDs). Implement zero-knowledge proofs and verifiable credentials.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/fav-icon.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/fav-icon.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/fav-icon.png',
        type: 'image/svg+xml',
      },
    ],
    apple: '/fav-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <RoleProvider>
          <IdentityProvider>
            {children}
            <Toaster />
          </IdentityProvider>
        </RoleProvider>
        <Analytics />
      </body>
    </html>
  )
}
