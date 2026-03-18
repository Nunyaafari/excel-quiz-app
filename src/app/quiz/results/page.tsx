'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { db } from '@/lib/firebase'
import { QuizAttempt, TrainingMaterial, Recommendation } from '@/types'
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type ReviewedQuestion = NonNullable<QuizAttempt['questions']>[number]

type CategoryScore = {
  category: string
  total: number
  correct: number
  accuracy: number
}

const sampleTrainingMaterials: TrainingMaterial[] = [
  {
    id: '1',
    title: 'Excel Formulas Masterclass',
    category: 'Formulas',
    type: 'video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Learn the most important Excel formulas and functions',
  },
  {
    id: '2',
    title: 'Excel Shortcuts Guide',
    category: 'Shortcuts',
    type: 'article',
    url: 'https://example.com/excel-shortcuts',
    description: 'Master Excel shortcuts to work faster',
  },
  {
    id: '3',
    title: 'Chart Creation Tutorial',
    category: 'Charts',
    type: 'video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Create professional charts in Excel',
  },
  {
    id: '4',
    title: 'Data Analysis with PivotTables',
    category: 'DataAnalysis',
    type: 'exercise',
    url: 'https://example.com/pivot-exercises',
    description: 'Practice data analysis with PivotTables',
  },
]

const fallbackAttempt: QuizAttempt = {
  id: 'mock-1',
  userId: 'local-user-123',
  score: 40,
  totalQuestions: 5,
  correctAnswers: 4,
  categoryScores: {
    Formulas: 2,
    Shortcuts: 1,
    Charts: 1,
  },
  wrongCategories: ['Formulas'],
  date: new Date(),
  survey: {
    usageFrequency: 'Mostly',
    selfAssessment: 'Intermediate',
    difficultyLevels: [2],
    difficultyLabel: 'Intermediate (Level 2)',
  },
}

