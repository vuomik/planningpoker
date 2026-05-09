import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Planning Poker',
  description: 'Fast, realtime, peer-to-peer planning poker.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
