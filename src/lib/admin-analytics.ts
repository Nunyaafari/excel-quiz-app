import { collection, getCountFromServer, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AdminStats } from '@/types'

type SourceChannel = 'web' | 'telegram' | 'whatsapp'

export interface AdminAnalyticsSnapshot extends AdminStats {
  sourceDistribution: Record<string, number>
  landingSourceDistribution: Record<string, number>
  scoreBandDistribution: Record<string, number>
  difficultyLevelDistribution: Record<string, number>
  dailyAttempts: Array<{
    date: string
    attempts: number
  }>
  weakCategoryCounts: Array<{
    category: string
    misses: number
  }>
}

function toDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

function increment(record: Record<string, number>, key: string, amount = 1) {
  record[key] = (record[key] ?? 0) + amount
}

function normalizeChannel(value: unknown): SourceChannel {
  if (value === 'telegram' || value === 'whatsapp') {
    return value
  }
  return 'web'
}

function getScoreBand(score: number): string {
  if (score < 40) return '0-39'
  if (score < 60) return '40-59'
  if (score < 80) return '60-79'
  return '80-100'
}

function formatDay(date: Date): string {
  return date.toISOString().split('T')[0]
}

export async function getAdminAnalyticsSnapshot(): Promise<AdminAnalyticsSnapshot> {
  try {
    const [
      questionsCountSnap,
      usersCountSnap,
      attemptsSnap,
      recentAttemptsSnap,
      recentLeadsSnap,
      recentRequestsSnap,
      recentReviewsSnap,
      analyticsEventsSnap,
      recentAnalyticsEventsSnap,
    ] = await Promise.all([
      getCountFromServer(collection(db, 'questions')),
      getCountFromServer(collection(db, 'users')),
      getDocs(collection(db, 'quizAttempts')),
      getDocs(query(collection(db, 'quizAttempts'), orderBy('date', 'desc'), limit(8))),
      getDocs(query(collection(db, 'quizLeads'), orderBy('createdAt', 'desc'), limit(8))),
      getDocs(query(collection(db, 'trainingRequests'), orderBy('createdAt', 'desc'), limit(8))),
      getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(8))),
      getDocs(collection(db, 'analyticsEvents')),
      getDocs(query(collection(db, 'analyticsEvents'), orderBy('createdAt', 'desc'), limit(8))),
    ])

    const categoryDistribution: Record<string, number> = {}
    const sourceDistribution: Record<string, number> = {}
    const landingSourceDistribution: Record<string, number> = {}
    const scoreBandDistribution: Record<string, number> = {
      '0-39': 0,
      '40-59': 0,
      '60-79': 0,
      '80-100': 0,
    }
    const difficultyLevelDistribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    }
    const dailyAttemptsByDate: Record<string, number> = {}
    const weakCategoryMap: Record<string, number> = {}

    let totalPercentage = 0

    attemptsSnap.forEach((docSnap) => {
      const data = docSnap.data() as {
        score?: unknown
        correctAnswers?: unknown
        totalQuestions?: unknown
        source?: unknown
        date?: unknown
        categoryScores?: unknown
        wrongCategories?: unknown
        questions?: unknown
        survey?: unknown
      }

      const score = typeof data.score === 'number' ? data.score : 0
      const totalQuestions =
        typeof data.totalQuestions === 'number' && data.totalQuestions > 0 ? data.totalQuestions : 0
      const correctAnswers =
        typeof data.correctAnswers === 'number'
          ? data.correctAnswers
          : totalQuestions > 0
            ? Math.round(score / 10)
            : 0

      const rawPercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0
      const percentage = Math.max(0, Math.min(100, rawPercentage))
      totalPercentage += percentage

      const source = normalizeChannel(data.source)
      increment(sourceDistribution, source)
      increment(scoreBandDistribution, getScoreBand(percentage))

      const attemptDate = toDate(data.date)
      increment(dailyAttemptsByDate, formatDay(attemptDate))

      if (data.survey && typeof data.survey === 'object' && 'difficultyLevels' in data.survey) {
        const survey = data.survey as { difficultyLevels?: unknown }
        if (Array.isArray(survey.difficultyLevels)) {
          survey.difficultyLevels.forEach((level) => {
            const numeric = typeof level === 'number' ? level : Number(level)
            if ([1, 2, 3, 4, 5].includes(numeric)) {
              increment(difficultyLevelDistribution, String(numeric))
            }
          })
        }
      }

      if (data.categoryScores && typeof data.categoryScores === 'object') {
        Object.entries(data.categoryScores as Record<string, unknown>).forEach(([category, value]) => {
          if (typeof value === 'number' && category.trim()) {
            increment(categoryDistribution, category, value)
          }
        })
      }

      if (Array.isArray(data.questions)) {
        data.questions.forEach((question) => {
          if (!question || typeof question !== 'object') {
            return
          }

          const item = question as { category?: unknown; isCorrect?: unknown }
          if (typeof item.category !== 'string' || !item.category.trim()) {
            return
          }

          if (item.isCorrect === false) {
            increment(weakCategoryMap, item.category)
          }
        })
      } else if (Array.isArray(data.wrongCategories)) {
        data.wrongCategories.forEach((category) => {
          if (typeof category === 'string' && category.trim()) {
            increment(weakCategoryMap, category)
          }
        })
      }
    })

    analyticsEventsSnap.forEach((docSnap) => {
      const data = docSnap.data() as { source?: unknown }
      const source = normalizeChannel(data.source)
      increment(landingSourceDistribution, source)
    })

    const attemptActivities = recentAttemptsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as {
        score?: unknown
        correctAnswers?: unknown
        totalQuestions?: unknown
        userId?: unknown
        respondentEmail?: unknown
        date?: unknown
        source?: unknown
      }

      const score = typeof data.score === 'number' ? data.score : 0
      const totalQuestions =
        typeof data.totalQuestions === 'number' && data.totalQuestions > 0 ? data.totalQuestions : 0
      const correctAnswers =
        typeof data.correctAnswers === 'number'
          ? data.correctAnswers
          : totalQuestions > 0
            ? Math.round(score / 10)
            : 0
      const rawPercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0
      const percentage = Math.max(0, Math.min(100, rawPercentage))
      const label =
        typeof data.respondentEmail === 'string' && data.respondentEmail.trim()
          ? data.respondentEmail
          : typeof data.userId === 'string' && data.userId.trim()
            ? data.userId
            : 'participant'

      return {
        action: `Quiz completed via ${normalizeChannel(data.source)} (${percentage.toFixed(0)}%)`,
        timestamp: toDate(data.date),
        user: label,
      }
    })

    const leadActivities = recentLeadsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as { email?: unknown; createdAt?: unknown }
      return {
        action: 'Quiz lead captured',
        timestamp: toDate(data.createdAt),
        user: typeof data.email === 'string' && data.email.trim() ? data.email : 'lead',
      }
    })

    const requestActivities = recentRequestsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as { email?: unknown; requestType?: unknown; createdAt?: unknown }
      const requestType = data.requestType === 'assessment' ? 'assessment request' : 'training request'
      return {
        action: `New ${requestType}`,
        timestamp: toDate(data.createdAt),
        user: typeof data.email === 'string' && data.email.trim() ? data.email : 'request',
      }
    })

    const reviewActivities = recentReviewsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as { displayName?: unknown; rating?: unknown; createdAt?: unknown }
      const rating = typeof data.rating === 'number' ? `${data.rating}/5` : 'review'
      return {
        action: `Review submitted (${rating})`,
        timestamp: toDate(data.createdAt),
        user: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName : 'reviewer',
      }
    })

    const landingActivities = recentAnalyticsEventsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as { source?: unknown; createdAt?: unknown }
      return {
        action: `Landing visit via ${normalizeChannel(data.source)}`,
        timestamp: toDate(data.createdAt),
        user: 'anonymous',
      }
    })

    const recentActivity = [
      ...attemptActivities,
      ...leadActivities,
      ...requestActivities,
      ...reviewActivities,
      ...landingActivities,
    ]
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
      .slice(0, 8)

    const dailyAttempts = Object.entries(dailyAttemptsByDate)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-14)
      .map(([date, attempts]) => ({ date, attempts }))

    const weakCategoryCounts = Object.entries(weakCategoryMap)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([category, misses]) => ({ category, misses }))

    const totalQuizAttempts = attemptsSnap.size
    const averageScore = totalQuizAttempts > 0 ? Number((totalPercentage / totalQuizAttempts).toFixed(1)) : 0

    return {
      totalQuestions: questionsCountSnap.data().count,
      totalUsers: usersCountSnap.data().count,
      totalQuizAttempts,
      averageScore,
      categoryDistribution,
      recentActivity,
      sourceDistribution,
      landingSourceDistribution,
      scoreBandDistribution,
      difficultyLevelDistribution,
      dailyAttempts,
      weakCategoryCounts,
    }
  } catch (error) {
    console.error('Failed to build admin analytics snapshot:', error)

    return {
      totalQuestions: 0,
      totalUsers: 0,
      totalQuizAttempts: 0,
      averageScore: 0,
      categoryDistribution: {},
      recentActivity: [],
      sourceDistribution: {},
      landingSourceDistribution: {},
      scoreBandDistribution: {
        '0-39': 0,
        '40-59': 0,
        '60-79': 0,
        '80-100': 0,
      },
      difficultyLevelDistribution: {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      },
      dailyAttempts: [],
      weakCategoryCounts: [],
    }
  }
}
