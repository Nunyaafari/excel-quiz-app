import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMetadata, longTailSeoKeywords } from '@/lib/seo'
import { buildSiteResourceDownloadPath, freeExcelResources } from '@/lib/site-resources'

export const metadata: Metadata = buildMetadata({
  title: 'Free Excel Resources Ghana',
  description:
    'Download free ATI Excel resources including a cheat sheet PDF and practical workbook templates for training and workplace use.',
  path: '/resources',
  keywords: [...longTailSeoKeywords, 'excel templates ghana', 'free excel cheat sheet pdf', 'budget template excel'],
})

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] px-6 py-8 text-white shadow-xl md:px-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#5dd6cf]/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#8fb8ff]/20 blur-3xl" />
            <p className="text-xs uppercase tracking-[0.22em] text-[#c8e8ff]">Free Resources</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">ATI Excel Downloads</h1>
            <p className="mt-3 max-w-3xl text-sm text-[#d6ebff] md:text-base">
              Practical free downloads for learners, job seekers, and teams building stronger Excel habits.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/training" className="btn-hero-secondary w-full sm:w-auto">
                View Training Programs
              </Link>
              <Link href="/blog" className="btn-hero-secondary w-full sm:w-auto">
                Explore Excel Blog
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {freeExcelResources.map((resource) => (
              <article key={resource.id} className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
                <p className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f7fbff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1e3757]">
                  {resource.typeLabel}
                </p>
                <h2 className="mt-4 text-2xl font-semibold text-[#142842]">{resource.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5a6f8a]">{resource.description}</p>
                <a
                  href={buildSiteResourceDownloadPath(resource.id)}
                  className="btn-primary mt-6 inline-flex w-full justify-center sm:w-auto"
                >
                  Download Resource
                </a>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-[#142842]">Need More Than the Free Pack?</h2>
            <p className="mt-2 text-sm text-[#5a6f8a]">
              Use the free downloads to get started, then move into ATI training modules for guided practice, coaching, and structured upskilling.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/training" className="btn-primary w-full sm:w-auto">
                Explore ATI Training
              </Link>
              <Link href="/quiz/survey" className="btn-secondary w-full sm:w-auto">
                Take the Quiz
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
