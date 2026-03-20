import { QuizAttempt, Recommendation, TrainingMaterial } from '@/types'

interface CategoryPerformance {
  correct: number
  total: number
}

export interface UserProgress {
  userId: string
  totalScore: number
  quizAttempts: number
  categoryScores: Record<string, number>
  categoryTotals: Record<string, number>
  categoryAccuracy: Record<string, number>
  weakCategories: string[]
  strengths: string[]
  learningPath: string[]
}

export interface PersonalizedRecommendation extends Recommendation {
  priority: 'high' | 'medium' | 'low'
  estimatedTime: string
  nextSteps: string[]
}

function normalizeLegacyAttemptCategoryPerformance(attempt: QuizAttempt): Record<string, CategoryPerformance> {
  const performance: Record<string, CategoryPerformance> = {}

  Object.entries(attempt.categoryScores).forEach(([category, correct]) => {
    const normalizedCorrect = Math.max(0, Number(correct) || 0)
    const inferredWrongCount = attempt.wrongCategories.includes(category) ? 1 : 0

    performance[category] = {
      correct: normalizedCorrect,
      total: normalizedCorrect + inferredWrongCount,
    }
  })

  attempt.wrongCategories.forEach((category) => {
    if (!performance[category]) {
      performance[category] = {
        correct: 0,
        total: 1,
      }
    }
  })

  return performance
}

function getAttemptCategoryPerformance(attempt: QuizAttempt): Record<string, CategoryPerformance> {
  if (Array.isArray(attempt.questions) && attempt.questions.length > 0) {
    const performance: Record<string, CategoryPerformance> = {}

    attempt.questions.forEach((question) => {
      const category = question.category
      if (!category) {
        return
      }

      if (!performance[category]) {
        performance[category] = {
          correct: 0,
          total: 0,
        }
      }

      performance[category].total += 1
      if (question.isCorrect) {
        performance[category].correct += 1
      }
    })

    return performance
  }

  return normalizeLegacyAttemptCategoryPerformance(attempt)
}

export function analyzeUserProgress(attempts: QuizAttempt[]): UserProgress {
  const categoryScores: Record<string, number> = {}
  const categoryTotals: Record<string, number> = {}

  attempts.forEach((attempt) => {
    const categoryPerformance = getAttemptCategoryPerformance(attempt)

    Object.entries(categoryPerformance).forEach(([category, performance]) => {
      categoryScores[category] = (categoryScores[category] || 0) + performance.correct
      categoryTotals[category] = (categoryTotals[category] || 0) + performance.total
    })
  })

  const categoryAccuracy: Record<string, number> = {}
  Object.keys(categoryTotals).forEach((category) => {
    const total = categoryTotals[category] || 0
    categoryAccuracy[category] = total > 0 ? categoryScores[category] / total : 0
  })

  const weakCategories = Object.entries(categoryAccuracy)
    .filter(([, accuracy]) => accuracy < 0.7)
    .map(([category]) => category)

  const strengths = Object.entries(categoryAccuracy)
    .filter(([, accuracy]) => accuracy >= 0.8)
    .map(([category]) => category)

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0)
  const totalAttempts = attempts.length
  const learningPath = determineLearningPath(categoryAccuracy, weakCategories)

  return {
    userId: attempts[0]?.userId || 'unknown',
    totalScore,
    quizAttempts: totalAttempts,
    categoryScores,
    categoryTotals,
    categoryAccuracy,
    weakCategories,
    strengths,
    learningPath,
  }
}

function determineLearningPath(categoryAccuracy: Record<string, number>, weakCategories: string[]): string[] {
  const path: string[] = []

  if (weakCategories.length >= 3) {
    path.push('Start with foundational concepts')
    path.push('Focus on Formulas and Shortcuts first')
    path.push('Practice with guided exercises')
  } else if (weakCategories.length === 2) {
    path.push('Target specific weak areas')
    path.push('Build on existing strengths')
    path.push('Advanced techniques in strong categories')
  } else if (weakCategories.length === 1) {
    path.push('Master the remaining weak category')
    path.push('Advanced topics and best practices')
    path.push('Certification preparation')
  } else if (Object.keys(categoryAccuracy).length > 0) {
    path.push('Advanced Excel mastery')
    path.push('Power user techniques')
    path.push('Automation and VBA introduction')
  } else {
    path.push('Complete a few more attempts to build a reliable skills profile')
    path.push('Review the topics that appeared most often')
    path.push('Use the next quiz to gather stronger category-level signals')
  }

  return path
}

