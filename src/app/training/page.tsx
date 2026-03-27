'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TrainingProgram = {
  id: string
  title: string
  duration: string
  objectives: string[]
  outline: string[]
  description: string
}

type TrainingGalleryItem = {
  id: string
  title: string
  caption: string
  stat: string
  imageSrc: string
}

type TrainingTestimonial = {
  id: string
  name: string
  role: string
  organization: string
  quote: string
  outcome: string
}

const programs: TrainingProgram[] = [
  {
    id: 'program-remote',
    title: 'Microsoft Excel Foundation',
    duration: '6 hrs total',
    objectives: [
      'Provide participants with a foundational understanding of Excel.',
      'Teach participants how to create, format, and manipulate Excel worksheets.',
      'Introduce basic Excel functions and formulas.',
      'Enable participants to confidently use Excel for common tasks.',
    ],
    outline: [
      'Module 1: Introduction to Excel - Overview of Excel, interface, navigating worksheets, creating and opening workbooks.',
      'Module 2: Data Entry and Formatting - Entering and editing data, formatting fonts and borders, alignment, wrapping, fill colors, and shading.',
      'Module 3: Cell Functions and Formulas - Functions vs formulas, SUM, AVERAGE, COUNT, basic arithmetic formulas, relative vs absolute references.',
      'Module 4: Data Management - Sorting, filtering, removing duplicates, and data validation rules.',
      'Module 5: Charts and Graphs - Creating charts, formatting and customizing charts, adding data labels, inserting charts into worksheets.',
      'Module 6: Printing and Sharing - Preparing worksheets for printing, page setup, print preview, sharing, and exporting files.',
      'Module 7: Recap and Q&A - Review of key concepts, clarification, and assessment.',
    ],
    description:
      'Designed for beginners who need a structured path to confident, accurate Excel work.',
  },
  {
    id: 'program-onsite',
    title: 'Intermediate Excel Training',
    duration: '6 hrs total',
    objectives: [
      'Build on foundational Excel skills with stronger data analysis capability.',
      'Develop confidence with advanced formulas, automation, and reporting.',
      'Handle more complex spreadsheet and consolidation tasks efficiently.',
      'Use Excel features that support faster analysis and clearer presentation.',
    ],
    outline: [
      'Session 1: Excel Hacks and Techniques - Data selection strategies, Autofill and Flash Fill, Find & Replace, Named Ranges, Paste Special.',
      'Session 2: Exploring Advanced Formulas and Functions - IF, AND, OR, VLOOKUP, HLOOKUP, ROUND, MOD, text functions, SUMIF, AVERAGEIF, COUNTIF, date functions, MEDIAN, RANK, LARGE.',
      'Session 3: Data Consolidation and Data Tables - Subtotals and grouping, Freeze Panes, consolidating data from multiple worksheets, creating Excel tables.',
      'Session 4: Advanced Charting and Graphical Data Presentation - Advanced chart types, combining charts, dynamic titles and labels, chart elements.',
      'Session 6: PivotTables and PivotCharts - Introduction to PivotTables, creating PivotTables from large datasets, formatting PivotTables, creating PivotCharts.',
      'Session 7: Module Conclusion and Q&A - Recap of key learnings, participant questions, clarification, and assessment.',
    ],
    description:
      'A practical module for analysts and coordinators who already use Excel regularly and need stronger automation skills.',
  },
  {
    id: 'program-offsite',
    title: 'Advanced Excel Training',
    duration: '6 hrs total',
    objectives: [
      'Become proficient in advanced techniques for data analysis and automation.',
      'Strengthen complex modeling, advanced visualization, and business analysis skills.',
      'Use advanced Excel tools for decision support and interactive reporting.',
      'Introduce automation with Macros, VBA, and Power Pivot.',
    ],
    outline: [
      'Session 1: Advanced Formulas and Functions - Array formulas, INDEX and MATCH, financial functions, ISERROR, IFERROR, XLOOKUP, VSTACK, CHOOSE, SEQUENCE, RAND, RANDBETWEEN, AGGREGATE, TRANSPOSE.',
      'Session 2: Advanced PivotTables and PivotCharts - Calculated fields and items, custom measures, interactive dashboards with PivotCharts.',
      'Session 3: Data Validation and Advanced Filtering Mastery - Tailored validation rules, dropdown lists, advanced sorting, advanced filtering.',
      'Session 4: Conditional Formatting - Applying conditional formatting rules and creating custom formatting logic.',
      'Session 5: Advanced Data Visualization - Advanced chart customization, combo charts, waterfall charts, sparklines, and data bars.',
      'Session 6: Advanced Data Analysis Techniques - Scenario Manager, Goal Seek, Solver, Data Tables, VAR, STDEV.P.',
      'Session 6: Automation with Macros and VBA - Introduction to Macros, recording and editing Macros.',
      'Session 6: Power Pivot - Introduction to Power Pivot and creating relationships between tables.',
      'Session 7: Advanced Workbook Management and Collaboration - Excel Online collaboration and protecting workbooks with advanced security settings.',
      'Session 8: Module Conclusion and Q&A - Recap, participant clarification, and assessment.',
    ],
    description:
      'For power users and analysts who need advanced modeling, automation, and visualization capabilities.',
  },
]

