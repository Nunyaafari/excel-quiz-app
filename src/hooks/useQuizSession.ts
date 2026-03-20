'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { db } from '@/lib/firebase'
import {
  QUESTIONS_PER_PAGE,
  SESSION_SECONDS,
  createInitialQuizState,
  loadQuizSessionData,
  saveQuizAttempt,
} from '@/lib/quiz-session'
import type { Question, QuizBatch, QuizState, QuizSurvey } from '@/types'

interface UseQuizSessionOptions {
  batchId: string
  retakeToken: string
  source: string
}

interface UseQuizSessionResult {
  user: ReturnType<typeof useAuth>['user']
  authLoading: boolean
  quizLoading: boolean
  surveyLoading: boolean
  questions: Question[]
  survey: QuizSurvey | null
  batchInfo: QuizBatch | null
  quizState: QuizState
  currentPage: number
  loadWarning: string | null
  timeRemaining: number
  pageQuestions: Question[]
  totalPages: number
  safeCurrentPage: number
  pageStartIndex: number
  pageEndIndex: number
  answeredCount: number
  allCurrentPageAnswered: boolean
  isLastPage: boolean
  handleAnswerSelect: (questionIndex: number, answerIndex: number) => void
  handlePreviousPage: () => void
  handleNextPage: () => void
  handleExitQuiz: () => void
}

