import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from 'firebase/firestore'
import { prepareQuizQuestions } from '@/lib/quiz-randomizer'
import {
  type Question,
  type QuestionCategory,
  type QuizBatch,
  type QuizDifficulty,
  type QuizState,
  type QuizSurvey,
  isQuestionCategory,
} from '@/types'

export const QUIZ_LENGTH = 20
export const QUESTIONS_PER_PAGE = 5
export const SESSION_SECONDS = 10 * 60

const SURVEY_STORAGE_KEY = 'quizSurvey'
const QUESTION_CACHE_PREFIX = 'quizQuestionCache'
const QUESTION_BANK_PREFIX = 'quizQuestionBank'
const QUESTION_CACHE_TTL_MS = 10 * 60 * 1000
const QUESTION_BANK_TTL_MS = 4 * 60 * 60 * 1000

export const difficultyLabel: Record<QuizDifficulty, string> = {
  1: 'Easy',
  2: 'Easy+',
  3: 'Medium',
  4: 'Hard',
  5: 'Expert',
}

export interface LoadQuizSessionDataResult {
  survey: QuizSurvey | null
  batchInfo: QuizBatch | null
  questions: Question[]
  loadWarning: string | null
  shouldRedirectToSurvey: boolean
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function getStoredSurvey(): QuizSurvey | null {
  if (!isBrowser()) {
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

function buildDifficultyKey(levels: QuizDifficulty[]): string {
  return levels.slice().sort((left, right) => left - right).join('-')
}

function getCachedQuestions(key: string): Question[] | null {
  if (!isBrowser()) {
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
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(
    `${QUESTION_CACHE_PREFIX}:${key}`,
    JSON.stringify({
      timestamp: Date.now(),
      questions: questions.slice(0, 300),
    })
  )
}

function getCachedQuestionBank(key: string): Question[] | null {
  if (!isBrowser()) {
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
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(
    `${QUESTION_BANK_PREFIX}:${key}`,
    JSON.stringify({
      timestamp: Date.now(),
      questions,
    })
  )
}

export function calculateLiveScore(questions: Question[], selectedAnswers: Array<number | null>): number {
  return questions.reduce((total, question, index) => {
    return selectedAnswers[index] === question.correctAnswer ? total + 10 : total
  }, 0)
}

export function formatTimerDisplay(timeRemaining: number): string {
  const minutesRemaining = Math.floor(timeRemaining / 60)
  const secondsRemaining = timeRemaining % 60
  return `${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')}`
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

  const category = isQuestionCategory(data.category) ? data.category : 'Formulas'
  const parsedDifficulty = Number.parseInt(String(data.difficulty ?? 3), 10)
  const difficulty = (
    parsedDifficulty >= 1 && parsedDifficulty <= 5 ? parsedDifficulty : 3
  ) as QuizDifficulty

  const parsedCorrectAnswer = Number.parseInt(String(data.correctAnswer ?? 0), 10)
  const correctAnswer =
    Number.isNaN(parsedCorrectAnswer) ||
    parsedCorrectAnswer < 0 ||
    parsedCorrectAnswer >= rawOptions.length
      ? 0
      : parsedCorrectAnswer

  return {
    id: typeof data.id === 'string' ? data.id : fallbackId,
    text,
    category,
    options: rawOptions,
    correctAnswer,
    difficulty,
    imageUrl:
      typeof data.imageUrl === 'string' && data.imageUrl.trim().length > 0
        ? data.imageUrl.trim()
        : undefined,
  }
}

export function createInitialQuizState(questionCount: number): QuizState {
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)

  return {
    currentQuestionIndex: 0,
    selectedAnswers: new Array(questionCount).fill(null),
    score: 0,
    isCompleted: false,
    startTime: new Date(),
    endTime: null,
    expiresAt,
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

function normalizeDifficultyLevels(value: unknown): QuizDifficulty[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((level) => Number(level))
    .filter((level): level is QuizDifficulty => [1, 2, 3, 4, 5].includes(level))
}

function toDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate()
  }

  return new Date()
}

function buildSessionQuestions(questionPool: Question[], bankKey?: string): Question[] {
  const randomizedQuestions = prepareQuizQuestions(questionPool, QUIZ_LENGTH)
  const selectedQuestions = ensureMinimumQuestionPool(randomizedQuestions, QUIZ_LENGTH).slice(0, QUIZ_LENGTH)

  if (bankKey) {
    setCachedQuestionBank(bankKey, selectedQuestions)
  }

  return selectedQuestions
}

function hydrateSessionQuestions(questions: Question[]): Question[] {
  return ensureMinimumQuestionPool(questions, QUIZ_LENGTH).slice(0, QUIZ_LENGTH)
}

async function loadBatchSurvey(db: Firestore, batchId: string): Promise<{ survey: QuizSurvey; batchInfo: QuizBatch } | null> {
  const batchSnapshot = await getDoc(doc(db, 'quizBatches', batchId))
  if (!batchSnapshot.exists()) {
    return null
  }

  const data = batchSnapshot.data() as Partial<QuizBatch>
  const difficultyLevels = normalizeDifficultyLevels(data.difficultyLevels)

  const survey: QuizSurvey = {
    usageFrequency: 'Mostly',
    selfAssessment: 'Intermediate',
    difficultyLevels: difficultyLevels.length > 0 ? difficultyLevels : [2],
    difficultyLabel:
      typeof data.difficultyLabel === 'string' ? data.difficultyLabel : 'Administered Batch',
  }

  const batchInfo: QuizBatch = {
    id: batchSnapshot.id,
    name: typeof data.name === 'string' ? data.name : 'Administered Batch',
    difficultyLevels: survey.difficultyLevels,
    difficultyLabel: survey.difficultyLabel,
    invitees: Array.isArray(data.invitees) ? data.invitees.map(String) : [],
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'admin',
    createdAt: toDate(data.createdAt),
  }

  return { survey, batchInfo }
}

export async function loadQuizSessionData(options: {
  db: Firestore
  batchId: string
  retakeToken: string
}): Promise<LoadQuizSessionDataResult> {
  const { db, batchId, retakeToken } = options

  let survey = getStoredSurvey()
  let batchInfo: QuizBatch | null = null

  if (batchId) {
    const batchResult = await loadBatchSurvey(db, batchId)
    if (batchResult) {
      survey = batchResult.survey
      batchInfo = batchResult.batchInfo
    }
  }

  if (!survey) {
    return {
      survey: null,
      batchInfo,
      questions: [],
      loadWarning: null,
      shouldRedirectToSurvey: true,
    }
  }

  const attemptKey = retakeToken || Date.now().toString()
  const difficultyKey = buildDifficultyKey(survey.difficultyLevels)
  const bankKey = batchId ? `batch:${batchId}:${attemptKey}` : `attempt:${attemptKey}`

  const cachedBank = getCachedQuestionBank(bankKey)
  if (cachedBank) {
    return {
      survey,
      batchInfo,
      questions: hydrateSessionQuestions(cachedBank),
      loadWarning: null,
      shouldRedirectToSurvey: false,
    }
  }

  const cachedQuestions = getCachedQuestions(difficultyKey)
  if (cachedQuestions && cachedQuestions.length >= QUIZ_LENGTH) {
    return {
      survey,
      batchInfo,
      questions: buildSessionQuestions(cachedQuestions, bankKey),
      loadWarning: 'Loaded questions from local cache for faster startup.',
      shouldRedirectToSurvey: false,
    }
  }

  try {
    const questionsRef = collection(db, 'questions')
    const allowedLevels = new Set(survey.difficultyLevels)

    const primarySnapshot = await getDocs(
      query(
        questionsRef,
        where('status', '==', 'active'),
        where('difficulty', 'in', Array.from(allowedLevels)),
        limit(QUIZ_LENGTH * 3)
      )
    )

    const primaryQuestions: Question[] = []
    primarySnapshot.forEach((snapshot: any) => {
      const parsedQuestion = toValidQuestion({ id: snapshot.id, ...snapshot.data() }, snapshot.id)
      if (parsedQuestion) {
        primaryQuestions.push(parsedQuestion)
      }
    })

    const secondaryQuestions: Question[] = []
    if (primaryQuestions.length < QUIZ_LENGTH) {
      const secondarySnapshot = await getDocs(
        query(questionsRef, where('status', '==', 'active'), limit(QUIZ_LENGTH * 4))
      )

      secondarySnapshot.forEach((snapshot: any) => {
        const parsedQuestion = toValidQuestion({ id: snapshot.id, ...snapshot.data() }, snapshot.id)
        if (parsedQuestion) {
          secondaryQuestions.push(parsedQuestion)
        }
      })
    }

    const combinedQuestionsById = new Map<string, Question>()
    primaryQuestions.forEach((question) => combinedQuestionsById.set(question.id, question))
    secondaryQuestions.forEach((question) => {
      if (!combinedQuestionsById.has(question.id)) {
        combinedQuestionsById.set(question.id, question)
      }
    })

    const combinedQuestions = Array.from(combinedQuestionsById.values())
    setCachedQuestions(difficultyKey, combinedQuestions)

    const fallbackPrimary = fallbackQuestions.filter((question) => allowedLevels.has(question.difficulty))
    const fallbackSecondary = fallbackQuestions.filter((question) => !allowedLevels.has(question.difficulty))
    const primaryPool = [...combinedQuestions, ...fallbackPrimary]
    const expandedPool = primaryPool.length >= QUIZ_LENGTH ? primaryPool : [...primaryPool, ...fallbackSecondary]
    const questions = buildSessionQuestions(ensureMinimumQuestionPool(expandedPool, QUIZ_LENGTH), bankKey)

    const loadWarning =
      primaryQuestions.length < QUIZ_LENGTH
        ? `Not enough ${survey.difficultyLabel} questions found. Added mixed-difficulty questions to complete this ${QUIZ_LENGTH}-question quiz.`
        : null

    return {
      survey,
      batchInfo,
      questions,
      loadWarning,
      shouldRedirectToSurvey: false,
    }
  } catch (error) {
    console.error('Error fetching questions:', error)

    return {
      survey,
      batchInfo,
      questions: buildSessionQuestions(fallbackQuestions),
      loadWarning: 'Firestore questions could not be loaded. You are currently using fallback questions.',
      shouldRedirectToSurvey: false,
    }
  }
}

export async function saveQuizAttempt(options: {
  db: Firestore
  userId: string
  batchId: string
  source: string
  batchInfo: QuizBatch | null
  survey: QuizSurvey | null
  questions: Question[]
  selectedAnswers: Array<number | null>
  endTime: Date
}): Promise<void> {
  const { db, userId, batchId, source, batchInfo, survey, questions, selectedAnswers, endTime } = options
  const score = calculateLiveScore(questions, selectedAnswers)
  const categoryScores: Record<string, number> = {}
  const wrongCategories = new Set<QuestionCategory>()

  const resolvedQuestions = questions.map((question, index) => {
    const userAnswer = selectedAnswers[index] ?? null
    const isCorrect = userAnswer === question.correctAnswer

    if (isCorrect) {
      categoryScores[question.category] = (categoryScores[question.category] || 0) + 1
    } else {
      wrongCategories.add(question.category)
    }

    return {
      ...question,
      userAnswer,
      isCorrect,
    }
  })

  const attemptPayload = {
    userId,
    batchId: batchInfo?.id ?? (batchId || undefined),
    source,
    score,
    totalQuestions: questions.length,
    correctAnswers: score / 10,
    survey: survey ?? undefined,
    categoryScores,
    wrongCategories: Array.from(wrongCategories),
    date: endTime,
    questions: resolvedQuestions,
  }

  if (isBrowser()) {
    window.localStorage.setItem('quizResults', JSON.stringify(attemptPayload))
  }

  try {
    await addDoc(collection(db, 'quizAttempts'), attemptPayload)
  } catch (error) {
    console.error('Failed to save quiz attempt to Firestore:', error)
  }
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
