import type { Metadata } from 'next'
import { buildMetadata, longTailSeoKeywords } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Excel Training Ghana',
  description:
    'Explore Excel training programs, internal assessments, and practical learning paths for teams and professionals in Ghana.',
  path: '/training',
  keywords: longTailSeoKeywords,
})

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
