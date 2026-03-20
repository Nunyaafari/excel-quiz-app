'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuizSession } from '@/hooks/useQuizSession'
import { QUESTIONS_PER_PAGE, calculateLiveScore, difficultyLabel, formatTimerDisplay } from '@/lib/quiz-session'

function QuizLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
    </div>
  )
}

function QuizEmptyState({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-screen bg-[#f4f7f5] py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="card text-center">
            <h2 className="text-2xl font-semibold mb-3">No Questions Available</h2>
            <p className="text-gray-600 mb-6">
              We could not load any active questions. Please try again later or contact an admin.
            </p>
            <button onClick={onExit} className="btn-secondary">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuizPageContent() {
  const searchParams = useSearchParams()
  const retakeToken = searchParams.get('attempt') ?? ''
  const batchId = searchParams.get('batchId') ?? searchParams.get('batch') ?? ''
  const source = searchParams.get('source') ?? 'web'

  const {
    user,
    authLoading,
    quizLoading,
    surveyLoading,
    questions,
    survey,
    batchInfo,
    quizState,
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
  } = useQuizSession({
    batchId,
    retakeToken,
    source,
  })

  if (authLoading || surveyLoading || quizLoading) {
    return <QuizLoadingScreen />
  }

  if (!user) {
    return null
  }

  if (questions.length === 0) {
    return <QuizEmptyState onExit={handleExitQuiz} />
  }

  const liveScore = calculateLiveScore(questions, quizState.selectedAnswers)
  const answeredProgressPercent = Math.round((answeredCount / questions.length) * 100)
  const pageProgressPercent = Math.round(((safeCurrentPage + 1) / totalPages) * 100)
  const timerDisplay = formatTimerDisplay(timeRemaining)

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
                  {retakeToken && (
                    <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1">
                      Session {retakeToken.slice(-6)}
                    </span>
                  )}
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
                <button onClick={handleExitQuiz} className="btn-secondary w-full sm:w-auto">
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
    <Suspense fallback={<QuizLoadingScreen />}>
      <QuizPageContent />
    </Suspense>
  )
}
