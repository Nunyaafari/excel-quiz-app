'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { db } from '@/lib/firebase'
import { QuizAttempt, TrainingMaterial, Recommendation } from '@/types'
import { buildShareResultsImagePath, buildShareResultsPath } from '@/lib/share-results'
import { getQuizParticipantId } from '@/lib/quiz-session'
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
  userId: 'guest-local-user',
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    ) as T
  }

  return value
}

function isLocalhostUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function resolveShareBaseUrl(): string {
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configuredBase && !isLocalhostUrl(configuredBase)) {
    return configuredBase.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '')
  }

  return (configuredBase || 'http://localhost:3000').replace(/\/$/, '')
}

function buildShareCaption({
  percentage,
  performanceLabel,
  profileLabel,
  correctAnswers,
  totalQuestions,
  shareUrl,
}: {
  percentage: number
  performanceLabel: string
  profileLabel: string
  correctAnswers: number
  totalQuestions: number
  shareUrl: string
}): string {
  return `Dare to Take the Quiz. I scored ${percentage}% on the Excel Mastery Quiz (${performanceLabel}, ${correctAnswers}/${totalQuestions} correct, ${profileLabel}). Compare your Excel skills here: ${shareUrl}`
}

type SocialPlatform = 'linkedin' | 'x' | 'facebook' | 'whatsapp'

function buildSocialShareUrl(platform: SocialPlatform, caption: string, shareUrl: string): string {
  const encodedCaption = encodeURIComponent(caption)
  const encodedUrl = encodeURIComponent(shareUrl)
  const combinedText = encodeURIComponent(`${caption}`)

  switch (platform) {
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedCaption}&url=${encodedUrl}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedCaption}`
    case 'whatsapp':
      return `https://wa.me/?text=${combinedText}`
  }
}

function getSocialShareHelpText(platform: SocialPlatform): string {
  switch (platform) {
    case 'linkedin':
      return 'Opened LinkedIn and copied your caption. LinkedIn web sharing uses the URL preview, so upload the badge manually or use "Share Badge from Device" where supported.'
    case 'facebook':
      return 'Opened Facebook and copied your caption. Facebook web sharing uses the shared link preview, so upload the badge manually if you want the badge image in the post.'
    case 'x':
      return 'Opened X with your caption and link. If you want the badge image too, attach the downloaded badge before posting.'
    case 'whatsapp':
      return 'Opened WhatsApp with your caption and link. If you want the badge image too, attach the downloaded badge before sending.'
  }
}

function SharePlatformIcon({ platform }: { platform: SocialPlatform }) {
  const iconClassName = 'h-4 w-4'

  switch (platform) {
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName} fill="currentColor">
          <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A2.03 2.03 0 0 0 3.2 5.03c0 1.12.92 2.03 2.03 2.03h.02a2.03 2.03 0 1 0 0-4.06ZM20.44 13.08c0-3.53-1.88-5.17-4.38-5.17-2.02 0-2.92 1.11-3.43 1.9V8.5H9.25c.04.86 0 11.5 0 11.5h3.38v-6.42c0-.34.03-.67.13-.92.27-.67.88-1.36 1.91-1.36 1.35 0 1.89 1.02 1.89 2.52V20H20v-6.92c0-.37.01-.73 0-1Z" />
        </svg>
      )
    case 'x':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName} fill="currentColor">
          <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.28l-4.9-7.43L5.5 22H2.4l7.24-8.27L1 2h6.44l4.43 6.77L18.9 2Zm-1.1 18h1.74L6.48 3.9H4.61L17.8 20Z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName} fill="currentColor">
          <path d="M13.5 22v-8.18h2.78l.42-3.23H13.5V8.53c0-.93.26-1.57 1.6-1.57h1.7V4.08c-.83-.1-1.67-.14-2.5-.13-2.47 0-4.17 1.5-4.17 4.27v2.37H7.32v3.23h2.81V22h3.37Z" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName} fill="currentColor">
          <path d="M20.52 3.48A11.9 11.9 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.16 1.6 5.98L0 24l6.29-1.65a11.8 11.8 0 0 0 5.78 1.48h.01c6.57 0 11.92-5.34 11.92-11.91 0-3.18-1.24-6.17-3.48-8.44ZM12.08 21.8h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.21-3.73.98.99-3.64-.23-.37a9.8 9.8 0 0 1-1.5-5.28c0-5.42 4.42-9.83 9.86-9.83 2.63 0 5.09 1.02 6.95 2.89a9.77 9.77 0 0 1 2.88 6.95c0 5.42-4.42 9.83-9.83 9.83Zm5.39-7.36c-.3-.15-1.78-.88-2.05-.98-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.38-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.35.2 1.86.12.57-.08 1.78-.73 2.03-1.44.25-.71.25-1.32.18-1.44-.07-.12-.27-.2-.57-.35Z" />
        </svg>
      )
  }
}

