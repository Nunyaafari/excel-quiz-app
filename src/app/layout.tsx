import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import '../styles/globals.css'
import { AuthProvider } from '@/lib/auth'
import ChatWidget from '@/components/ChatWidget'
import SiteFooter from '@/components/SiteFooter'
import { buildMetadata, buildOrganizationJsonLd, buildWebsiteJsonLd, siteConfig, primarySeoKeywords, longTailSeoKeywords } from '@/lib/seo'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.shortName}`,
  },
  applicationName: siteConfig.name,
  category: 'education',
  ...buildMetadata({
    title: siteConfig.name,
    description: siteConfig.description,
    path: '/',
    keywords: [...primarySeoKeywords, ...longTailSeoKeywords],
  }),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const organizationJsonLd = buildOrganizationJsonLd()
  const websiteJsonLd = buildWebsiteJsonLd()

  return (
    <html lang="en">
      <body className={ibmPlexSans.className}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  )
}
