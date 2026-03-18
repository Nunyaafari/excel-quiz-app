'use client'

import { useRouter } from 'next/navigation'

type TrainingProgram = {
  id: string
  title: string
  duration: string
  fee: string
  objectives: string[]
  outline: string[]
  description: string
}

const programs: TrainingProgram[] = [
  {
    id: 'program-remote',
    title: 'Microsoft Excel Foundation',
    duration: '6 hrs total',
    fee: 'GHS 900 per participant',
    objectives: [
      'Foundational understanding of Excel',
      'Create, format, and manipulate worksheets',
      'Use basic functions and formulas',
      'Apply Excel to common business tasks',
    ],
    outline: [
      'Introduction to Excel interface and workbooks',
      'Data entry, formatting, and alignment',
      'Functions vs formulas (SUM, AVERAGE, COUNT)',
      'Data management: sorting, filtering, duplicates',
      'Charts and graphs with formatting',
      'Printing, sharing, recap, and Q&A',
    ],
    description:
      'Designed for beginners who need a structured path to confident, accurate Excel work.',
  },
  {
    id: 'program-onsite',
    title: 'Intermediate Excel Training',
    duration: '6 hrs total',
    fee: 'GHS 1,500 per participant',
    objectives: [
      'Advance data analysis and reporting skills',
      'Use advanced formulas and lookups',
      'Improve data transformation workflows',
    ],
    outline: [
      'Hacks and techniques (Autofill, Find & Replace, Named Ranges, Paste Special)',
      'Advanced formulas (IF/AND/OR, VLOOKUP/HLOOKUP, SUMIF/AVERAGEIF)',
      'Text and date functions (CONCATENATE, TRIM, WEEKDAY, EDATE)',
      'Data consolidation, tables, subtotals, and grouping',
      'Advanced charting and PivotTables/PivotCharts',
      'Module conclusion and Q&A',
    ],
    description:
      'A practical module for analysts and coordinators who already use Excel regularly and need stronger automation skills.',
  },
  {
    id: 'program-offsite',
    title: 'Advanced Excel Training',
    duration: '6 hrs total',
    fee: 'GHS 1,500 per participant',
    objectives: [
      'Master advanced functions and modeling',
      'Build dashboards and analytical tools',
      'Automate workflows with macros and VBA',
    ],
    outline: [
      'Advanced formulas (ARRAY, INDEX/MATCH, financial functions, XLOOKUP)',
      'Advanced PivotTables, PivotCharts, and measures',
      'Data validation, advanced filtering, conditional formatting',
      'Advanced visualization (combo charts, waterfalls, sparklines)',
      'Data analysis tools (Goal Seek, Solver, Data Tables)',
      'Macros, VBA, Power Pivot, and workbook management',
    ],
    description:
      'For power users and analysts who need advanced modeling, automation, and visualization capabilities.',
  },
]

export default function TrainingProgramsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <div className="container mx-auto px-4">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] px-6 py-8 text-white shadow-xl md:px-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#5dd6cf]/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#8fb8ff]/20 blur-3xl" />
          <p className="text-xs uppercase tracking-[0.22em] text-[#c8e8ff]">Training Programs</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Excel Capability Building</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d6ebff]">
            Choose a delivery model that fits your team. Each program pairs skills assessment with targeted training.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#d6ebff]">
            <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">
              Delivery: Online
            </span>
            <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">
              On site
            </span>
            <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">
              Offsite
            </span>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {programs.map((program) => (
            <article key={program.id} className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full border border-[#dbe5f1] bg-[#f9fbff] px-3 py-1 text-xs font-semibold text-[#1e3757]">
                  {program.duration}
                </span>
                <span className="text-xs font-semibold text-[#1e3757]">{program.fee}</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-[#142842]">{program.title}</h2>
              <p className="mt-2 text-sm text-[#5a6f8a]">{program.description}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#5f7491]">Objectives</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#1e3757]">
                {program.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#5f7491]">Outline</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#5a6f8a]">
                {program.outline.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <button
                onClick={() => router.push('/quiz/results')}
                className="btn-secondary mt-5 w-full"
              >
                Back to Results
              </button>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-[#142842]">Delivery Options</h2>
          <p className="mt-2 text-sm text-[#5a6f8a]">
            Choose the schedule that best fits your team:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#1e3757]">
            <li>6 hrs (full-day session) per module</li>
            <li>3 hrs sessions for 2 days per module</li>
            <li>2 hrs sessions for 3 days per module</li>
          </ul>
          <p className="mt-4 text-xs text-[#5a6f8a]">
            Participants receive training files and assessments. Please bring a laptop with Microsoft Excel installed.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-[#142842]">Facilitator</h2>
          <p className="mt-2 text-sm text-[#5a6f8a]">
            Nunya Afari is a consultant with 17 years of experience in finance and technology, with an MBA from Coventry
            University. He has trained thousands of business professionals across banking, insurance, oil & gas,
            manufacturing, and mining.
          </p>
          <p className="mt-3 text-sm text-[#1e3757]">
            Recent clients: Republic Bank, Prime Insurance, Sandvik Mines, VRA, Forms Capital, Ministry of Local
            Government, Jayset Consultancy, FMGL, Jelcem Construction.
          </p>
          <p className="mt-3 text-sm font-semibold text-[#1e3757]">Lead Consultant: Kwame Nunya Afari - +233 558358446</p>
        </section>

        <section className="mt-6 rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-[#142842]">Request Training or Assessment</h2>
          <p className="mt-2 text-sm text-[#5a6f8a]">
            Share your details and we will follow up with the right training or internal assessment plan.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/training/request?type=training')}
              className="btn-primary w-full sm:w-auto"
            >
              Request Training
            </button>
            <button
              onClick={() => router.push('/training/request?type=assessment')}
              className="btn-secondary w-full sm:w-auto"
            >
              Request Internal Assessment
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
