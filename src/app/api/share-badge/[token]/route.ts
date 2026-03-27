import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { decodeShareResultsToken } from '@/lib/share-results'
import { buildShareBadgeSvg } from '@/lib/share-badge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ShareBadgeRouteProps = {
  params: Promise<{
    token: string
  }>
}

export async function GET(request: Request, { params }: ShareBadgeRouteProps) {
  const { token } = await params
  const snapshot = decodeShareResultsToken(token)

  const svg = buildShareBadgeSvg({
    percentage: snapshot?.percentage ?? 0,
    performanceLabel: snapshot?.performanceLabel ?? 'Performance Summary',
    scoreLabel: `${snapshot?.correctAnswers ?? 0}/${snapshot?.totalQuestions ?? 0} correct`,
    detailLabel: snapshot?.profileLabel ?? 'Mixed Difficulty',
    dateLabel: snapshot?.completedLabel ?? 'Recently',
  })

  const iconPath = path.join(process.cwd(), 'public', 'excel-icon.png')
  const iconSource = await readFile(iconPath)
  const iconOverlay = await sharp(iconSource)
    .resize(126, 126, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const pngBuffer = await sharp(Buffer.from(svg))
    .composite([
      {
        input: iconOverlay,
        left: 970,
        top: 92,
      },
    ])
    .png()
    .toBuffer()
  const responseBody = new Uint8Array(pngBuffer)

  return new Response(responseBody, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      'Content-Disposition':
        new URL(request.url).searchParams.get('download') === '1'
          ? 'attachment; filename="excel-quiz-badge.png"'
          : 'inline; filename="excel-quiz-badge.png"',
    },
  })
}
