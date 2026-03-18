import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import '../styles/globals.css'
import { AuthProvider } from '@/lib/auth'
import ChatWidget from '@/components/ChatWidget'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Excel Mastery Quiz',
  description: 'Test your Excel knowledge and improve your skills',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={ibmPlexSans.className}>
        <AuthProvider>
          {children}
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  )
}
