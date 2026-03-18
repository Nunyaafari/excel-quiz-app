import { QuizAttempt, TrainingMaterial, Recommendation } from '@/types'

export interface UserProgress {
  userId: string
  totalScore: number
  quizAttempts: number
  categoryScores: Record<string, number>
  weakCategories: string[]
  strengths: string[]
  learningPath: string[]
}

export interface PersonalizedRecommendation extends Recommendation {
  priority: 'high' | 'medium' | 'low'
  estimatedTime: string
  nextSteps: string[]
}

export function analyzeUserProgress(attempts: QuizAttempt[]): UserProgress {
  const categoryScores: Record<string, number> = {}
  const categoryAttempts: Record<string, number> = {}
  const categoryCorrect: Record<string, number> = {}
  
  // Calculate category performance
  attempts.forEach(attempt => {
    Object.entries(attempt.categoryScores).forEach(([category, correct]) => {
      categoryScores[category] = (categoryScores[category] || 0) + correct
      categoryAttempts[category] = (categoryAttempts[category] || 0) + 1
      categoryCorrect[category] = (categoryCorrect[category] || 0) + correct
    })
  })

  // Calculate accuracy per category
  const categoryAccuracy: Record<string, number> = {}
  Object.keys(categoryScores).forEach(category => {
    const totalQuestions = categoryAttempts[category] * 5 // Assuming 5 questions per quiz
    categoryAccuracy[category] = totalQuestions > 0 ? categoryCorrect[category] / totalQuestions : 0
  })

  // Identify weak categories (less than 70% accuracy)
  const weakCategories = Object.entries(categoryAccuracy)
    .filter(([_, accuracy]) => accuracy < 0.7)
    .map(([category]) => category)

  // Identify strengths (80%+ accuracy)
  const strengths = Object.entries(categoryAccuracy)
    .filter(([_, accuracy]) => accuracy >= 0.8)
    .map(([category]) => category)

  // Calculate total score and attempts
  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0)
  const totalAttempts = attempts.length

  // Determine learning path
  const learningPath = determineLearningPath(categoryAccuracy, weakCategories)

  return {
    userId: attempts[0]?.userId || 'unknown',
    totalScore,
    quizAttempts: totalAttempts,
    categoryScores,
    weakCategories,
    strengths,
    learningPath,
  }
}

function determineLearningPath(categoryAccuracy: Record<string, number>, weakCategories: string[]): string[] {
  const path: string[] = []
  
  // Start with basics if many weak areas
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
  } else {
    path.push('Advanced Excel mastery')
    path.push('Power user techniques')
    path.push('Automation and VBA introduction')
  }
  
  return path
}

export function generatePersonalizedRecommendations(
  progress: UserProgress,
  materials: TrainingMaterial[]
): PersonalizedRecommendation[] {
  const recommendations: PersonalizedRecommendation[] = []

  // Generate recommendations for weak categories
  progress.weakCategories.forEach(category => {
    const categoryMaterials = materials.filter(m => m.category === category)
    const accuracy = progress.categoryScores[category] / (progress.quizAttempts * 5)
    
    let priority: 'high' | 'medium' | 'low'
    let estimatedTime: string
    let nextSteps: string[]

    if (accuracy < 0.5) {
      priority = 'high'
      estimatedTime = '2-3 hours'
      nextSteps = [
        'Start with beginner tutorials',
        'Practice basic exercises',
        'Take focused quizzes'
      ]
    } else {
      priority = 'medium'
      estimatedTime = '1-2 hours'
      nextSteps = [
        'Review advanced concepts',
        'Practice with real-world examples',
        'Test knowledge with quizzes'
      ]
    }

    recommendations.push({
      category,
      materials: categoryMaterials.slice(0, 3), // Limit to 3 recommendations per category
      accuracy,
      priority,
      estimatedTime,
      nextSteps,
    })
  })

  // Add recommendations for strengths (advanced content)
  if (progress.strengths.length > 0) {
    progress.strengths.forEach(category => {
      const advancedMaterials = materials.filter(m => 
        m.category === category && m.type === 'video'
      )
      
      if (advancedMaterials.length > 0) {
        recommendations.push({
          category: `${category} (Advanced)`,
          materials: advancedMaterials.slice(0, 2),
          accuracy: 0.9,
          priority: 'low',
          estimatedTime: '1 hour',
          nextSteps: [
            'Explore advanced techniques',
            'Learn power user shortcuts',
            'Consider certification'
          ],
        })
      }
    })
  }

  // Add general recommendations
  if (progress.quizAttempts < 3) {
    recommendations.push({
      category: 'General',
      materials: materials.filter(m => m.type === 'exercise').slice(0, 2),
      accuracy: 0,
      priority: 'medium',
      estimatedTime: '30 minutes',
      nextSteps: [
        'Take more quizzes to establish baseline',
        'Practice regularly',
        'Track progress over time'
      ],
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })
}

export function generateLearningPath(progress: UserProgress): {
  currentPhase: string
  nextMilestone: string
  estimatedCompletion: string
  dailyGoals: string[]
} {
  const totalCategories = 5
  const masteredCategories = Object.values(progress.categoryScores)
    .filter(score => score / (progress.quizAttempts * 5) >= 0.8).length
  
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
      'Practice with 1 tutorial'
    ]
  } else if (masteredCategories < 3) {
    currentPhase = 'Intermediate Development'
    nextMilestone = 'Master 3 categories'
    estimatedCompletion = '2-3 weeks'
    dailyGoals = [
      'Focus on weakest category',
      'Review strengths to maintain',
      'Complete practice exercises'
    ]
  } else if (masteredCategories < 5) {
    currentPhase = 'Advanced Mastery'
    nextMilestone = 'Master all categories'
    estimatedCompletion = '1-2 weeks'
    dailyGoals = [
      'Target remaining weak areas',
      'Advanced technique practice',
      'Speed and accuracy drills'
    ]
  } else {
    currentPhase = 'Expert Level'
    nextMilestone = '90%+ accuracy in all categories'
    estimatedCompletion = 'Ongoing'
    dailyGoals = [
      'Maintain skills with regular practice',
      'Learn advanced features',
      'Explore automation and macros'
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
  const highPriority = recommendations.filter(r => r.priority === 'high')
  const mediumPriority = recommendations.filter(r => r.priority === 'medium')
  const lowPriority = recommendations.filter(r => r.priority === 'low')

  const dailySchedule = [
    `Morning: ${highPriority[0]?.category || 'Review weak areas'} (${highPriority[0]?.estimatedTime || '30 min'})`,
    `Afternoon: ${mediumPriority[0]?.category || 'Practice exercises'} (${mediumPriority[0]?.estimatedTime || '30 min'})`,
    `Evening: ${lowPriority[0]?.category || 'Review strengths'} (${lowPriority[0]?.estimatedTime || '15 min'})`
  ]

  const weeklyGoals = [
    `Complete ${highPriority.length} high-priority recommendations`,
    `Review progress in weak categories`,
    `Maintain accuracy in strong categories`,
    `Take 3-5 practice quizzes`
  ]

  const progressTracking = [
    'Track quiz scores daily',
    'Monitor category accuracy trends',
    'Complete recommended materials',
    'Adjust focus based on progress'
  ]

  return {
    dailySchedule,
    weeklyGoals,
    progressTracking,
  }
}