'use client'

import { useEffect, useRef, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { Question, QuizBatch, QuizState, QuizSurvey } from '@/types'
import { prepareQuizQuestions } from '@/lib/quiz-randomizer'

const QUIZ_LENGTH = 20
const QUESTIONS_PER_PAGE = 5
const SESSION_SECONDS = 10 * 60
const SURVEY_STORAGE_KEY = 'quizSurvey'
const QUESTION_CACHE_PREFIX = 'quizQuestionCache'
const QUESTION_BANK_PREFIX = 'quizQuestionBank'
const QUESTION_CACHE_TTL_MS = 10 * 60 * 1000
const QUESTION_BANK_TTL_MS = 4 * 60 * 60 * 1000

const difficultyLabel: Record<Question['difficulty'], string> = {
  1: 'Easy',
  2: 'Easy+',
  3: 'Medium',
  4: 'Hard',
  5: 'Expert',
}

const difficultyTone: Record<Question['difficulty'], string> = {
  1: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  2: 'bg-lime-50 border-lime-200 text-lime-700',
  3: 'bg-amber-50 border-amber-200 text-amber-700',
  4: 'bg-orange-50 border-orange-200 text-orange-700',
  5: 'bg-rose-50 border-rose-200 text-rose-700',
}

const allowedCategories = new Set<Question['category']>([
  'Formulas',
  'Shortcuts',
  'Charts',
  'DataAnalysis',
  'Formatting',
  'Advanced Charts',
  'Advanced Filtering',
  'Advanced Lookup',
  'Advanced PivotTables',
  'Advanced Sorting',
  'Advanced Visualization',
  'Arithmetic Functions',
  'Array Formulas',
  'Autofill and Flash Fill',
  'Chart Elements',
  'Conditional Functions',
  'Data Analysis Tools',
  'Data Consolidation',
  'Data Entry',
  'Data Selection Strategies',
  'Data Validation',
  'Date Functions',
  'Dynamic Array Functions',
  'Excel Basics',
  'Excel Interface',
  'Excel Tables',
  'Financial Functions',
  'Find and Replace',
  'Freeze Panes',
  'Functions',
  'Information Functions',
  'Logical Functions',
  'Lookup Functions',
  'Math Functions',
  'Modern Functions',
  'Named Ranges',
  'Paste Special',
  'PivotCharts',
  'PivotTables',
  'Power Pivot',
  'Printing',
  'Statistical Functions',
  'Subtotals and Grouping',
  'Text Functions',
  'View Tools',
  'Power Functions',
  'Conditional Formatting',
  'Statistical Analysis',
  'Macros and VBA',
  'Collaboration',
  'Workbook Security',
])

function getStoredSurvey(): QuizSurvey | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(SURVEY_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<QuizSurvey>
    if (!parsed.usageFrequency || !parsed.selfAssessment) {
      return null
    }

    return {
      usageFrequency: parsed.usageFrequency,
      selfAssessment: parsed.selfAssessment,
      difficultyLevels: parsed.difficultyLevels ?? [1, 2, 3, 4, 5],
      difficultyLabel: parsed.difficultyLabel ?? 'Mixed',
    }
  } catch {
    return null
  }
}

function buildDifficultyKey(levels: Array<1 | 2 | 3 | 4 | 5>): string {
  return levels.slice().sort((a, b) => a - b).join('-')
}

function getCachedQuestions(key: string): Question[] | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(`${QUESTION_CACHE_PREFIX}:${key}`)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as { timestamp: number; questions: Question[] }
    if (!parsed.timestamp || !Array.isArray(parsed.questions)) {
      return null
    }

    if (Date.now() - parsed.timestamp > QUESTION_CACHE_TTL_MS) {
      window.localStorage.removeItem(`${QUESTION_CACHE_PREFIX}:${key}`)
      return null
    }

    return parsed.questions
  } catch {
    return null
  }
}

function setCachedQuestions(key: string, questions: Question[]) {
  if (typeof window === 'undefined') {
    return
  }

  const payload = {
    timestamp: Date.now(),
    questions: questions.slice(0, 300),
  }
  window.localStorage.setItem(`${QUESTION_CACHE_PREFIX}:${key}`, JSON.stringify(payload))
}