const galleryItems: TrainingGalleryItem[] = [
  {
    id: 'gallery-session-1',
    title: 'Hands-On Excel Bootcamp',
    caption: 'Participants work through guided spreadsheets, live demos, and practical reporting drills.',
    stat: 'Live labs + coached practice',
    imageSrc: '/training/session-1.jpg',
  },
  {
    id: 'gallery-session-2',
    title: 'Reporting and Dashboard Practice',
    caption: 'Teams build charts, pivots, and decision-ready reports from realistic business cases.',
    stat: 'Reporting workflows',
    imageSrc: '/training/session-2.jpg',
  },
  {
    id: 'gallery-session-3',
    title: 'Facilitated Group Coaching',
    caption: 'Small-group coaching keeps every learner engaged while strengthening confidence and accuracy.',
    stat: 'Interactive delivery',
    imageSrc: '/training/session-3.jpg',
  },
  {
    id: 'gallery-session-4',
    title: 'Corporate Cohort Sessions',
    caption: 'Cross-functional teams learn shared standards for analysis, formatting, and spreadsheet review.',
    stat: 'Corporate cohorts',
    imageSrc: '/training/session-4.jpg',
  },
  {
    id: 'gallery-session-5',
    title: 'Instructor-Led Walkthroughs',
    caption: 'Facilitators break down formulas, workflows, and shortcuts in a clear, applied way.',
    stat: 'Step-by-step instruction',
    imageSrc: '/training/session-5.jpg',
  },
  {
    id: 'gallery-session-6',
    title: 'Applied Workplace Exercises',
    caption: 'Learners practice with realistic tasks that mirror finance, admin, and operations reporting work.',
    stat: 'Workplace scenarios',
    imageSrc: '/training/session-6.jpg',
  },
  {
    id: 'gallery-session-7',
    title: 'Team-Based Practice and Review',
    caption: 'Sessions close with hands-on practice, discussion, and takeaways teams can use immediately.',
    stat: 'Practice + review',
    imageSrc: '/training/session-7.jpg',
  },
]

const testimonials: TrainingTestimonial[] = [
  {
    id: 'testimonial-ops',
    name: 'Ama Boateng',
    role: 'Operations Coordinator',
    organization: 'Regional Services Team',
    quote:
      'The training was practical from the first hour. Our team immediately cleaned up reporting files and reduced manual rework.',
    outcome: 'Outcome: faster weekly reporting and better spreadsheet consistency across the team.',
  },
  {
    id: 'testimonial-finance',
    name: 'Michael Asiedu',
    role: 'Finance Analyst',
    organization: 'Corporate Finance Unit',
    quote:
      'What stood out was the balance between foundations and real business use cases. The pivot and lookup modules saved us hours each month.',
    outcome: 'Outcome: stronger analysis workflows and better confidence presenting numbers to leadership.',
  },
  {
    id: 'testimonial-hr',
    name: 'Efua Mensah',
    role: 'HR Business Partner',
    organization: 'People & Culture Team',
    quote:
      'The sessions were easy to follow, even for colleagues who were initially nervous about Excel. Everyone left with usable templates and next steps.',
    outcome: 'Outcome: smoother staff reporting and clearer onboarding support for new team members.',
  },
]