function parseDateValue(value: unknown): Date {
  if (value instanceof Date) {
    return value
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

function toIntegerOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

function parseReviewedQuestionRecord(raw: unknown, index: number): ReviewedQuestion | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const item = raw as Partial<ReviewedQuestion> & { options?: unknown }
  const parsedCorrect = toIntegerOrNull(item.correctAnswer)
  const parsedUserAnswer = toIntegerOrNull(item.userAnswer)
  const options = Array.isArray(item.options)
    ? item.options.map((option) => (typeof option === 'string' ? option : String(option ?? '')))
    : []

  if (typeof item.text !== 'string' || options.length === 0 || parsedCorrect === null) {
    return null
  }

  const safeCorrectAnswer = Math.min(Math.max(parsedCorrect, 0), options.length - 1)
  const safeUserAnswer =
    parsedUserAnswer !== null && parsedUserAnswer >= 0 && parsedUserAnswer < options.length
      ? parsedUserAnswer
      : null

  return {
    id: typeof item.id === 'string' ? item.id : `q-${index + 1}`,
    text: item.text,
    category: typeof item.category === 'string' ? item.category : 'General',
    options,
    correctAnswer: safeCorrectAnswer,
    userAnswer: safeUserAnswer,
    isCorrect: safeUserAnswer !== null ? safeUserAnswer === safeCorrectAnswer : false,
  }
}

function parseAttemptRecord(raw: Partial<QuizAttempt>, id: string, fallbackUserId: string): QuizAttempt {
  const survey = raw.survey
  const normalizedSurvey =
    survey && typeof survey === 'object'
      ? (() => {
          const levels: Array<1 | 2 | 3 | 4 | 5> = Array.isArray(survey.difficultyLevels)
            ? survey.difficultyLevels
                .map((level) => Number(level))
                .filter((level): level is 1 | 2 | 3 | 4 | 5 => [1, 2, 3, 4, 5].includes(level))
            : []

          return {
            usageFrequency:
              typeof survey.usageFrequency === 'string' ? survey.usageFrequency : 'Mostly',
            selfAssessment:
              typeof survey.selfAssessment === 'string' ? survey.selfAssessment : 'Intermediate',
            difficultyLevels: levels.length > 0 ? levels : ([2] as Array<1 | 2 | 3 | 4 | 5>),
            difficultyLabel:
              typeof survey.difficultyLabel === 'string' ? survey.difficultyLabel : 'Intermediate (Level 2)',
          }
        })()
      : undefined

  return {
    id,
    userId: typeof raw.userId === 'string' ? raw.userId : fallbackUserId,
    batchId: typeof raw.batchId === 'string' ? raw.batchId : undefined,
    source: raw.source === 'telegram' || raw.source === 'whatsapp' ? raw.source : 'web',
    date: parseDateValue(raw.date),
    score: typeof raw.score === 'number' ? raw.score : 0,
    totalQuestions: typeof raw.totalQuestions === 'number' ? raw.totalQuestions : 0,
    correctAnswers: typeof raw.correctAnswers === 'number' ? raw.correctAnswers : 0,
    categoryScores:
      raw.categoryScores && typeof raw.categoryScores === 'object' ? raw.categoryScores : {},
    wrongCategories: Array.isArray(raw.wrongCategories) ? raw.wrongCategories : [],
    survey: normalizedSurvey,
    respondentEmail: typeof raw.respondentEmail === 'string' ? raw.respondentEmail : undefined,
    questions: Array.isArray(raw.questions)
      ? raw.questions
          .map((question, index) => parseReviewedQuestionRecord(question, index))
          .filter((question): question is ReviewedQuestion => question !== null)
      : undefined,
  }
}

function getPerformanceTone(percentage: number) {
  if (percentage >= 80) {
    return {
      label: 'Excellent',
      chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      scoreClass: 'text-emerald-700',
      meterClass: 'bg-emerald-600',
    }
  }

  if (percentage >= 60) {
    return {
      label: 'Good',
      chip: 'bg-amber-100 text-amber-800 border-amber-200',
      scoreClass: 'text-amber-700',
      meterClass: 'bg-amber-500',
    }
  }

  return {
    label: 'Needs Improvement',
    chip: 'bg-red-100 text-red-800 border-red-200',
    scoreClass: 'text-red-700',
    meterClass: 'bg-red-600',
  }
}

function getMaterialTypeStyle(type: TrainingMaterial['type']) {
  const toneByType: Record<TrainingMaterial['type'], string> = {
    video: 'bg-blue-100 text-blue-800 border-blue-200',
    article: 'bg-slate-100 text-slate-800 border-slate-200',
    exercise: 'bg-teal-100 text-teal-800 border-teal-200',
    pdf: 'bg-violet-100 text-violet-800 border-violet-200',
  }

  return toneByType[type]
}

function buildCategoryScores(attempt: QuizAttempt): CategoryScore[] {
  const questionList = attempt.questions ?? []

  if (questionList.length > 0) {
    const map = new Map<string, { total: number; correct: number }>()

    questionList.forEach((question) => {
      const current = map.get(question.category) ?? { total: 0, correct: 0 }
      current.total += 1
      if (question.isCorrect) {
        current.correct += 1
      }
      map.set(question.category, current)
    })

    return Array.from(map.entries())
      .map(([category, score]) => ({
        category,
        total: score.total,
        correct: score.correct,
        accuracy: score.total > 0 ? score.correct / score.total : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
  }

  const keys = Object.keys(attempt.categoryScores)
  if (keys.length === 0) {
    return []
  }

  return keys
    .map((category) => ({
      category,
      total: 1,
      correct: Math.min(1, attempt.categoryScores[category] || 0),
      accuracy: Math.min(1, attempt.categoryScores[category] || 0),
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
}

function buildRecommendations(categoryScores: CategoryScore[]): Recommendation[] {
  return categoryScores
    .filter((score) => score.accuracy < 0.7)
    .map((score) => ({
      category: score.category,
      accuracy: score.accuracy,
      materials: sampleTrainingMaterials.filter((material) => material.category === score.category),
    }))
}

function sanitizeReviewText(value: string): string {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeReviewOption(value: string): string {
  return sanitizeReviewText(value)
    .replace(/^[\u2022•\-–—▪■●]+\s*/g, '')
    .replace(/^[A-Da-d][\.\):\-]\s+/g, '')
}

function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + index)
}

export default function ResultsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [leadEmail, setLeadEmail] = useState('')
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadError, setLeadError] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)

  const leadStorageKey = 'quizLeadEmail'

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      router.push('/')
      return
    }

    const loadResults = async () => {
      try {
        const attemptsQuery = query(
          collection(db, 'quizAttempts'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc'),
          limit(8)
        )
        const snapshot = await getDocs(attemptsQuery)

        const firestoreAttempts = snapshot.docs
          .map((doc) => parseAttemptRecord(doc.data() as Partial<QuizAttempt>, doc.id, user.uid))
          .sort((left, right) => right.date.getTime() - left.date.getTime())

        if (firestoreAttempts.length > 0) {
          setQuizAttempts(firestoreAttempts)
          setRecommendations(buildRecommendations(buildCategoryScores(firestoreAttempts[0])))
          setPageLoading(false)
          return
        }
      } catch (error) {
        console.error('Failed to load quiz attempts from Firestore:', error)
      }

      const localResults = localStorage.getItem('quizResults')
      if (localResults) {
        const parsedLocalAttempt = parseAttemptRecord(
          JSON.parse(localResults) as Partial<QuizAttempt>,
          `local-${Date.now()}`,
          user.uid
        )
        setQuizAttempts([parsedLocalAttempt])
        setRecommendations(buildRecommendations(buildCategoryScores(parsedLocalAttempt)))
      } else {
        setQuizAttempts([fallbackAttempt])
        setRecommendations(buildRecommendations(buildCategoryScores(fallbackAttempt)))
      }

      setPageLoading(false)
    }

    void loadResults()
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) {
      return
    }

    const attemptSnapshot = quizAttempts[0] ?? fallbackAttempt
    const storedLead = typeof window !== 'undefined' ? window.localStorage.getItem(leadStorageKey) : null
    if (storedLead) {
      setLeadEmail(storedLead)
      setLeadSubmitted(true)
      return
    }

    if (attemptSnapshot.respondentEmail) {
      setLeadEmail(attemptSnapshot.respondentEmail)
      setLeadSubmitted(true)
      return
    }

    if (user.email) {
      setLeadEmail(user.email)
    }
  }, [user, quizAttempts, leadStorageKey])

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const latestAttempt = quizAttempts[0] ?? fallbackAttempt
  const survey = latestAttempt.survey
  const totalScore = latestAttempt.score
  const totalQuestions = latestAttempt.totalQuestions
  const maxScore = Math.max(totalQuestions * 10, 10)
  const percentage = totalQuestions > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  const performance = getPerformanceTone(percentage)
  const categoryScores = buildCategoryScores(latestAttempt)
  const chartMax = Math.max(...quizAttempts.map((attempt) => attempt.score), 10) + 10
  const profileLabel = survey?.difficultyLabel ?? 'Mixed Difficulty'

  const handleLeadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLeadError(null)

    const email = leadEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLeadError('Enter a valid email address to receive your report.')
      return
    }

    setLeadSubmitting(true)
    try {
      await addDoc(collection(db, 'quizLeads'), {
        userId: user.uid,
        email,
        usageFrequency: survey?.usageFrequency ?? 'Mostly',
        selfAssessment: survey?.selfAssessment ?? 'Intermediate',
        difficultyLabel: survey?.difficultyLabel ?? 'Mixed Difficulty',
        attemptId: latestAttempt.id,
        createdAt: serverTimestamp(),
      })

      window.localStorage.setItem(leadStorageKey, email)
      const localResults = localStorage.getItem('quizResults')
      if (localResults) {
        const parsed = JSON.parse(localResults) as Partial<QuizAttempt>
        parsed.respondentEmail = email
        localStorage.setItem('quizResults', JSON.stringify(parsed))
      }

      setLeadSubmitted(true)
    } catch (error) {
      console.error('Failed to save lead email:', error)
      setLeadError('We could not save your email. Please try again.')
    } finally {
      setLeadSubmitting(false)
    }
  }

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      return
    }

    const trimmedComment = sanitizeReviewText(reviewComment)
    if (!trimmedComment) {
      return
    }

    setReviewSubmitting(true)
    try {
      await addDoc(collection(db, 'reviews'), {
        userId: user.uid,
        displayName: user.displayName || user.email || 'Anonymous',
        rating: reviewRating,
        comment: trimmedComment,
        createdAt: serverTimestamp(),
      })
      setReviewSubmitted(true)
      setReviewComment('')
    } catch (error) {
      console.error('Failed to submit review:', error)
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const shareText = 'Take this Excel competency quiz and compare scores.'

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Excel Competency Quiz', text: shareText, url: shareUrl })
        setShareMessage('Thanks for sharing.')
        return
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
        setShareMessage('Link copied to clipboard.')
        return
      }

      setShareMessage('Copy the link from the address bar.')
    } catch (error) {
      console.error('Share failed:', error)
      setShareMessage('Share failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#eef2f6] py-6 md:py-8">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] shadow-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#5dd6cf]/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#8fb8ff]/20 blur-3xl" />
            <div className="relative px-7 py-6 md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#c8e8ff]">Excel Assessment Report</p>
                  <h1 className="mt-1 text-3xl font-bold text-white">Corporate Skills Summary</h1>
                  <p className="mt-2 max-w-2xl text-sm text-[#d6ebff]">
                    Review team-ready insights from this attempt, then launch a fresh randomized assessment.
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <button
                    onClick={() => router.push(`/quiz/survey?attempt=${Date.now()}`)}
                    className="btn-hero-primary w-full sm:w-auto"
                  >
                    Retake Assessment
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="btn-hero-secondary w-full sm:w-auto"
                  >
                    Home
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-white/30 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${performance.chip}`}>
                      {performance.label}
                    </span>
                    <span className="text-sm text-[#d6ebff]">Overall Performance</span>
                  </div>
                  <span className="text-2xl font-bold text-white">{percentage}%</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white/20 overflow-hidden">
                  <div className={`h-full ${performance.meterClass}`} style={{ width: `${percentage}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-[#d6ebff]">
                  <span>0%</span>
                  <span>Target: 80%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </section>

          {!leadSubmitted && (
            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#142842]">Send Me My Results</h2>
                  <p className="mt-1 text-sm text-[#5a6f8a]">
                    Enter your email to receive a copy of your results and recommendations.
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Quiz difficulty: {profileLabel}
                </div>
              </div>

              <form onSubmit={handleLeadSubmit} className="mt-4 flex flex-wrap gap-3">
                <input
                  type="email"
                  value={leadEmail}
                  onChange={(event) => setLeadEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  required
                />
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={leadSubmitting}>
                  {leadSubmitting ? 'Saving...' : 'Send My Results'}
                </button>
              </form>

              {leadError && <p className="mt-2 text-sm text-red-600">{leadError}</p>}
            </section>
          )}

          <div className={leadSubmitted ? '' : 'opacity-40 pointer-events-none select-none'}>
            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-semibold text-[#142842]">Assessment Profile</h2>
              <p className="mt-1 text-sm text-[#5a6f8a]">Based on your survey responses.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-[#dbe5f1] bg-[#f9fbff] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#5f7491]">Usage</p>
                  <p className="mt-1 text-sm font-semibold text-[#1e3757]">{survey?.usageFrequency ?? 'Mostly'}</p>
                </div>
                <div className="rounded-lg border border-[#dbe5f1] bg-[#f9fbff] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#5f7491]">Self Assessment</p>
                  <p className="mt-1 text-sm font-semibold text-[#1e3757]">{survey?.selfAssessment ?? 'Intermediate'}</p>
                </div>
                <div className="rounded-lg border border-[#dbe5f1] bg-[#f9fbff] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#5f7491]">Difficulty</p>
                  <p className="mt-1 text-sm font-semibold text-[#1e3757]">{profileLabel}</p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Final Score" value={`${totalScore}/${maxScore}`} note="Points" />
            <MetricCard label="Correct Answers" value={`${latestAttempt.correctAnswers}`} note={`of ${totalQuestions}`} />
            <MetricCard label="Incorrect Topics" value={`${latestAttempt.wrongCategories.length}`} note="Need follow-up" />
            <MetricCard label="Questions Reviewed" value={`${latestAttempt.questions?.length ?? totalQuestions}`} note="Detailed feedback" />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[#142842]">Category Breakdown</h2>
              <p className="mt-1 text-sm text-[#5a6f8a]">Accuracy by knowledge area from this attempt.</p>

              {categoryScores.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {categoryScores.map((row) => (
                    <div key={row.category} className="rounded-lg border border-[#dbe5f1] bg-[#f9fbff] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#1e3757]">{row.category}</span>
                        <span className="text-xs text-[#5a6f8a]">
                          {row.correct}/{row.total} correct
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e7edf7]">
                        <div className="h-full bg-[#1f6f6d]" style={{ width: `${Math.round(row.accuracy * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#5a6f8a]">No category-level data available for this attempt.</p>
              )}
            </div>

            <div className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[#142842]">Recommended Training</h2>
              <p className="mt-1 text-sm text-[#5a6f8a]">Resources aligned with weaker categories.</p>

              {recommendations.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {recommendations.map((recommendation, index) => (
                    <article key={`${recommendation.category}-${index}`} className="rounded-lg border border-[#dbe5f1] bg-[#f9fbff] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-[#1e3757]">{recommendation.category}</h3>
                        <span className="text-xs text-[#5a6f8a]">{Math.round(recommendation.accuracy * 100)}%</span>
                      </div>

                      {recommendation.materials.length > 0 ? (
                        <div className="space-y-2">
                          {recommendation.materials.map((material) => (
                            <a
                              key={material.id}
                              href={material.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-md border border-[#dbe5f1] bg-white p-2.5 transition-colors hover:bg-[#f3f7ff]"
                            >
                              <div className="flex items-start gap-2">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getMaterialTypeStyle(material.type)}`}>
                                  {material.type.toUpperCase()}
                                </span>
                                <div>
                                  <p className="text-sm font-medium text-[#1e3757]">{material.title}</p>
                                  <p className="mt-1 text-xs text-[#5a6f8a]">{material.description}</p>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#5a6f8a]">No mapped resources yet for this category.</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                  Great result. No weak-category training recommendations right now.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#142842]">Training Programs</h2>
                <p className="mt-1 text-sm text-[#5a6f8a]">
                  Explore Online, On site, and Offsite training options tailored to this assessment.
                </p>
              </div>
              <button onClick={() => router.push('/training')} className="btn-primary w-full sm:w-auto">
                View Training Programs
              </button>
            </div>
          </section>

            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-[#142842]">Question Review</h2>
            <p className="mt-1 text-sm text-[#5a6f8a]">Detailed review of each selected answer.</p>

            {latestAttempt.questions && latestAttempt.questions.length > 0 ? (
              <div className="mt-5 space-y-4">
                {latestAttempt.questions.map((question: ReviewedQuestion, index: number) => {
                  const isCorrectAttempt =
                    question.userAnswer !== null && question.userAnswer === question.correctAnswer
                  const selectedAnswerLabel =
                    question.userAnswer === null ? 'Not Answered' : `${getOptionLabel(question.userAnswer)}.`

                  return (
                    <article
                      key={`${question.id}-${index}`}
                      className={`rounded-xl border p-3 md:p-4 ${
                        isCorrectAttempt ? 'border-emerald-200 bg-emerald-50/60' : 'border-[#dbe5f1] bg-[#f9fbff]'
                      }`}
                    >
                      <h3 className="text-base font-semibold text-[#1e3757]">
                        Question {index + 1}: {sanitizeReviewText(question.text)}
                      </h3>

                      <div className="mt-3 space-y-2">
                        {question.options.map((option: string, optionIndex: number) => {
                          const isCorrectOption = optionIndex === question.correctAnswer
                          const isSelectedOption = optionIndex === question.userAnswer
                          const isWrongUserOption = isSelectedOption && !isCorrectAttempt
                          const displayOption = sanitizeReviewOption(option)
                          const optionStyle = isCorrectOption
                            ? { backgroundColor: '#dcfce7', borderColor: '#16a34a', borderWidth: 2 }
                            : undefined

                          return (
                            <div
                              key={`${question.id}-option-${optionIndex}`}
                              style={optionStyle}
                              className={`rounded-lg border px-3 py-2 ${
                                isCorrectOption
                                  ? 'border-2 bg-emerald-100 border-emerald-500 ring-1 ring-emerald-300'
                                  : isWrongUserOption
                                    ? 'border-orange-300 bg-white'
                                    : 'bg-white border-[#dbe5f1]'
                              }`}
                            >
                              <p className="text-sm leading-relaxed text-[#1e3757]">
                                <span className="mr-2 inline-flex min-w-8 items-center justify-center rounded bg-[#dbe5de] px-2 py-0.5 text-xs font-semibold text-[#2d4a3a]">
                                  {getOptionLabel(optionIndex)}.
                                </span>
                                <span>{displayOption}</span>
                              </p>
                            </div>
                          )
                        })}
                      </div>

                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                          isCorrectAttempt
                            ? 'border-emerald-300 bg-emerald-100/80 text-emerald-900'
                            : 'border-orange-300 bg-white text-orange-900'
                        }`}
                      >
                        <p>
                          <span className="font-semibold">Your Answer:</span> {selectedAnswerLabel}{' '}
                          <span className="font-semibold">Result:</span> {isCorrectAttempt ? 'Correct' : 'Incorrect'}
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-[#dce6df] bg-white px-4 py-4 text-sm text-[#4b6859]">
                Question-level review is not available for this attempt.
              </p>
            )}
            </section>

            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-[#142842]">Performance History</h2>
            <p className="mt-1 text-sm text-[#5a6f8a]">Recent attempt scores.</p>

            {quizAttempts.length > 0 ? (
              <div className="mt-4 h-64">
                <Bar
                  data={{
                    labels: quizAttempts.slice(0, 5).reverse().map((_, index) => `Attempt ${index + 1}`),
                    datasets: [
                      {
                        label: 'Score',
                        data: quizAttempts.slice(0, 5).reverse().map((attempt) => attempt.score),
                        backgroundColor: '#217346',
                        borderColor: '#1f6e42',
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: chartMax,
                        ticks: {
                          stepSize: 10,
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#4b6859]">No history available yet.</p>
            )}
            </section>
          </div>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#142842]">Share and Review</h2>
                <p className="mt-1 text-sm text-[#5a6f8a]">
                  Help others compare their Excel skills. Share the quiz and leave a review.
                </p>
              </div>
              <button onClick={handleShare} className="btn-secondary w-full sm:w-auto">
                Share Quiz Link
              </button>
            </div>

            {shareMessage && <p className="mt-2 text-sm text-[#5a6f8a]">{shareMessage}</p>}

            <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#1e3757]">Rate your experience</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setReviewRating(rating)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                        reviewRating === rating
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-[#dbe5f1] bg-white text-[#1e3757]'
                      }`}
                    >
                      {rating} / 5
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#1e3757]">Leave a short review</label>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={4}
                  maxLength={240}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  placeholder="What did you like about the quiz?"
                  required
                />
                <p className="mt-1 text-xs text-[#5a6f8a]">{reviewComment.length}/240</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
                {reviewSubmitted && <span className="text-sm text-emerald-700">Thanks for the review.</span>}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-xl border border-[#d9e3ef] bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-[#5f7491]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#142842]">{value}</p>
      <p className="mt-1 text-xs text-[#5a6f8a]">{note}</p>
    </article>
  )
}