export function generatePersonalizedRecommendations(
  progress: UserProgress,
  materials: TrainingMaterial[]
): PersonalizedRecommendation[] {
  const recommendations: PersonalizedRecommendation[] = []

  progress.weakCategories.forEach((category) => {
    const categoryMaterials = materials.filter((material) => material.category === category)
    const accuracy = progress.categoryAccuracy[category] ?? 0

    let priority: 'high' | 'medium' | 'low'
    let estimatedTime: string
    let nextSteps: string[]

    if (accuracy < 0.5) {
      priority = 'high'
      estimatedTime = '2-3 hours'
      nextSteps = [
        'Start with beginner tutorials',
        'Practice basic exercises',
        'Take focused quizzes',
      ]
    } else {
      priority = 'medium'
      estimatedTime = '1-2 hours'
      nextSteps = [
        'Review advanced concepts',
        'Practice with real-world examples',
        'Test knowledge with quizzes',
      ]
    }

    recommendations.push({
      category,
      materials: categoryMaterials.slice(0, 3),
      accuracy,
      priority,
      estimatedTime,
      nextSteps,
    })
  })

  progress.strengths.forEach((category) => {
    const advancedMaterials = materials.filter((material) => {
      return material.category === category && material.type === 'video'
    })

    if (advancedMaterials.length === 0) {
      return
    }

    recommendations.push({
      category: `${category} (Advanced)`,
      materials: advancedMaterials.slice(0, 2),
      accuracy: progress.categoryAccuracy[category] ?? 0.9,
      priority: 'low',
      estimatedTime: '1 hour',
      nextSteps: [
        'Explore advanced techniques',
        'Learn power user shortcuts',
        'Consider certification',
      ],
    })
  })

  if (progress.quizAttempts < 3) {
    recommendations.push({
      category: 'General',
      materials: materials.filter((material) => material.type === 'exercise').slice(0, 2),
      accuracy: 0,
      priority: 'medium',
      estimatedTime: '30 minutes',
      nextSteps: [
        'Take more quizzes to establish baseline',
        'Practice regularly',
        'Track progress over time',
      ],
    })
  }

  return recommendations.sort((left, right) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[right.priority] - priorityOrder[left.priority]
  })
}

export function generateLearningPath(progress: UserProgress): {
  currentPhase: string
  nextMilestone: string
  estimatedCompletion: string
  dailyGoals: string[]
} {
  const trackedCategories = Object.keys(progress.categoryAccuracy)
  const masteredCategories = trackedCategories.filter((category) => {
    return (progress.categoryAccuracy[category] ?? 0) >= 0.8
  }).length
  const totalTrackedCategories = Math.max(1, trackedCategories.length)

  let currentPhase: string
  let nextMilestone: string
  let estimatedCompletion: string
  let dailyGoals: string[]

  if (masteredCategories === 0) {
    currentPhase = 'Beginner Foundation'
    nextMilestone = 'Master first category (70%+ accuracy)'
    estimatedCompletion = '4-6 weeks'
    dailyGoals = [
      'Complete 1 quiz per day',
      'Review incorrect answers',
      'Practice with 1 tutorial',
    ]
  } else if (masteredCategories < Math.min(3, totalTrackedCategories)) {
    currentPhase = 'Intermediate Development'
    nextMilestone = `Master ${Math.min(3, totalTrackedCategories)} tracked categories`
    estimatedCompletion = '2-3 weeks'
    dailyGoals = [
      'Focus on weakest category',
      'Review strengths to maintain',
      'Complete practice exercises',
    ]
  } else if (masteredCategories < totalTrackedCategories) {
    currentPhase = 'Advanced Mastery'
    nextMilestone = 'Master all tracked categories'
    estimatedCompletion = '1-2 weeks'
    dailyGoals = [
      'Target remaining weak areas',
      'Advanced technique practice',
      'Speed and accuracy drills',
    ]
  } else {
    currentPhase = 'Expert Level'
    nextMilestone = '90%+ accuracy in all tracked categories'
    estimatedCompletion = 'Ongoing'
    dailyGoals = [
      'Maintain skills with regular practice',
      'Learn advanced features',
      'Explore automation and macros',
    ]
  }

  return {
    currentPhase,
    nextMilestone,
    estimatedCompletion,
    dailyGoals,
  }
}

export function getStudySchedule(recommendations: PersonalizedRecommendation[]): {
  dailySchedule: string[]
  weeklyGoals: string[]
  progressTracking: string[]
} {
  const highPriority = recommendations.filter((recommendation) => recommendation.priority === 'high')
  const mediumPriority = recommendations.filter((recommendation) => recommendation.priority === 'medium')
  const lowPriority = recommendations.filter((recommendation) => recommendation.priority === 'low')

  const dailySchedule = [
    `Morning: ${highPriority[0]?.category || 'Review weak areas'} (${highPriority[0]?.estimatedTime || '30 min'})`,
    `Afternoon: ${mediumPriority[0]?.category || 'Practice exercises'} (${mediumPriority[0]?.estimatedTime || '30 min'})`,
    `Evening: ${lowPriority[0]?.category || 'Review strengths'} (${lowPriority[0]?.estimatedTime || '15 min'})`,
  ]

  const weeklyGoals = [
    `Complete ${highPriority.length} high-priority recommendations`,
    'Review progress in weak categories',
    'Maintain accuracy in strong categories',
    'Take 3-5 practice quizzes',
  ]

  const progressTracking = [
    'Track quiz scores daily',
    'Monitor category accuracy trends',
    'Complete recommended materials',
    'Adjust focus based on progress',
  ]

  return {
    dailySchedule,
    weeklyGoals,
    progressTracking,
  }
}