export function useQuizSession(options: UseQuizSessionOptions): UseQuizSessionResult {
  const { batchId, retakeToken, source } = options
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

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
  const questionsRef = useRef<Question[]>(questions)
  const quizStateRef = useRef<QuizState>(quizState)
  const surveyRef = useRef<QuizSurvey | null>(survey)
  const batchInfoRef = useRef<QuizBatch | null>(batchInfo)

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  useEffect(() => {
    quizStateRef.current = quizState
  }, [quizState])

  useEffect(() => {
    surveyRef.current = survey
  }, [survey])

  useEffect(() => {
    batchInfoRef.current = batchInfo
  }, [batchInfo])

  const initializeSessionState = useCallback((nextQuestions: Question[]) => {
    setQuestions(nextQuestions)
    setCurrentPage(0)
    setQuizState(createInitialQuizState(nextQuestions.length))
    setTimeRemaining(SESSION_SECONDS)
    completionGuard.current = false
  }, [])

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      router.push('/')
      return
    }

    const fetchSession = async () => {
      setQuizLoading(true)

      try {
        const result = await loadQuizSessionData({
          db,
          batchId,
          retakeToken,
        })

        setBatchInfo(result.batchInfo)
        setSurvey(result.survey)
        setSurveyLoading(false)

        if (result.shouldRedirectToSurvey) {
          setQuizLoading(false)
          router.push(`/quiz/survey?attempt=${retakeToken || Date.now()}`)
          return
        }

        initializeSessionState(result.questions)
        setLoadWarning(result.loadWarning)
      } catch (error) {
        console.error('Failed to initialize quiz session:', error)
        setLoadWarning('Unable to initialize the quiz session. Please try again.')
      } finally {
        setSurveyLoading(false)
        setQuizLoading(false)
      }
    }

    void fetchSession()
  }, [authLoading, user, router, batchId, retakeToken, initializeSessionState])

  const handleAnswerSelect = useCallback((questionIndex: number, answerIndex: number) => {
    setQuizState((previousState: QuizState) => {
      const nextAnswers = [...previousState.selectedAnswers]
      nextAnswers[questionIndex] = answerIndex

      return {
        ...previousState,
        selectedAnswers: nextAnswers,
      }
    })
  }, [])

  const handleQuizComplete = useCallback(async () => {
    if (!user) {
      router.push('/')
      return
    }

    const resolvedQuestions = questionsRef.current
    const resolvedState = quizStateRef.current
    const endTime = new Date()

    setQuizState((previousState: QuizState) => ({
      ...previousState,
      score: resolvedQuestions.reduce((total, question, index) => {
        return resolvedState.selectedAnswers[index] === question.correctAnswer ? total + 10 : total
      }, 0),
      isCompleted: true,
      endTime,
    }))

    await saveQuizAttempt({
      db,
      userId: user.uid,
      batchId: batchId || '',
      source,
      batchInfo: batchInfoRef.current,
      survey: surveyRef.current,
      questions: resolvedQuestions,
      selectedAnswers: resolvedState.selectedAnswers,
      endTime,
    })

    router.push('/quiz/results')
  }, [batchId, router, source, user])

  useEffect(() => {
    const expiresAt = quizState.expiresAt
    if (!expiresAt || quizState.isCompleted || quizLoading) {
      return
    }

    const tick = () => {
      const remainingSeconds = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
      setTimeRemaining(remainingSeconds)

      if (remainingSeconds === 0 && !completionGuard.current) {
        completionGuard.current = true
        void handleQuizComplete()
      }
    }

    tick()
    const timerId = window.setInterval(tick, 1000)
    return () => window.clearInterval(timerId)
  }, [quizLoading, quizState.expiresAt, quizState.isCompleted, handleQuizComplete])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE))
  }, [questions.length])

  const safeCurrentPage = useMemo(() => {
    return Math.min(currentPage, totalPages - 1)
  }, [currentPage, totalPages])

  const pageStartIndex = safeCurrentPage * QUESTIONS_PER_PAGE
  const pageEndIndex = Math.min(pageStartIndex + QUESTIONS_PER_PAGE, questions.length)
  const pageQuestions = questions.slice(pageStartIndex, pageEndIndex)
  const answeredCount = quizState.selectedAnswers.filter((answer) => answer !== null).length
  const allCurrentPageAnswered = quizState.selectedAnswers
    .slice(pageStartIndex, pageEndIndex)
    .every((answer) => answer !== null)
  const isLastPage = safeCurrentPage === totalPages - 1

  useEffect(() => {
    if (questions.length === 0) {
      return
    }

    const maxPage = Math.max(0, Math.ceil(questions.length / QUESTIONS_PER_PAGE) - 1)
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
      setQuizState((previousState: QuizState) => ({
        ...previousState,
        currentQuestionIndex: maxPage * QUESTIONS_PER_PAGE,
      }))
    }
  }, [currentPage, questions.length])

  const handlePreviousPage = useCallback(() => {
    if (safeCurrentPage === 0) {
      return
    }

    const previousPage = safeCurrentPage - 1
    setCurrentPage(previousPage)
    setQuizState((previousState: QuizState) => ({
      ...previousState,
      currentQuestionIndex: previousPage * QUESTIONS_PER_PAGE,
    }))
  }, [safeCurrentPage])

  const handleNextPage = useCallback(() => {
    const currentAnswers = quizStateRef.current.selectedAnswers
    const currentQuestions = questionsRef.current
    const currentStart = safeCurrentPage * QUESTIONS_PER_PAGE
    const currentEnd = Math.min(currentStart + QUESTIONS_PER_PAGE, currentQuestions.length)
    const pageAnswered = currentAnswers.slice(currentStart, currentEnd).every((answer) => answer !== null)

    if (!pageAnswered) {
      return
    }

    if (safeCurrentPage >= totalPages - 1) {
      if (!completionGuard.current) {
        completionGuard.current = true
        void handleQuizComplete()
      }
      return
    }

    const nextPage = safeCurrentPage + 1
    setCurrentPage(nextPage)
    setQuizState((previousState: QuizState) => ({
      ...previousState,
      currentQuestionIndex: nextPage * QUESTIONS_PER_PAGE,
    }))
  }, [handleQuizComplete, safeCurrentPage, totalPages])

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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [authLoading, handleNextPage, questions.length, quizLoading, user])

  const handleExitQuiz = useCallback(() => {
    router.push('/')
  }, [router])

  return {
    user,
    authLoading,
    quizLoading,
    surveyLoading,
    questions,
    survey,
    batchInfo,
    quizState,
    currentPage: safeCurrentPage,
    loadWarning,
    timeRemaining,
    pageQuestions,
    totalPages,
    safeCurrentPage,
    pageStartIndex,
    pageEndIndex,
    answeredCount,
    allCurrentPageAnswered,
    isLastPage,
    handleAnswerSelect,
    handlePreviousPage,
    handleNextPage,
    handleExitQuiz,
  }
}
