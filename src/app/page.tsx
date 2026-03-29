'use client'

import StarRating from '@/components/StarRating'
import { useAuth } from '@/lib/auth'
import { freeExcelResourceHub } from '@/lib/site-resources'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FirebaseError } from 'firebase/app'
import { db } from '@/lib/firebase'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import type { Review } from '@/types'
import { addDoc, serverTimestamp } from 'firebase/firestore'

const capabilityCards = [
  {
    title: 'Scenario-Driven Questions',
    description: 'Each item mirrors real spreadsheet tasks used in reporting, analysis, and operations.',
  },
  {
    title: 'Actionable Review',
    description: 'Category-level scoring pinpoints where each candidate needs targeted improvement.',
  },
  {
    title: 'Role-Secured Imports',
    description: 'Question uploads are restricted to authorized admins with Firestore-enforced access.',
  },
  {
    title: 'Randomized Attempts',
    description: 'Question and answer order are shuffled per session to reduce memorized sequencing.',
  },
]

const processSteps = [
  'Open the survey and start the timed quiz immediately.',
  'Answer 20 questions in 4 blocks of 5 questions.',
  'See your summary score right away, then unlock the detailed report with email.',
  'Use category insights to guide focused retraining.',
]

function parseReviewRecord(raw: unknown, id: string): Review | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const data = raw as Partial<Review> & { createdAt?: unknown }
  const rating = typeof data.rating === 'number' ? data.rating : 0
  const comment = typeof data.comment === 'string' ? data.comment : ''
  const displayName = typeof data.displayName === 'string' ? data.displayName : 'Participant'

  if (!comment) {
    return null
  }

  const createdAt =
    data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt
      ? (data.createdAt as { toDate: () => Date }).toDate()
      : new Date()

  return {
    id,
    userId: typeof data.userId === 'string' ? data.userId : 'unknown',
    displayName,
    rating,
    comment,
    createdAt,
  }
}

