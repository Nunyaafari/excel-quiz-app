export interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  totalScore: number
  quizAttempts: number
  lastActive: Date
  weakCategories: string[]
}

export interface Question {
  id: string
  text: string
  category: 'Formulas' | 'Shortcuts' | 'Charts' | 'DataAnalysis' | 'Formatting'
  options: string[]
  correctAnswer: number // 0-3 index
  difficulty: 1 | 2 | 3 | 4 | 5
  imageUrl?: string
}

export interface QuizAttempt {
  id: string
  userId: string
  date: Date
  score: number
  totalQuestions: number
  correctAnswers: number
  categoryScores: Record<string, number>
  wrongCategories: string[]
}

export interface TrainingMaterial {
  id: string
  title: string
  category: string
  type: 'video' | 'article' | 'exercise' | 'pdf'
  url: string
  thumbnail?: string
  description?: string
}

export interface QuizState {
  currentQuestionIndex: number
  selectedAnswers: (number | null)[]
  score: number
  isCompleted: boolean
  startTime: Date | null
  endTime: Date | null
}

export interface Recommendation {
  category: string
  materials: TrainingMaterial[]
  accuracy: number
}