function buildDetailedReportText({
  attempt,
  percentage,
  performanceLabel,
  profileLabel,
  categoryScores,
  recommendations,
}: {
  attempt: QuizAttempt
  percentage: number
  performanceLabel: string
  profileLabel: string
  categoryScores: CategoryScore[]
  recommendations: Recommendation[]
}): string {
  const lines = [
    'Excel Mastery Quiz Report',
    '',
    `Completed: ${attempt.date.toLocaleString()}`,
    `Score: ${percentage}% (${attempt.score}/${Math.max(attempt.totalQuestions * 10, 10)})`,
    `Performance: ${performanceLabel}`,
    `Correct answers: ${attempt.correctAnswers}/${attempt.totalQuestions}`,
    `Difficulty: ${profileLabel}`,
  ]

  if (categoryScores.length > 0) {
    lines.push('', 'Category Breakdown')
    categoryScores.forEach((row) => {
      lines.push(`- ${row.category}: ${row.correct}/${row.total} correct (${Math.round(row.accuracy * 100)}%)`)
    })
  }

  if (recommendations.length > 0) {
    lines.push('', 'Recommended Training')
    recommendations.forEach((recommendation) => {
      lines.push(`- ${recommendation.category}: ${Math.round(recommendation.accuracy * 100)}% accuracy`)
      if (recommendation.materials.length > 0) {
        recommendation.materials.forEach((material) => {
          lines.push(`  • ${material.title} (${material.type}) - ${material.url}`)
        })
      } else {
        lines.push('  • No mapped resources yet.')
      }
    })
  }

  if (attempt.questions && attempt.questions.length > 0) {
    lines.push('', 'Question Review')
    attempt.questions.forEach((question, index) => {
      const selectedAnswer =
        question.userAnswer === null
          ? 'Not answered'
          : `${getOptionLabel(question.userAnswer)}. ${sanitizeReviewOption(question.options[question.userAnswer] ?? '')}`
      const correctAnswer = `${getOptionLabel(question.correctAnswer)}. ${sanitizeReviewOption(
        question.options[question.correctAnswer] ?? ''
      )}`

      lines.push(
        `${index + 1}. ${sanitizeReviewText(question.text)}`,
        `   Your answer: ${selectedAnswer}`,
        `   Correct answer: ${correctAnswer}`,
        `   Result: ${question.isCorrect ? 'Correct' : 'Incorrect'}`
      )
    })
  }

  return lines.join('\n')
}

