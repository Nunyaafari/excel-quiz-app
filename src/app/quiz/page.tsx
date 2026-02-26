'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { User, Question, QuizAttempt, QuizState } from '@/types'

export default function QuizPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestionIndex: 0,
    selectedAnswers: [],
    score: 0,
    isCompleted: false,
    startTime: null,
    endTime: null,
  })
  const [loading, setLoading] = useState(true)
  const [showFeedback, setShowFeedback] = useState(false)

  // Sample questions for MVP
  const sampleQuestions: Question[] = [
    {
      id: '1',
      text: 'What does the VLOOKUP function do?',
      category: 'Formulas',
      options: [
        'Searches for a value in the first column of a table and returns a value in the same row from a specified column',
        'Creates a pivot table from the selected data',
        'Validates data entry based on specified criteria',
        'Merges multiple cells into one'
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
        'Finds the maximum value in a range'
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
        'Removes extra spaces from text'
      ],
      correctAnswer: 0,
      difficulty: 1,
    },
  ]

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    // Initialize quiz
    const shuffledQuestions = sampleQuestions.sort(() => Math.random() - 0.5)
    const selectedQuestions = shuffledQuestions.slice(0, 5) // MVP: 5 questions
    
    setQuestions(selectedQuestions)
    setQuizState({
      currentQuestionIndex: 0,
      selectedAnswers: new Array(selectedQuestions.length).fill(null),
      score: 0,
      isCompleted: false,
      startTime: new Date(),
      endTime: null,
    })
    setLoading(false)
  }, [user, router])

  const handleAnswerSelect = (answerIndex: number) => {
    if (showFeedback) return

    const newSelectedAnswers = [...quizState.selectedAnswers]
    newSelectedAnswers[quizState.currentQuestionIndex] = answerIndex
    setQuizState({ ...quizState, selectedAnswers: newSelectedAnswers })
  }

  const handleNextQuestion = () => {
    if (quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState({
        ...quizState,
        currentQuestionIndex: quizState.currentQuestionIndex + 1,
      })
      setShowFeedback(false)
    } else {
      handleQuizComplete()
    }
  }

  const handleQuizComplete = async () => {
    const endTime = new Date()
    const newQuizState = {
      ...quizState,
      isCompleted: true,
      endTime,
    }

    setQuizState(newQuizState)

    // Calculate score
    let score = 0
    const categoryScores: Record<string, number> = {}
    const wrongCategories: string[] = []

    questions.forEach((question, index) => {
      if (newQuizState.selectedAnswers[index] === question.correctAnswer) {
        score += 10
        categoryScores[question.category] = (categoryScores[question.category] || 0) + 1
      } else {
        if (!wrongCategories.includes(question.category)) {
          wrongCategories.push(question.category)
        }
      }
    })

    // Save quiz attempt to Firestore
    if (user) {
      const quizAttempt: Omit<QuizAttempt, 'id'> = {
        userId: user.uid,
        date: new Date(),
        score,
        totalQuestions: questions.length,
        correctAnswers: score / 10,
        categoryScores,
        wrongCategories,
      }

      await setDoc(doc(db, 'quizAttempts', `${user.uid}_${Date.now()}`), quizAttempt)

      // Update user's weak categories
      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as User
        const updatedWeakCategories = Array.from(new Set([...userData.weakCategories, ...wrongCategories]))
        
        await setDoc(userRef, {
          ...userData,
          totalScore: userData.totalScore + score,
          quizAttempts: userData.quizAttempts + 1,
          weakCategories: updatedWeakCategories,
        }, { merge: true })
      }
    }

    router.push('/quiz/results')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const currentQuestion = questions[quizState.currentQuestionIndex]
  const selectedAnswer = quizState.selectedAnswers[quizState.currentQuestionIndex]
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer

  return (
    <div className="min-h-screen bg-excel-gray py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="card mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Question {quizState.currentQuestionIndex + 1} of {questions.length}</span>
              <span>Score: {quizState.score}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill bg-excel-green" 
                style={{ width: `${((quizState.currentQuestionIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Question */}
          <div className="card">
            <h2 className="quiz-question mb-6">
              {currentQuestion.text}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showFeedback}
                  className={`quiz-option text-left ${
                    selectedAnswer === index ? 'selected' : ''
                  } ${
                    showFeedback && index === currentQuestion.correctAnswer ? 'correct' : ''
                  } ${
                    showFeedback && selectedAnswer === index && !isCorrect ? 'wrong' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold mr-4">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Feedback */}
            {showFeedback && (
              <div className={`mt-6 p-4 rounded-lg ${
                isCorrect ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'
              }`}>
                <p className="font-semibold">
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </p>
                {!isCorrect && (
                  <p className="text-sm mt-2">
                    The correct answer is: {currentQuestion.options[currentQuestion.correctAnswer]}
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => router.push('/')}
                className="btn-secondary"
              >
                Exit Quiz
              </button>
              <button
                onClick={showFeedback ? handleNextQuestion : () => setShowFeedback(true)}
                disabled={selectedAnswer === null}
                className="btn-primary"
              >
                {showFeedback ? 'Next Question' : 'Submit Answer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}