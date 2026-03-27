import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Excel Quiz Experience',
  description: 'Interactive Excel quiz flow and results experience.',
  path: '/quiz',
  noIndex: true,
})

export default function QuizLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