export default function ResultsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const participantId = getQuizParticipantId(user?.uid)
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [leadEmail, setLeadEmail] = useState('')
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadError, setLeadError] = useState<string | null>(null)
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null)
  const [deliveryState, setDeliveryState] = useState<'success' | 'warning' | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)

  const leadStorageKey = 'quizLeadEmail'

  useEffect(() => {
    const loadResults = async () => {
      const localResults = localStorage.getItem('quizResults')
      const localAttempt = localResults
        ? parseAttemptRecord(JSON.parse(localResults) as Partial<QuizAttempt>, 'local-latest', participantId)
        : null
      const activeParticipantId = localAttempt?.userId || user?.uid || participantId
      const canQueryFirestore = Boolean(user?.uid && activeParticipantId === user.uid)

      if (canQueryFirestore) {
        try {
          const attemptsQuery = query(collection(db, 'quizAttempts'), where('userId', '==', activeParticipantId), limit(50))
          const snapshot = await getDocs(attemptsQuery)

          const firestoreAttempts = snapshot.docs
            .map((doc) => parseAttemptRecord(doc.data() as Partial<QuizAttempt>, doc.id, activeParticipantId))
            .sort((left, right) => right.date.getTime() - left.date.getTime())
            .slice(0, 8)

          if (firestoreAttempts.length > 0) {
            setQuizAttempts(firestoreAttempts)
            setRecommendations(buildRecommendations(buildCategoryScores(firestoreAttempts[0])))
            setPageLoading(false)
            return
          }
        } catch (error) {
          console.error('Failed to load quiz attempts from Firestore:', error)
        }
      }

      if (localAttempt) {
        setQuizAttempts([localAttempt])
        setRecommendations(buildRecommendations(buildCategoryScores(localAttempt)))
      } else {
        const guestFallbackAttempt = {
          ...fallbackAttempt,
          userId: participantId,
        }
        setQuizAttempts([guestFallbackAttempt])
        setRecommendations(buildRecommendations(buildCategoryScores(guestFallbackAttempt)))
      }

      setPageLoading(false)
    }

    void loadResults()
  }, [participantId, user])

  useEffect(() => {
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

    if (user?.email) {
      setLeadEmail(user.email)
    }
  }, [user, quizAttempts, leadStorageKey])

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
      </div>
    )
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
  const completedLabel = latestAttempt.date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const sharePath = buildShareResultsPath({
    percentage,
    performanceLabel: performance.label,
    correctAnswers: latestAttempt.correctAnswers,
    totalQuestions,
    profileLabel,
    completedLabel,
    completedAt: latestAttempt.date.toISOString(),
    nonce: latestAttempt.id || `${latestAttempt.userId || participantId}-${latestAttempt.date.getTime()}`,
  })
  const shareBaseUrl = resolveShareBaseUrl()
  const shareToken = sharePath.split('/').at(-1) ?? ''
  const badgeImagePath = buildShareResultsImagePath(shareToken)
  const shareUrl = `${shareBaseUrl}${sharePath}`
  const shareRequiresPublicUrl = isLocalhostUrl(shareUrl)
  const shareCaption = buildShareCaption({
    percentage,
    performanceLabel: performance.label,
    profileLabel,
    correctAnswers: latestAttempt.correctAnswers,
    totalQuestions,
    shareUrl,
  })
  const detailedReportText = buildDetailedReportText({
    attempt: latestAttempt,
    percentage,
    performanceLabel: performance.label,
    profileLabel,
    categoryScores,
    recommendations,
  })
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
      const leadPayload = stripUndefinedDeep({
        userId: latestAttempt.userId || participantId,
        email,
        usageFrequency: survey?.usageFrequency ?? 'Mostly',
        selfAssessment: survey?.selfAssessment ?? 'Intermediate',
        difficultyLabel: survey?.difficultyLabel ?? 'Mixed Difficulty',
        attemptId: latestAttempt.id,
        score: latestAttempt.score,
        totalQuestions,
        correctAnswers: latestAttempt.correctAnswers,
        percentage,
        performanceLabel: performance.label,
        source: latestAttempt.source ?? 'web',
        categoryBreakdown: categoryScores.map((row) => ({
          category: row.category,
          correct: row.correct,
          total: row.total,
          accuracy: Math.round(row.accuracy * 100),
        })),
        recommendations: recommendations.map((recommendation) => ({
          category: recommendation.category,
          accuracy: Math.round(recommendation.accuracy * 100),
          materials: recommendation.materials.map((material) => ({
            title: material.title,
            type: material.type,
            url: material.url,
          })),
        })),
        reportText: detailedReportText,
        shareCaption,
        reportEmailStatus: 'pending',
        createdAt: serverTimestamp(),
      })
      const leadRef = await addDoc(collection(db, 'quizLeads'), leadPayload)

      window.localStorage.setItem(leadStorageKey, email)
      const localResults = localStorage.getItem('quizResults')
      if (localResults) {
        const parsed = JSON.parse(localResults) as Partial<QuizAttempt>
        parsed.respondentEmail = email
        localStorage.setItem('quizResults', JSON.stringify(parsed))
      }

      try {
        const emailResponse = await fetch('/api/quiz/results-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: leadRef.id,
            attemptId: latestAttempt.id,
            email,
            displayName: user?.displayName || user?.email || 'Excel Quiz Participant',
            percentage,
            totalScore,
            maxScore,
            correctAnswers: latestAttempt.correctAnswers,
            totalQuestions,
            performanceLabel: performance.label,
            profileLabel,
            completedLabel,
            categoryScores: categoryScores.map((row) => ({
              category: row.category,
              correct: row.correct,
              total: row.total,
              accuracy: Math.round(row.accuracy * 100),
            })),
            recommendations: recommendations.map((recommendation) => ({
              category: recommendation.category,
              accuracy: Math.round(recommendation.accuracy * 100),
              materials: recommendation.materials.map((material) => ({
                title: material.title,
                type: material.type,
                url: material.url,
                description: material.description ?? '',
              })),
            })),
            questionReview: (latestAttempt.questions ?? []).map((question, index) => ({
              order: index + 1,
              text: sanitizeReviewText(question.text),
              category: question.category,
              selectedAnswer:
                question.userAnswer === null
                  ? 'Not answered'
                  : `${getOptionLabel(question.userAnswer)}. ${sanitizeReviewOption(question.options[question.userAnswer] ?? '')}`,
              correctAnswer: `${getOptionLabel(question.correctAnswer)}. ${sanitizeReviewOption(
                question.options[question.correctAnswer] ?? ''
              )}`,
              result: question.isCorrect ? 'Correct' : 'Incorrect',
            })),
            shareCaption,
            shareUrl,
            reportText: detailedReportText,
          }),
        })

        const emailPayload = (await emailResponse.json().catch(() => null)) as
          | { id?: string; error?: string }
          | null

        if (!emailResponse.ok) {
          const warningMessage =
            emailPayload?.error || 'We saved your email, but could not send the results email yet.'
          setDeliveryState('warning')
          setDeliveryMessage(warningMessage)
        } else {
          setDeliveryState('success')
          setDeliveryMessage(`Detailed results emailed to ${email}.`)
        }
      } catch (emailError) {
        console.error('Failed to send results email:', emailError)
        setDeliveryState('warning')
        setDeliveryMessage('We saved your email, but could not send the results email yet.')
      }

      setLeadSubmitted(true)
    } catch (error) {
      console.error('Failed to save lead email:', error)
      window.localStorage.setItem(leadStorageKey, email)
      const localResults = localStorage.getItem('quizResults')
      if (localResults) {
        const parsed = JSON.parse(localResults) as Partial<QuizAttempt>
        parsed.respondentEmail = email
        localStorage.setItem('quizResults', JSON.stringify(parsed))
      }

      setLeadSubmitted(true)
      setDeliveryState('warning')
      setDeliveryMessage('Detailed results unlocked on this device, but we could not save your email or send the report yet.')
    } finally {
      setLeadSubmitting(false)
    }
  }

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedComment = sanitizeReviewText(reviewComment)
    if (!trimmedComment) {
      setReviewError('Please enter a short review before submitting.')
      return
    }

    setReviewSubmitting(true)
    setReviewError(null)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: trimmedComment,
          displayName: user?.displayName || leadEmail || 'Participant',
          userId: latestAttempt.userId || participantId,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || 'We could not submit your review right now.')
      }

      setReviewSubmitted(true)
      setReviewComment('')
      setReviewRating(5)
    } catch (error) {
      console.error('Failed to submit review:', error)
      setReviewError(error instanceof Error ? error.message : 'We could not submit your review right now.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleShare = async () => {
    try {
      if (shareRequiresPublicUrl) {
        setShareMessage('Social preview needs a public site URL. Set NEXT_PUBLIC_APP_URL to your deployed domain, then share again.')
        return
      }

      if (navigator.share) {
        await navigator.share({ title: 'Excel Competency Quiz', text: shareCaption, url: shareUrl })
        setShareMessage('Thanks for sharing.')
        return
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareCaption}`)
        setShareMessage('Link copied to clipboard.')
        return
      }

      setShareMessage('Copy the link from the address bar.')
    } catch (error) {
      console.error('Share failed:', error)
      setShareMessage('Share failed. Please try again.')
    }
  }

  const createBadgePngBlob = async (): Promise<Blob> => {
    const response = await fetch(badgeImagePath, {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`badge-image-fetch-failed:${response.status}`)
    }

    return response.blob()
  }

  const copyShareCaption = async (successMessage = 'Caption copied.') => {
    try {
      await navigator.clipboard.writeText(shareCaption)
      setShareMessage(successMessage)
      return true
    } catch (error) {
      console.error('Failed to copy share caption:', error)
      return false
    }
  }

  const handleShareBadgeFromDevice = async () => {
    try {
      if (shareRequiresPublicUrl) {
        setShareMessage('Badge file sharing can work on supported devices, but social preview links still need a public NEXT_PUBLIC_APP_URL instead of localhost.')
      }

      const badgeBlob = await createBadgePngBlob()
      const badgeFile = new File([badgeBlob], `excel-quiz-badge-${percentage}.png`, {
        type: 'image/png',
      })

      if (
        navigator.share &&
        'canShare' in navigator &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [badgeFile] })
      ) {
        await navigator.share({
          title: 'Dare to Take the Quiz',
          text: shareCaption,
          url: shareUrl,
          files: [badgeFile],
        })
        setShareMessage('Badge, caption, and quiz link shared from your device.')
        return
      }

      setShareMessage('Your browser cannot attach files directly from the web share sheet. Download the badge and attach it manually, or use a supported mobile/device browser.')
    } catch (error) {
      console.error('Failed to share badge from device:', error)
      setShareMessage('Could not share the badge directly from this device.')
    }
  }

  const handleCopyLinkedInCaption = async () => {
    const copied = await copyShareCaption('LinkedIn caption copied.')
    if (!copied) {
      setShareMessage('Could not copy the LinkedIn caption.')
    }
  }

  const handleOpenSocialShare = async (platform: SocialPlatform) => {
    try {
      await copyShareCaption()
      if (shareRequiresPublicUrl) {
        setShareMessage('This app is currently sharing a localhost URL, so social platforms cannot generate a link preview. Set NEXT_PUBLIC_APP_URL to your public domain first.')
        return
      }

      window.open(buildSocialShareUrl(platform, shareCaption, shareUrl), '_blank', 'noopener,noreferrer')
      setShareMessage(getSocialShareHelpText(platform))
    } catch (error) {
      console.error(`Failed to open ${platform} share:`, error)
      setShareMessage(`Could not open ${platform} sharing.`)
    }
  }

  const handleDownloadBadge = async () => {
    try {
      const badgeBlob = await createBadgePngBlob()
      const url = URL.createObjectURL(badgeBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `excel-quiz-badge-${percentage}.png`
      link.click()
      URL.revokeObjectURL(url)
      setShareMessage('Badge downloaded as PNG.')
    } catch (error) {
      console.error('Failed to download badge:', error)
      try {
        const directUrl = new URL(badgeImagePath, window.location.origin)
        directUrl.searchParams.set('download', '1')
        const link = document.createElement('a')
        link.href = directUrl.toString()
        link.download = `excel-quiz-badge-${percentage}.png`
        link.target = '_blank'
        link.rel = 'noopener'
        link.click()
        setShareMessage('Tried direct badge download in a new tab. If the file does not save automatically, use the browser download option there.')
      } catch {
        setShareMessage('Could not download the badge.')
      }
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

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Summary Score" value={`${percentage}%`} note={`${totalScore}/${maxScore} points`} />
            <MetricCard label="Correct Answers" value={`${latestAttempt.correctAnswers}/${totalQuestions}`} note="Overall accuracy only" />
            <MetricCard label="Difficulty" value={profileLabel} note="Assessment track" />
            <MetricCard label="Completed" value={completedLabel} note="Attempt date" />
          </section>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#142842]">Shareable Badge</h2>
                <p className="mt-1 text-sm text-[#5a6f8a]">
                  Download this badge for LinkedIn or copy a ready-made caption for your post.
                </p>
              </div>
              <div className="rounded-lg border border-[#dbe5f1] bg-[#f8fbff] px-3 py-2 text-sm text-[#1e3757]">
                Performance: {performance.label}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] p-6 shadow-lg">
                <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c8e8ff]">Excel Skills Badge</p>
                      <h3 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
                        Excel Mastery Quiz
                      </h3>
                      <p className="mt-2 text-lg text-[#d6ebff]">Shareable performance snapshot</p>
                    </div>
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-white/12 ring-1 ring-white/20">
                      <img
                        src="/excel-icon.png"
                        alt="Microsoft Excel icon"
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                  </div>
                  <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
                    <div className="rounded-[28px] bg-white px-6 py-5 shadow-sm">
                      <p className={`text-6xl font-bold leading-none ${performance.scoreClass}`}>{percentage}%</p>
                      <p className="mt-3 text-lg font-semibold text-[#183251]">{performance.label}</p>
                      <p className="mt-2 text-base text-[#5a6f8a]">
                        {latestAttempt.correctAnswers}/{totalQuestions} correct
                      </p>
                    </div>
                    <div className="min-w-[220px] flex-1 pb-2 text-white">
                      <p className="text-2xl font-semibold">{profileLabel}</p>
                      <p className="mt-4 text-lg text-[#d6ebff]">Completed {completedLabel}</p>
                      <p className="mt-6 text-base text-[#d6ebff]">Generated by Excel Mastery Quiz</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1e3757]">Suggested Share Caption</p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#dbe5f1] bg-white px-3 py-1 text-xs font-semibold text-[#1e3757]">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
                      <path d="M18 16a3 3 0 0 0-2.39 1.2l-6.7-3.35a2.8 2.8 0 0 0 0-1.7l6.7-3.35A3 3 0 1 0 15 7a2.8 2.8 0 0 0 .05.52l-6.74 3.37a3 3 0 1 0 0 2.22l6.74 3.37A3 3 0 1 0 18 16Z" />
                    </svg>
                    Dare to Take the Quiz
                  </div>
                </div>
                <p className="mt-3 rounded-lg border border-[#dbe5f1] bg-white p-4 text-sm leading-relaxed text-[#1e3757] [overflow-wrap:anywhere]">
                  {shareCaption}
                </p>
                {shareRequiresPublicUrl ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    Social previews will not render from localhost. Set `NEXT_PUBLIC_APP_URL` to your deployed public domain.
                  </div>
                ) : null}
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Share Directly</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => void handleOpenSocialShare('linkedin')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dbe5f1] bg-white px-3 py-2 text-sm font-semibold text-[#1e3757] transition hover:bg-[#f3f7ff]"
                    >
                      <SharePlatformIcon platform="linkedin" />
                      LinkedIn
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenSocialShare('x')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dbe5f1] bg-white px-3 py-2 text-sm font-semibold text-[#1e3757] transition hover:bg-[#f3f7ff]"
                    >
                      <SharePlatformIcon platform="x" />
                      X
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenSocialShare('facebook')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dbe5f1] bg-white px-3 py-2 text-sm font-semibold text-[#1e3757] transition hover:bg-[#f3f7ff]"
                    >
                      <SharePlatformIcon platform="facebook" />
                      Facebook
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenSocialShare('whatsapp')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dbe5f1] bg-white px-3 py-2 text-sm font-semibold text-[#1e3757] transition hover:bg-[#f3f7ff]"
                    >
                      <SharePlatformIcon platform="whatsapp" />
                      WhatsApp
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => router.push('/')} className="btn-secondary w-full sm:w-auto">
                    Back to Home
                  </button>
                  <button onClick={() => void handleDownloadBadge()} className="btn-primary w-full sm:w-auto">
                    Download Badge
                  </button>
                  <button onClick={() => void handleShareBadgeFromDevice()} className="btn-secondary w-full sm:w-auto">
                    Share Badge From Device
                  </button>
                  <button onClick={handleCopyLinkedInCaption} className="btn-secondary w-full sm:w-auto">
                    Copy LinkedIn Caption
                  </button>
                  <button onClick={handleShare} className="btn-secondary w-full sm:w-auto">
                    Share Quiz Link
                  </button>
                </div>
                {shareMessage && <p className="mt-3 text-sm text-[#5a6f8a]">{shareMessage}</p>}
              </div>
            </div>
          </section>

          {!leadSubmitted && (
            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#142842]">Unlock Detailed Results</h2>
                  <p className="mt-1 text-sm text-[#5a6f8a]">
                    Enter your email to unlock the full breakdown, training recommendations, question review, and
                    save an email-ready copy of your report.
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
                  {leadSubmitting ? 'Saving...' : 'Unlock My Detailed Results'}
                </button>
              </form>

              {leadError && <p className="mt-2 text-sm text-red-600">{leadError}</p>}
            </section>
          )}

          {leadSubmitted ? (
            <>
            <section
              className={`rounded-2xl p-5 shadow-sm md:p-6 ${
                deliveryState === 'warning'
                  ? 'border border-amber-200 bg-amber-50'
                  : 'border border-emerald-200 bg-emerald-50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={`text-xl font-semibold ${deliveryState === 'warning' ? 'text-amber-900' : 'text-emerald-900'}`}>
                    Detailed Report Unlocked
                  </h2>
                  <p className={`mt-1 text-sm ${deliveryState === 'warning' ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {deliveryMessage ?? 'Your email has been saved and the full results are now available below.'}
                  </p>
                </div>
                <div
                  className={`rounded-lg bg-white px-3 py-2 text-sm font-medium ${
                    deliveryState === 'warning'
                      ? 'border border-amber-300 text-amber-800'
                      : 'border border-emerald-300 text-emerald-800'
                  }`}
                >
                  Report email: {leadEmail}
                </div>
              </div>
            </section>

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
            </>
          ) : (
            <section className="rounded-2xl border border-dashed border-[#cbd8e7] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#142842]">Detailed Report Locked</h2>
                  <p className="mt-1 max-w-2xl text-sm text-[#5a6f8a]">
                    Category breakdown, recommended training, question-by-question review, and history stay hidden
                    until you provide an email address.
                  </p>
                </div>
                <div className="rounded-lg border border-[#dbe5f1] bg-[#f8fbff] px-3 py-2 text-sm text-[#1e3757]">
                  1 step remaining
                </div>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#142842]">Review the Quiz</h2>
                <p className="mt-1 text-sm text-[#5a6f8a]">
                  Leave quick feedback on the assessment experience.
                </p>
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#1e3757]">Rate your experience</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => {
                        setReviewRating(rating)
                        setReviewSubmitted(false)
                        setReviewError(null)
                      }}
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
                  onChange={(event) => {
                    setReviewComment(event.target.value)
                    setReviewSubmitted(false)
                    setReviewError(null)
                  }}
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
                {reviewError && <span className="text-sm text-red-600">{reviewError}</span>}
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