function getCachedQuestionBank(key: string): Question[] | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(`${QUESTION_BANK_PREFIX}:${key}`)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as { timestamp: number; questions: Question[] }
    if (!parsed.timestamp || !Array.isArray(parsed.questions)) {
      return null
    }

    if (Date.now() - parsed.timestamp > QUESTION_BANK_TTL_MS) {
      window.localStorage.removeItem(`${QUESTION_BANK_PREFIX}:${key}`)
      return null
    }

    if (parsed.questions.length < QUIZ_LENGTH) {
      return null
    }

    return parsed.questions
  } catch {
    return null
  }
}

function setCachedQuestionBank(key: string, questions: Question[]) {
  if (typeof window === 'undefined') {
    return
  }

  const payload = {
    timestamp: Date.now(),
    questions,
  }
  window.localStorage.setItem(`${QUESTION_BANK_PREFIX}:${key}`, JSON.stringify(payload))
}

function calculateLiveScore(questions: Question[], selectedAnswers: (number | null)[]) {
  return questions.reduce((total, question, index) => {
    if (selectedAnswers[index] === question.correctAnswer) {
      return total + 10
    }
    return total
  }, 0)
}

function toValidQuestion(raw: unknown, fallbackId: string): Question | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const data = raw as Partial<Question> & Record<string, unknown>
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  if (!text) {
    return null
  }

  const rawOptions = Array.isArray(data.options)
    ? data.options.map((option) => String(option ?? '').trim()).filter(Boolean)
    : []
  if (rawOptions.length < 2) {
    return null
  }

  const category =
    typeof data.category === 'string' && allowedCategories.has(data.category as Question['category'])
      ? (data.category as Question['category'])
      : 'Formulas'

  const parsedDifficulty = Number.parseInt(String(data.difficulty ?? 3), 10)
  const difficulty = (parsedDifficulty >= 1 && parsedDifficulty <= 5 ? parsedDifficulty : 3) as Question['difficulty']

  const parsedCorrect = Number.parseInt(String(data.correctAnswer ?? 0), 10)
  const safeCorrectAnswer =
    Number.isNaN(parsedCorrect) || parsedCorrect < 0 || parsedCorrect >= rawOptions.length ? 0 : parsedCorrect

  return {
    id: typeof data.id === 'string' ? data.id : fallbackId,
    text,
    category,
    options: rawOptions,
    correctAnswer: safeCorrectAnswer,
    difficulty,
    imageUrl: typeof data.imageUrl === 'string' && data.imageUrl.trim() ? data.imageUrl.trim() : undefined,
  }
}

function ensureMinimumQuestionPool(baseQuestions: Question[], minimum: number): Question[] {
  if (baseQuestions.length >= minimum) {
    return baseQuestions
  }

  const expanded = [...baseQuestions]
  let fallbackIndex = 0

  while (expanded.length < minimum) {
    const source = fallbackQuestions[fallbackIndex % fallbackQuestions.length]
    expanded.push({
      ...source,
      id: `${source.id}-fallback-${expanded.length + 1}`,
      options: [...source.options],
    })
    fallbackIndex += 1
  }

  return expanded
}

