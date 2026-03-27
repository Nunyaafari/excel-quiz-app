import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#d9e3ef] bg-white/95">
      <div className="container mx-auto flex flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img src="/ati-logo.svg" alt="Animeight Training Institute logo" className="h-12 w-auto shrink-0" />
          <div className="text-sm text-[#4f6483]">
            <p className="font-semibold text-[#142842]">Powered by Animeight Training Institute</p>
            <p>Practical Excel learning, assessments, and upskilling support for teams and professionals.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/training" className="btn-secondary w-full sm:w-auto">
            View Training Programs
          </Link>
        </div>
      </div>
    </footer>
  )
}
