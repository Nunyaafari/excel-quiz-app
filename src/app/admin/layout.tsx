import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Admin Dashboard',
  description: 'Administrative content and analytics dashboard for Excel Mastery Quiz.',
  path: '/admin',
  noIndex: true,
})

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