const fallbackQuestions: Question[] = [
  {
    id: '1',
    text: 'What does the VLOOKUP function do?',
    category: 'Formulas',
    options: [
      'Searches for a value in the first column of a table and returns a value in the same row from a specified column',
      'Creates a pivot table from the selected data',
      'Validates data entry based on specified criteria',
      'Merges multiple cells into one',
    ],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '2',
    text: 'Which keyboard shortcut is used to create an absolute cell reference?',
    category: 'Shortcuts',
    options: ['F4', 'F2', 'Ctrl + A', 'Alt + Enter'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '3',
    text: 'What is the purpose of the SUMIF function?',
    category: 'Formulas',
    options: [
      'Sums values that meet a specific condition',
      'Counts the number of cells that contain numbers',
      'Returns the average of a range of cells',
      'Finds the maximum value in a range',
    ],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '4',
    text: 'Which chart type is best for showing trends over time?',
    category: 'Charts',
    options: ['Line Chart', 'Pie Chart', 'Bar Chart', 'Scatter Plot'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '5',
    text: 'What does the CONCATENATE function do?',
    category: 'Formulas',
    options: [
      'Joins two or more text strings into one text string',
      'Splits text into separate columns',
      'Converts text to uppercase',
      'Removes extra spaces from text',
    ],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '6',
    text: 'What does the SUM function do?',
    category: 'Formulas',
    options: ['Adds values in a range', 'Multiplies values', 'Subtracts values', 'Divides values'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '7',
    text: 'Which shortcut creates an absolute reference?',
    category: 'Shortcuts',
    options: ['F4', 'F2', 'Ctrl+A', 'Alt+Enter'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '8',
    text: 'What chart type shows trends over time?',
    category: 'Charts',
    options: ['Line Chart', 'Pie Chart', 'Bar Chart', 'Scatter Plot'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '9',
    text: 'What does VLOOKUP search for?',
    category: 'Formulas',
    options: ['Value in first column', 'Value in last column', 'Value in any column', 'Value in header'],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '10',
    text: 'How to insert a new row?',
    category: 'Shortcuts',
    options: ['Ctrl+Shift++', 'Ctrl+Shift+-', 'Ctrl+R', 'Ctrl+I'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '11',
    text: 'Which function counts cells that meet one condition?',
    category: 'Formulas',
    options: ['COUNTIF', 'COUNTA', 'COUNTBLANK', 'SUMIF'],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '12',
    text: 'Which shortcut opens the Format Cells dialog?',
    category: 'Shortcuts',
    options: ['Ctrl+1', 'Ctrl+5', 'Ctrl+9', 'Alt+F1'],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '13',
    text: 'Which chart is best to compare parts of a whole at one point in time?',
    category: 'Charts',
    options: ['Pie Chart', 'Line Chart', 'Scatter Plot', 'Histogram'],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '14',
    text: 'Which function returns the current date?',
    category: 'Formulas',
    options: ['TODAY()', 'TIME()', 'DATEVALUE()', 'NOW()'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '15',
    text: 'What is the shortcut to copy selected cells?',
    category: 'Shortcuts',
    options: ['Ctrl+C', 'Ctrl+X', 'Ctrl+V', 'Ctrl+Shift+C'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: '16',
    text: 'Which chart type is ideal for distribution frequency?',
    category: 'Charts',
    options: ['Histogram', 'Pie Chart', 'Area Chart', 'Radar Chart'],
    correctAnswer: 0,
    difficulty: 3,
  },
  {
    id: '17',
    text: 'Which formula would return the largest value in A1:A10?',
    category: 'Formulas',
    options: ['=MAX(A1:A10)', '=TOP(A1:A10)', '=HIGH(A1:A10)', '=LARGE(A1:A10)'],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '18',
    text: 'Which shortcut repeats the previous action?',
    category: 'Shortcuts',
    options: ['F4', 'F2', 'Ctrl+Y', 'Ctrl+R'],
    correctAnswer: 0,
    difficulty: 3,
  },
  {
    id: '19',
    text: 'Which chart should you use to show relationship between two numeric variables?',
    category: 'Charts',
    options: ['Scatter Plot', 'Pie Chart', 'Stacked Bar', 'Doughnut'],
    correctAnswer: 0,
    difficulty: 2,
  },
  {
    id: '20',
    text: 'Which function joins text from multiple cells?',
    category: 'Formulas',
    options: ['TEXTJOIN', 'SPLIT', 'TRIM', 'VALUE'],
    correctAnswer: 0,
    difficulty: 3,
  },
]

function QuizPageContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const retakeToken = searchParams.get('attempt') ?? ''
  const batchId = searchParams.get('batchId') ?? searchParams.get('batch') ?? ''
  const source = searchParams.get('source') ?? 'web'
  const [questions, setQuestions] = useState<Question[]>([])
  const [survey, setSurvey] = useState<QuizSurvey | null>(null)
  const [surveyLoading, setSurveyLoading] = useState(true)
  const [batchInfo, setBatchInfo] = useState<QuizBatch | null>(null)
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestionIndex: 0,
    selectedAnswers: [],
    score: 0,
    isCompleted: false,
    startTime: null,
    endTime: null,
    expiresAt: null,
  })
  const [quizLoading, setQuizLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(SESSION_SECONDS)
  const completionGuard = useRef(false)

  const initializeQuizSession = (questionPool: Question[], bankKey?: string) => {
    const randomizedQuestions = prepareQuizQuestions(questionPool, QUIZ_LENGTH)
    const selectedQuestions = ensureMinimumQuestionPool(randomizedQuestions, QUIZ_LENGTH).slice(0, QUIZ_LENGTH)
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)

    if (bankKey) {
      setCachedQuestionBank(bankKey, selectedQuestions)
    }

    setQuestions(selectedQuestions)
    setCurrentPage(0)
    setQuizState({
      currentQuestionIndex: 0,
      selectedAnswers: new Array(selectedQuestions.length).fill(null),
      score: 0,
      isCompleted: false,
      startTime: new Date(),
      endTime: null,
      expiresAt,
    })
    setTimeRemaining(SESSION_SECONDS)
    completionGuard.current = false
  }

  const initializeQuizSessionFromBank = (bankQuestions: Question[]) => {
    const selectedQuestions = ensureMinimumQuestionPool(bankQuestions, QUIZ_LENGTH).slice(0, QUIZ_LENGTH)
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)

    setQuestions(selectedQuestions)
    setCurrentPage(0)
    setQuizState({
      currentQuestionIndex: 0,
      selectedAnswers: new Array(selectedQuestions.length).fill(null),
      score: 0,
      isCompleted: false,
      startTime: new Date(),
      endTime: null,
      expiresAt,
    })
    setTimeRemaining(SESSION_SECONDS)
    completionGuard.current = false
  }

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      router.push('/')
      return
    }

    const fetchQuestions = async () => {
      try {
        const attemptKey = retakeToken || Date.now().toString()
        let activeSurvey = getStoredSurvey()
        if (batchId) {
          const batchSnap = await getDoc(doc(db, 'quizBatches', batchId))
          if (batchSnap.exists()) {
            const data = batchSnap.data() as Partial<QuizBatch>
            const levels = Array.isArray(data.difficultyLevels)
              ? data.difficultyLevels
                  .map((level) => Number(level))
                  .filter((level): level is 1 | 2 | 3 | 4 | 5 => [1, 2, 3, 4, 5].includes(level))
              : []

            const batchSurvey: QuizSurvey = {
              usageFrequency: 'Mostly',
              selfAssessment: 'Intermediate',
              difficultyLevels: levels.length > 0 ? levels : [2],
              difficultyLabel:
                typeof data.difficultyLabel === 'string' ? data.difficultyLabel : 'Administered Batch',
            }

            setBatchInfo({
              id: batchSnap.id,
              name: typeof data.name === 'string' ? data.name : 'Administered Batch',
              difficultyLevels: batchSurvey.difficultyLevels,
              difficultyLabel: batchSurvey.difficultyLabel,
              invitees: Array.isArray(data.invitees) ? data.invitees.map(String) : [],
              createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'admin',
              createdAt:
                data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt
                  ? (data.createdAt as { toDate: () => Date }).toDate()
                  : new Date(),
            })

            activeSurvey = batchSurvey
            setSurvey(batchSurvey)
            setSurveyLoading(false)
          } else {
            setBatchInfo(null)
          }
        }

        if (!activeSurvey) {
          router.push(`/quiz/survey?attempt=${retakeToken || Date.now()}`)
          setSurveyLoading(false)
          return
        }

        if (!batchId) {
          setSurvey(activeSurvey)
          setSurveyLoading(false)
        }

        const difficultyKey = buildDifficultyKey(activeSurvey.difficultyLevels)
        const bankKey = batchId ? `batch:${batchId}:${attemptKey}` : `attempt:${attemptKey}`

        const cachedBank = getCachedQuestionBank(bankKey)
        if (cachedBank) {
          initializeQuizSessionFromBank(cachedBank)
          setLoadWarning(null)
          setQuizLoading(false)
          return
        }

        const cachedQuestions = getCachedQuestions(difficultyKey)
        if (cachedQuestions && cachedQuestions.length >= QUIZ_LENGTH) {
          initializeQuizSession(cachedQuestions, bankKey)
          setLoadWarning('Loaded questions from local cache for faster startup.')
          setQuizLoading(false)
          return
        }

        const questionsRef = collection(db, 'questions')
        const allowedLevels = new Set(activeSurvey.difficultyLevels)
        const primarySnapshot = await getDocs(
          query(
            questionsRef,
            where('status', '==', 'active'),
            where('difficulty', 'in', Array.from(allowedLevels)),
            limit(QUIZ_LENGTH * 3)
          )
        )

        const primaryQuestions: Question[] = []
        primarySnapshot.forEach((doc) => {
          const parsed = toValidQuestion({ id: doc.id, ...doc.data() }, doc.id)
          if (parsed) {
            primaryQuestions.push(parsed)
          }
        })

        const secondaryQuestions: Question[] = []
        if (primaryQuestions.length < QUIZ_LENGTH) {
          const secondarySnapshot = await getDocs(
            query(questionsRef, where('status', '==', 'active'), limit(QUIZ_LENGTH * 4))
          )
          secondarySnapshot.forEach((doc) => {
            const parsed = toValidQuestion({ id: doc.id, ...doc.data() }, doc.id)
            if (parsed) {
              secondaryQuestions.push(parsed)
            }
          })
        }

        const combinedById = new Map<string, Question>()
        primaryQuestions.forEach((question) => combinedById.set(question.id, question))
        secondaryQuestions.forEach((question) => {
          if (!combinedById.has(question.id)) {
            combinedById.set(question.id, question)
          }
        })

        const combinedQuestions = Array.from(combinedById.values())
        const fallbackPrimary = fallbackQuestions.filter((question) => allowedLevels.has(question.difficulty))
        const fallbackSecondary = fallbackQuestions.filter((question) => !allowedLevels.has(question.difficulty))

        setCachedQuestions(difficultyKey, combinedQuestions)

        const basePool = [...combinedQuestions, ...fallbackPrimary]
        const expandedPool =
          basePool.length >= QUIZ_LENGTH ? basePool : [...basePool, ...fallbackSecondary]
        const availableQuestions = ensureMinimumQuestionPool(expandedPool, QUIZ_LENGTH)
        initializeQuizSession(availableQuestions, bankKey)
        if (primaryQuestions.length < QUIZ_LENGTH) {
          setLoadWarning(
            `Not enough ${activeSurvey.difficultyLabel} questions found. Added mixed-difficulty questions to complete this ${QUIZ_LENGTH}-question quiz.`
          )
        } else {
          setLoadWarning(null)
        }
      } catch (error) {
        console.error('Error fetching questions:', error)
        initializeQuizSession(fallbackQuestions)
        setLoadWarning('Firestore questions could not be loaded. You are currently using fallback questions.')
      } finally {
        setQuizLoading(false)
      }
    }

    void fetchQuestions()
  }, [authLoading, user, router, retakeToken, batchId])

  useEffect(() => {
    const expiresAt = quizState.expiresAt
    if (!expiresAt || quizState.isCompleted || quizLoading) {
      return
    }

    const tick = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((expiresAt.getTime() - Date.now()) / 1000)
      )
      setTimeRemaining(remainingSeconds)
      if (remainingSeconds === 0 && !completionGuard.current) {
        completionGuard.current = true
        void handleQuizComplete()
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [quizState.expiresAt, quizState.isCompleted, quizLoading, questions.length])

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setQuizState((previous) => {
      const nextAnswers = [...previous.selectedAnswers]
      nextAnswers[questionIndex] = answerIndex

      return {
        ...previous,
        selectedAnswers: nextAnswers,
      }
    })
  }

  const handleQuizComplete = async () => {
    if (!user) {
      router.push('/')
      return
    }

    const surveySnapshot = survey ?? getStoredSurvey()
    const endTime = new Date()
    const score = calculateLiveScore(questions, quizState.selectedAnswers)
    setQuizState((previous) => ({ ...previous, score, isCompleted: true, endTime }))

    const categoryScores: Record<string, number> = {}
    const wrongCategories: string[] = []

    questions.forEach((question, index) => {
      if (quizState.selectedAnswers[index] === question.correctAnswer) {
        categoryScores[question.category] = (categoryScores[question.category] || 0) + 1
      } else if (!wrongCategories.includes(question.category)) {
        wrongCategories.push(question.category)
      }
    })

    const attemptPayload = {
      userId: user.uid,
      batchId: batchInfo?.id ?? (batchId || undefined),
      source,
      score,
      totalQuestions: questions.length,
      correctAnswers: score / 10,
      survey: surveySnapshot ?? undefined,
      categoryScores,
      wrongCategories,
      date: endTime,
      questions: questions.map((question, index) => ({
        ...question,
        userAnswer: quizState.selectedAnswers[index],
        isCorrect: quizState.selectedAnswers[index] === question.correctAnswer,
      })),
    }

    localStorage.setItem('quizResults', JSON.stringify(attemptPayload))

    try {
      await addDoc(collection(db, 'quizAttempts'), attemptPayload)
    } catch (error) {
      // Keep quiz completion resilient even if persistence fails.
      console.error('Failed to save quiz attempt to Firestore:', error)
    }

    router.push('/quiz/results')
  }

  const handlePreviousPage = () => {
    if (currentPage === 0) {
      return
    }

    const previousPage = currentPage - 1
    setCurrentPage(previousPage)
    setQuizState((previous) => ({
      ...previous,
      currentQuestionIndex: previousPage * QUESTIONS_PER_PAGE,
    }))
  }

  useEffect(() => {
    if (questions.length === 0) {
      return
    }

    const maxPage = Math.max(0, Math.ceil(questions.length / QUESTIONS_PER_PAGE) - 1)
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
      setQuizState((previous) => ({
        ...previous,
        currentQuestionIndex: maxPage * QUESTIONS_PER_PAGE,
      }))
    }
  }, [questions.length, currentPage])

  const handleNextPage = () => {
    const pageStart = currentPage * QUESTIONS_PER_PAGE
    const pageEnd = Math.min(pageStart + QUESTIONS_PER_PAGE, questions.length)
    const pageAnswered = quizState.selectedAnswers.slice(pageStart, pageEnd).every((answer) => answer !== null)

    if (!pageAnswered) {
      return
    }

    const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE)
    if (currentPage >= totalPages - 1) {
      void handleQuizComplete()
      return
    }

    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    setQuizState((previous) => ({
      ...previous,
      currentQuestionIndex: nextPage * QUESTIONS_PER_PAGE,
    }))
  }

  useEffect(() => {
    if (authLoading || quizLoading || !user || questions.length === 0) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        handleNextPage()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [authLoading, quizLoading, user, questions, quizState.selectedAnswers, currentPage])

  if (authLoading || surveyLoading || quizLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f7f5] py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="card text-center">
              <h2 className="text-2xl font-semibold mb-3">No Questions Available</h2>
              <p className="text-gray-600 mb-6">
                We could not load any active questions. Please try again later or contact an admin.
              </p>
              <button onClick={() => router.push('/')} className="btn-secondary">
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const answeredCount = quizState.selectedAnswers.filter((answer) => answer !== null).length
  const liveScore = calculateLiveScore(questions, quizState.selectedAnswers)
  const totalPages = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages - 1)
  const pageStartIndex = safeCurrentPage * QUESTIONS_PER_PAGE
  const pageEndIndex = Math.min(pageStartIndex + QUESTIONS_PER_PAGE, questions.length)
  const pageQuestions = questions.slice(pageStartIndex, pageEndIndex)
  const answeredProgressPercent = Math.round((answeredCount / questions.length) * 100)
  const pageProgressPercent = Math.round(((safeCurrentPage + 1) / totalPages) * 100)
  const allCurrentPageAnswered = quizState.selectedAnswers
    .slice(pageStartIndex, pageEndIndex)
    .every((answer) => answer !== null)
  const isLastPage = safeCurrentPage === totalPages - 1
  const minutesRemaining = Math.floor(timeRemaining / 60)
  const secondsRemaining = timeRemaining % 60
  const timerDisplay = `${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-[#eef2f6] py-6 md:py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-5">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] shadow-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#5dd6cf]/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#8fb8ff]/20 blur-3xl" />
            <div className="relative px-6 py-5 md:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#c8e8ff]">Active Assessment</p>
                  <h1 className="mt-1 text-2xl font-bold text-white">Excel Quiz Session</h1>
                  <p className="mt-1 text-sm text-[#d6ebff]">
                    Questions {pageStartIndex + 1}-{pageEndIndex} of {questions.length} · Answered {answeredCount}/{questions.length}
                  </p>
                </div>
                <div className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-right backdrop-blur-sm sm:w-auto">
                  <p className="text-xs uppercase tracking-wide text-[#d6ebff]">Live Score</p>
                  <p className="text-3xl font-bold text-white">{liveScore}</p>
                </div>
                <div className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-right backdrop-blur-sm sm:w-auto">
                  <p className="text-xs uppercase tracking-wide text-[#d6ebff]">Time Remaining</p>
                  <p className="text-3xl font-bold text-white">{timerDisplay}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-3 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-[#73d8ca]" style={{ width: `${answeredProgressPercent}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#d6ebff]">
                  <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">Answered {answeredProgressPercent}%</span>
                  <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">Page {safeCurrentPage + 1}/{totalPages}</span>
                  <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">Page Progress {pageProgressPercent}%</span>
                  <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">Questions shuffled</span>
                  <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">Answers shuffled</span>
                  {survey && (
                    <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">
                      Difficulty: {survey.difficultyLabel}
                    </span>
                  )}
                  {batchInfo && (
                    <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">
                      Batch: {batchInfo.name}
                    </span>
                  )}
                  {retakeToken && <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">Session {retakeToken.slice(-6)}</span>}
                </div>
              </div>

              {loadWarning && (
                <p className="mt-3 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {loadWarning}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-7">
            <div className="space-y-6">
              {pageQuestions.map((question, pageQuestionIndex) => {
                const absoluteQuestionIndex = pageStartIndex + pageQuestionIndex
                const selectedAnswer = quizState.selectedAnswers[absoluteQuestionIndex]

                return (
                  <article
                    key={`${question.id}-${absoluteQuestionIndex}`}
                    className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4 md:p-5"
                  >
                    <h2 className="quiz-question !mb-3 !text-xl">
                      <span className="text-[#16436c]">Question {absoluteQuestionIndex + 1}:</span>{' '}
                      {question.text}
                    </h2>

                    <p className="mb-4 text-sm font-semibold text-[#2e4d70]">
                      Category : {question.category}, Difficulty : {difficultyLabel[question.difficulty]}
                    </p>

                    {question.imageUrl && (
                      <div className="mb-6 overflow-hidden rounded-lg border border-[#dce6df] bg-[#f9fbfa]">
                        <img
                          src={question.imageUrl}
                          alt="Question reference"
                          className="h-auto max-h-72 w-full object-contain"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      {question.options.map((option, optionIndex) => (
                        <label
                          key={`${question.id}-option-${optionIndex}`}
                          className={`quiz-option block ${selectedAnswer === optionIndex ? 'selected' : ''}`}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}
                        >
                          <input
                            type="radio"
                            name={`question-${absoluteQuestionIndex}`}
                            value={optionIndex}
                            checked={selectedAnswer === optionIndex}
                            onChange={() => handleAnswerSelect(absoluteQuestionIndex, optionIndex)}
                            style={{ marginTop: '0.15rem' }}
                          />
                          <span className="option-letter">{String.fromCharCode(65 + optionIndex)}.</span>
                          <span className="option-text">{option}</span>
                        </label>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>

            <p className="mt-5 text-xs text-[#5d776a]">
              Answer all {QUESTIONS_PER_PAGE} questions on this page, then press <span className="font-semibold">Enter</span> or click{' '}
              <span className="font-semibold">{isLastPage ? 'Finish Quiz' : `Next ${QUESTIONS_PER_PAGE} Questions`}</span>.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex w-full flex-wrap gap-3 md:w-auto">
                <button onClick={() => router.push('/')} className="btn-secondary w-full sm:w-auto">
                  Exit Quiz
                </button>
                <button onClick={handlePreviousPage} disabled={safeCurrentPage === 0} className="btn-secondary w-full sm:w-auto">
                  Previous {QUESTIONS_PER_PAGE} Questions
                </button>
              </div>
              <button onClick={handleNextPage} disabled={!allCurrentPageAnswered} className="btn-primary w-full sm:w-auto">
                {isLastPage ? 'Finish Quiz' : `Next ${QUESTIONS_PER_PAGE} Questions`}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
        </div>
      }
    >
      <QuizPageContent />
    </Suspense>
  )
}