export default function TrainingProgramsPage() {
  const router = useRouter()
  const [expandedProgramIds, setExpandedProgramIds] = useState<string[]>([])
  const slidingGalleryItems = [...galleryItems, ...galleryItems]

  const toggleProgramOutline = (programId: string) => {
    setExpandedProgramIds((currentIds) =>
      currentIds.includes(programId) ? currentIds.filter((id) => id !== programId) : [...currentIds, programId]
    )
  }

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
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded-xl border border-white/35 bg-white px-4 py-2 text-sm font-semibold text-[#12314d] transition hover:bg-[#eef6ff]"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => router.push('/quiz/results')}
              className="rounded-xl border border-white/35 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Back to Results
            </button>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {programs.map((program) => (
            <article key={program.id} className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
              {(() => {
                const isExpanded = expandedProgramIds.includes(program.id)
                const previewOutline = program.outline.slice(0, 3)

                return (
                  <>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full border border-[#dbe5f1] bg-[#f9fbff] px-3 py-1 text-xs font-semibold text-[#1e3757]">
                  {program.duration}
                </span>
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
                {(isExpanded ? program.outline : previewOutline).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {program.outline.length > previewOutline.length && (
                <button
                  type="button"
                  onClick={() => toggleProgramOutline(program.id)}
                  className="mt-3 inline-flex items-center text-sm font-semibold text-[#16506e] hover:text-[#0f2744]"
                >
                  {isExpanded ? 'Collapse full outline' : 'View full outline'}
                </button>
              )}
              <button
                onClick={() => router.push('/quiz/results')}
                className="btn-secondary mt-5 w-full"
              >
                Back to Results
              </button>
                  </>
                )
              })()}
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Training Gallery</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#142842] md:text-3xl">How The Learning Experience Feels</h2>
            <p className="mt-2 text-sm text-[#5a6f8a]">
              Every session is built around practical spreadsheets, guided exercises, and job-relevant reporting tasks.
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-[#dbe5f1] bg-[#f6f9fc] p-3 md:p-4">
            <div className="training-gallery-track flex w-max gap-4">
              {slidingGalleryItems.map((item, index) => (
                <article
                  key={`${item.id}-${index}`}
                  className="w-[82vw] max-w-[420px] shrink-0 overflow-hidden rounded-2xl border border-[#d9e3ef] bg-white shadow-sm md:w-[calc(50vw-4rem)] lg:w-[calc(50vw-8rem)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#dce8f4]">
                    <img
                      src={item.imageSrc}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0f2744]/70 via-[#0f2744]/10 to-transparent" />
                    <p className="absolute left-4 top-4 inline-flex rounded-full border border-white/30 bg-[#0f2744]/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                      {item.stat}
                    </p>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-[#142842]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5a6f8a]">{item.caption}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Testimonials</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#142842] md:text-3xl">What Teams Say After Training</h2>
            <p className="mt-2 text-sm text-[#5a6f8a]">
              Feedback consistently highlights practical delivery, confidence gains, and immediate workplace impact.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <article key={testimonial.id} className="rounded-2xl border border-[#dbe5f1] bg-[#f9fbff] p-5 shadow-sm">
                <p className="text-3xl leading-none text-[#1f6f6d]">“</p>
                <p className="mt-3 text-sm leading-relaxed text-[#304b67]">{testimonial.quote}</p>
                <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#1e3757] shadow-sm">
                  {testimonial.outcome}
                </p>
                <div className="mt-5 border-t border-[#d9e3ef] pt-4">
                  <p className="font-semibold text-[#142842]">{testimonial.name}</p>
                  <p className="text-sm text-[#5a6f8a]">
                    {testimonial.role}, {testimonial.organization}
                  </p>
                </div>
              </article>
            ))}
          </div>
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

        <section className="mt-6 rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
            <div>
              <div className="overflow-hidden rounded-2xl border border-[#dbe5f1] bg-[#f7faff] shadow-sm">
                <img
                  src="/training/facilitator-portrait.jpeg"
                  alt="Kwame Nunya Afari, Excel trainer and facilitator"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Lead Facilitator</p>
                <h3 className="mt-2 text-xl font-semibold text-[#142842]">Kwame Nunya Afari</h3>
                <p className="mt-1 text-sm font-medium text-[#1e3757]">
                  Corporate Excel Trainer | Data Productivity Specialist
                </p>
                <p className="mt-3 text-sm text-[#5a6f8a]">
                  Trained 2,000+ managers and professionals across Ghanaian corporate teams.
                </p>
                <p className="mt-3 text-sm font-semibold text-[#1e3757]">Contact: +233 558358446</p>
                <a
                  href="https://www.linkedin.com/in/nunyaafari/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center rounded-full border border-[#bcd0e4] bg-white px-4 py-2 text-sm font-medium text-[#1e3757] transition hover:border-[#1f6f6d] hover:text-[#1f6f6d]"
                >
                  View LinkedIn Profile
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">About the Facilitator</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#142842] md:text-3xl">
                Practical Excel training shaped by real finance and reporting work
              </h2>

              <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#5a6f8a]">
                <p>
                  Over two decades ago, while working in the finance department of one of Ghana&apos;s leading banks,
                  I discovered a simple yet powerful tool in Microsoft Excel, Subtotal. What seemed like a small
                  discovery at the time dramatically reduced the hours spent on routine financial analysis and
                  reporting. That moment sparked a deep curiosity about Excel and its ability to transform the way
                  professionals work with data.
                </p>
                <p>
                  Since then, I have committed myself to mastering practical Excel techniques that improve
                  productivity, simplify analysis, and support better decision-making. What began as a personal
                  learning journey has evolved into a passion for teaching others how to work smarter with data.
                </p>
                <p>
                  Through this passion, I have trained over 2,000 managers and professionals across multiple
                  industries in Ghana, including banking, insurance, oil and gas, energy, and construction. My
                  training focuses on practical, real-world applications that professionals can immediately apply in
                  their daily work.
                </p>
                <p>
                  I firmly believe that knowledge grows when it is shared. Every training session is not just an
                  opportunity to teach, but also a chance to learn, connect, and empower professionals to unlock the
                  full potential of tools they use every day.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#5f7491]">Experience</p>
                  <p className="mt-2 text-lg font-semibold text-[#142842]">20+ Years</p>
                </div>
                <div className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#5f7491]">Professionals Trained</p>
                  <p className="mt-2 text-lg font-semibold text-[#142842]">2,000+</p>
                </div>
                <div className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#5f7491]">Industry Reach</p>
                  <p className="mt-2 text-lg font-semibold text-[#142842]">5+ Sectors</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#dbe5f1] bg-[#f7fbff] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Recent Client Exposure</p>
                <p className="mt-2 text-sm leading-relaxed text-[#1e3757]">
                  Republic Bank, Prime Insurance, Sandvik Mines, VRA, Forms Capital, Ministry of Local Government,
                  Jayset Consultancy, FMGL, and Jelcem Construction.
                </p>
              </div>
            </div>
          </div>
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

      <style jsx>{`
        .training-gallery-track {
          animation: training-gallery-scroll 38s linear infinite;
        }

        .training-gallery-track:hover {
          animation-play-state: paused;
        }

        @keyframes training-gallery-scroll {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
