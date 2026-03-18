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
  category: 'Formulas' | 'Shortcuts' | 'Charts' | 'DataAnalysis' | 'Formatting' |
           'Advanced Charts' | 'Advanced Filtering' | 'Advanced Lookup' | 'Advanced PivotTables' |
           'Advanced Sorting' | 'Advanced Visualization' | 'Arithmetic Functions' | 'Array Formulas' |
           'Autofill and Flash Fill' | 'Chart Elements' | 'Conditional Functions' |
           'Data Analysis Tools' | 'Data Consolidation' | 'Data Entry' | 'Data Selection Strategies' |
           'Data Validation' | 'Date Functions' | 'Dynamic Array Functions' | 'Excel Basics' |
           'Excel Interface' | 'Excel Tables' | 'Financial Functions' | 'Find and Replace' |
           'Freeze Panes' | 'Functions' | 'Information Functions' | 'Logical Functions' |
           'Lookup Functions' | 'Math Functions' | 'Modern Functions' | 'Named Ranges' |
           'Paste Special' | 'PivotCharts' | 'PivotTables' | 'Power Pivot' | 'Printing' |
           'Statistical Functions' | 'Subtotals and Grouping' | 'Text Functions' | 'View Tools' |
           'Power Functions' | 'Conditional Formatting' | 'Statistical Analysis' | 'Macros and VBA' |
           'Collaboration' | 'Workbook Security'
  options: string[]
  correctAnswer: number // 0-3 index
  difficulty: 1 | 2 | 3 | 4 | 5
  imageUrl?: string
}

export interface QuizAttempt {
  id: string
  userId: string
  batchId?: string
  source?: 'web' | 'telegram' | 'whatsapp'
  date: Date
  score: number
  totalQuestions: number
  correctAnswers: number
  categoryScores: Record<string, number>
  wrongCategories: string[]
  survey?: {
    usageFrequency: 'Rarely' | 'As needed' | 'Mostly' | 'Newbie'
    selfAssessment: 'Novice' | 'Intermediate' | 'Advanced' | 'Legend'
    difficultyLevels: Array<1 | 2 | 3 | 4 | 5>
    difficultyLabel: string
  }
  respondentEmail?: string
  questions?: Array<{
    id: string
    text: string
    category: string
    options: string[]
    correctAnswer: number
    userAnswer: number | null
    isCorrect: boolean
  }>
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

export interface CSVImportResult {
  success: boolean
  importedCount: number
  failedCount: number
  errors: string[]
  warnings?: string[]
  questions: Question[]
}

export interface AdminStats {
  totalQuestions: number
  totalUsers: number
  totalQuizAttempts: number
  averageScore: number
  categoryDistribution: Record<string, number>
  recentActivity: Array<{
    action: string
    timestamp: Date
    user: string
  }>
}

export interface QuizState {
  currentQuestionIndex: number
  selectedAnswers: (number | null)[]
  score: number
  isCompleted: boolean
  startTime: Date | null
  endTime: Date | null
  expiresAt: Date | null
}

export interface QuizSurvey {
  usageFrequency: 'Rarely' | 'As needed' | 'Mostly' | 'Newbie'
  selfAssessment: 'Novice' | 'Intermediate' | 'Advanced' | 'Legend'
  difficultyLevels: Array<1 | 2 | 3 | 4 | 5>
  difficultyLabel: string
}

export interface Review {
  id: string
  userId: string
  displayName: string
  rating: number
  comment: string
  createdAt: Date
}

export interface QuizLead {
  id: string
  userId: string
  email: string
  usageFrequency: string
  selfAssessment: string
  difficultyLabel: string
  createdAt: Date
}

export interface QuizBatch {
  id: string
  name: string
  difficultyLevels: Array<1 | 2 | 3 | 4 | 5>
  difficultyLabel: string
  invitees: string[]
  createdBy: string
  createdAt: Date
}

export interface Recommendation {
  category: string
  materials: TrainingMaterial[]
  accuracy: number
}

export interface ContentApproval {
  id: string
  type: 'question' | 'training_material'
  content: Question | TrainingMaterial
  submittedBy: string
  submittedAt: Date
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: Date
  rejectionReason?: string
}

export interface TrainingMaterialExtended extends TrainingMaterial {
  difficulty: 1 | 2 | 3 | 4 | 5
  estimatedTime: number // in minutes
  createdAt: Date
  createdBy: string
  approved: boolean
  tags: string[]
}

export interface TrainingRequest {
  id: string
  requestType: 'training' | 'assessment'
  email: string
  phone: string
  organization: string
  notes?: string
  createdAt: Date
  userId?: string
}
