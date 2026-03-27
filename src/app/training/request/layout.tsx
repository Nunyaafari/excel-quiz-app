import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Request Excel Training',
  description: 'Submit a request for Excel training or internal assessment.',
  path: '/training/request',
  noIndex: true,
})

export default function TrainingRequestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
