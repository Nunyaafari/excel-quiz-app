import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buildMetadata } from '@/lib/seo'
import {
  buildShareResultsDescription,
  buildShareResultsImagePath,
  buildShareResultsPath,
  buildShareResultsTitle,
  decodeShareResultsToken,
} from '@/lib/share-results'

type ShareResultsPageProps = {
  params: Promise<{
    token: string
  }>
}

export async function generateMetadata({ params }: ShareResultsPageProps): Promise<Metadata> {
  const { token } = await params
  const snapshot = decodeShareResultsToken(token)

  if (!snapshot) {
    return buildMetadata({
      title: 'Shared Quiz Result Not Found',
      description: 'The shared Excel quiz result could not be loaded.',
      path: `/share/results/${token}`,
      noIndex: true,
    })
  }

  const title = buildShareResultsTitle(snapshot)
  const description = buildShareResultsDescription(snapshot)
  const path = buildShareResultsPath(snapshot)
  const imagePath = buildShareResultsImagePath(token)
  const imageUrl = new URL(imagePath, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').toString()

  return {
    ...buildMetadata({
      title,
      description,
      path,
      image: imagePath,
      noIndex: true,
    }),
    openGraph: {
      title,
      description,
      type: 'website',
      url: path,
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          alt: title,
          width: 1200,
          height: 630,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default async function SharedResultsPage({ params }: ShareResultsPageProps) {
  const { token } = await params
  const snapshot = decodeShareResultsToken(token)

  if (!snapshot) {
    notFound()
  }

  const scoreColor =
    snapshot.percentage >= 80 ? 'text-emerald-600' : snapshot.percentage >= 60 ? 'text-amber-600' : 'text-red-600'
  const badgeImagePath = buildShareResultsImagePath(token)
  const badgeAlt = `Excel quiz badge showing ${snapshot.percentage}% and ${snapshot.performanceLabel}`
  const resultDescription = buildShareResultsDescription(snapshot)

  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] p-6 text-white shadow-xl md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c8e8ff]">Shared Excel Quiz Result</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Excel Quiz Result</h1>
            <p className="mt-3 max-w-3xl text-sm text-[#d6ebff] md:text-base">
              {resultDescription}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="overflow-hidden rounded-[28px] bg-white/10 p-6 shadow-lg backdrop-blur-sm">
                <div className="rounded-[24px] border border-white/20 bg-white/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c8e8ff]">Excel Skills Badge</p>
                  <img
                    src={badgeImagePath}
                    alt={badgeAlt}
                    width={1200}
                    height={630}
                    className="mt-5 w-full rounded-[24px] border border-white/10 shadow-2xl"
                  />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[#d6ebff]">
                    <p>{snapshot.profileLabel}</p>
                    <p>Completed {snapshot.completedLabel}</p>
                    <p className={`font-semibold ${scoreColor}`}>{snapshot.performanceLabel}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
                <h2 className="text-2xl font-semibold text-white">Excel Quiz Result</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#d6ebff]">
                  This public card shows the exact performance snapshot that was shared from an Excel Mastery Quiz attempt.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white px-4 py-4 text-[#142842] shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-[#5f7491]">Performance</p>
                    <p className="mt-2 text-lg font-bold">{snapshot.performanceLabel}</p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-4 text-[#142842] shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-[#5f7491]">Correct</p>
                    <p className="mt-2 text-lg font-bold">
                      {snapshot.correctAnswers}/{snapshot.totalQuestions}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-4 text-[#142842] shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-[#5f7491]">Track</p>
                    <p className="mt-2 text-lg font-bold">{snapshot.profileLabel}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/quiz/survey" className="btn-hero-primary w-full sm:w-auto">
                    Take the Quiz
                  </Link>
                  <Link href="/training" className="btn-hero-secondary w-full sm:w-auto">
                    View Training Programs
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