export default function Home() {
  const { user, signIn, signOut } = useAuth()
  const router = useRouter()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [featuredReviews, setFeaturedReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)

  const handleStartQuiz = () => {
    router.push('/quiz/survey')
  }

  const adminIdentityLabel = user?.displayName || user?.email || 'Admin'
  const adminIdentityMark = adminIdentityLabel.trim().charAt(0).toUpperCase() || 'A'

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signIn()
      setIsAdminMenuOpen(false)
      router.push('/admin')
    } catch (error) {
      console.error('Sign in failed:', error)
      alert(getAuthErrorMessage(error))
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      setIsAdminMenuOpen(false)
    } catch (error) {
      console.error('Sign out failed:', error)
      alert('Sign out failed. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }

  const getAuthErrorMessage = (error: unknown) => {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/operation-not-allowed':
          return 'Google sign-in is not enabled in Firebase Authentication. Enable Google provider in Firebase Console.'
        case 'auth/popup-blocked':
          return 'Sign-in popup was blocked. Please allow popups and try again.'
        case 'auth/popup-closed-by-user':
          return 'Sign-in popup was closed before completion. Please try again.'
        case 'auth/unauthorized-domain':
          return 'This domain is not authorized for Firebase Auth. Add your current app domain to Firebase Authentication authorized domains.'
        default:
          return `Sign in failed: ${error.code}`
      }
    }

    return 'Sign in failed. Please try again.'
  }

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(3))
        const snapshot = await getDocs(reviewsQuery)
        const reviews = snapshot.docs
          .map((doc) => parseReviewRecord(doc.data(), doc.id))
          .filter((review): review is Review => review !== null)
        setFeaturedReviews(reviews)
      } catch (error) {
        console.error('Failed to load reviews:', error)
      } finally {
        setReviewsLoading(false)
      }
    }

    void fetchReviews()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const source = params.get('source')
    if (!source) {
      return
    }

    const track = async () => {
      try {
        await addDoc(collection(db, 'analyticsEvents'), {
          type: 'landing_visit',
          source,
          path: window.location.pathname,
          referrer: document.referrer || '',
          userAgent: navigator.userAgent || '',
          createdAt: serverTimestamp(),
        })
      } catch (error) {
        console.error('Failed to log landing visit:', error)
      }
    }

    void track()
  }, [])

  return (
    <div className="min-h-screen bg-[#eef2f6] text-[#152238]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d]">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-[#5dd6cf]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-[#8fb8ff]/20 blur-3xl" />

        <div className="container mx-auto px-4 pb-24 pt-8 md:pt-10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm font-semibold tracking-wide">Excel Competency Program</p>
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <p className="text-xs text-[#d3e6ff]">Corporate Assessment Platform</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAdminMenuOpen((current) => !current)}
                  aria-label={user ? 'Open admin account menu' : 'Open admin login menu'}
                  title={user ? `Admin account for ${adminIdentityLabel}` : 'Admin login menu'}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white shadow-sm transition hover:border-white/40 hover:bg-white/20"
                >
                  {user ? (
                    <span className="text-sm font-semibold">{adminIdentityMark}</span>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                      <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-3 0-9 1.5-9 4.5V21h18v-2.25c0-3-6-4.5-9-4.5Z" />
                    </svg>
                  )}
                </button>

                {isAdminMenuOpen && (
                  <div className="absolute right-0 top-14 z-20 w-56 rounded-2xl border border-white/20 bg-[#0f2744]/95 p-2 text-left text-white shadow-2xl backdrop-blur-md">
                    {user ? (
                      <>
                        <div className="border-b border-white/10 px-3 py-2">
                          <p className="text-sm font-semibold">{adminIdentityLabel}</p>
                          <p className="text-xs text-[#c8e8ff]">Admin access</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAdminMenuOpen(false)
                            router.push('/admin')
                          }}
                          className="mt-2 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                        >
                          Open Admin Dashboard
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSignOut()}
                          disabled={isSigningOut}
                          className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSigningOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSignIn()}
                        disabled={isSigningIn}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isSigningIn ? 'Signing in...' : 'Admin Login'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c5e6ff]">Readiness First</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
                Professional Excel Testing for Corporate Teams
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#d5ebff] md:text-base">
                Launch structured assessments, benchmark spreadsheet skills, and identify capability gaps before they affect reporting quality.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={handleStartQuiz}
                  className="btn-hero-primary w-full sm:w-auto"
                >
                  Start Assessment
                </button>
                <button
                  onClick={() => router.push('/training')}
                  className="btn-hero-secondary w-full sm:w-auto"
                >
                  View Training Programs
                </button>
                <button
                  onClick={() => router.push('/blog')}
                  className="btn-hero-secondary w-full sm:w-auto"
                >
                  Explore Excel Blog
                </button>
              </div>

              <div className="mt-3">
                <a
                  href={freeExcelResourceHub.href}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 sm:w-auto"
                >
                  {freeExcelResourceHub.label}
                </a>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-2xl font-bold">20</p>
                  <p className="text-xs text-[#d5ebff]">Questions Per Attempt</p>
                </article>
                <article className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-2xl font-bold">4</p>
                  <p className="text-xs text-[#d5ebff]">Core Skill Domains</p>
                </article>
                <article className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-2xl font-bold">RBAC</p>
                  <p className="text-xs text-[#d5ebff]">Admin-Secured Upload</p>
                </article>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/20 bg-white/90 p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4f6592]">Assessment Snapshot</p>
              <h2 className="mt-2 text-xl font-semibold text-[#1a2e49]">Program Structure</h2>
              <p className="mt-2 text-sm text-[#4f6483]">Participants complete 4 progressive blocks with randomized options on each question.</p>

              <div className="mt-4 space-y-3">
                {[
                  { label: 'Block 1', note: 'Questions 1-5 · Fundamentals' },
                  { label: 'Block 2', note: 'Questions 6-10 · Daily Workflow' },
                  { label: 'Block 3', note: 'Questions 11-15 · Analysis Skills' },
                  { label: 'Block 4', note: 'Questions 16-20 · Applied Judgment' },
                ].map((block) => (
                  <div key={block.label} className="rounded-lg border border-[#d7e0ef] bg-white p-3">
                    <p className="text-sm font-semibold text-[#1a2e49]">{block.label}</p>
                    <p className="text-xs text-[#5f7390]">{block.note}</p>
                  </div>
                ))}
              </div>

              <p className="mt-5 rounded-lg border border-[#d8e2f4] bg-[#f3f7ff] px-3 py-2 text-xs text-[#4d6489]">
                No sign-in is required to take the assessment. Admin access now lives in the top-right account icon.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <main className="-mt-16 pb-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-7">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {capabilityCards.map((card) => (
                  <article key={card.title} className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                    <h3 className="text-base font-semibold text-[#1a2e49]">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5a6f8a]">{card.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Execution Flow</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#142842]">How This Assessment Runs</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {processSteps.map((step, index) => (
                  <div key={step} className="rounded-lg border border-[#dbe5f1] bg-[#f8fbff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6780a2]">Step {index + 1}</p>
                    <p className="mt-1 text-sm font-medium text-[#2a4464]">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Participant Reviews</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#142842]">What Teams Are Saying</h2>
              <p className="mt-2 text-sm text-[#5a6f8a]">Recent feedback from quiz participants.</p>

              {reviewsLoading ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                      <div className="h-3 w-24 rounded bg-[#e7edf7]" />
                      <div className="mt-3 h-3 w-full rounded bg-[#e7edf7]" />
                      <div className="mt-2 h-3 w-5/6 rounded bg-[#e7edf7]" />
                    </div>
                  ))}
                </div>
              ) : featuredReviews.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {featuredReviews.map((review) => (
                    <article key={review.id} className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                      <p className="text-sm font-semibold text-[#1a2e49]">{review.displayName}</p>
                      <div className="mt-1">
                        <StarRating rating={review.rating} />
                      </div>
                      <p className="mt-3 text-sm text-[#5a6f8a]">{review.comment}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#5a6f8a]">No reviews yet. Be the first to leave feedback.</p>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
