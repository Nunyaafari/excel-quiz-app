'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import type { QuizSurvey } from '@/types'

const SURVEY_STORAGE_KEY = 'quizSurvey'

const usageOptions: QuizSurvey['usageFrequency'][] = ['Rarely', 'As needed', 'Mostly', 'Newbie']
const selfAssessmentOptions: QuizSurvey['selfAssessment'][] = ['Novice', 'Intermediate', 'Advanced', 'Legend']

const difficultyMap: Record<QuizSurvey['selfAssessment'], QuizSurvey['difficultyLevels']> = {
  Novice: [1],
  Intermediate: [2],
  Advanced: [3],
  Legend: [4, 5],
}

const difficultyLabelMap: Record<QuizSurvey['selfAssessment'], string> = {
  Novice: 'Novice (Level 1)',
  Intermediate: 'Intermediate (Level 2)',
  Advanced: 'Advanced (Level 3)',
  Legend: 'Legend (Levels 4-5)',
}

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
      difficultyLevels: parsed.difficultyLevels ?? difficultyMap[parsed.selfAssessment],
      difficultyLabel: parsed.difficultyLabel ?? difficultyLabelMap[parsed.selfAssessment],
    }
  } catch {
    return null
  }
}

export default function QuizSurveyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const attemptToken = searchParams.get('attempt')
  const source = searchParams.get('source') ?? ''
  const [usageFrequency, setUsageFrequency] = useState<QuizSurvey['usageFrequency']>('Rarely')
  const [selfAssessment, setSelfAssessment] = useState<QuizSurvey['selfAssessment']>('Novice')

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      router.push('/')
      return
    }

    const stored = getStoredSurvey()
    if (stored) {
      setUsageFrequency(stored.usageFrequency)
      setSelfAssessment(stored.selfAssessment)
    }
  }, [loading, user, router])

  const handleContinue = () => {
    const survey: QuizSurvey = {
      usageFrequency,
      selfAssessment,
      difficultyLevels: difficultyMap[selfAssessment],
      difficultyLabel: difficultyLabelMap[selfAssessment],
    }

    window.localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(survey))
    const nextAttempt = attemptToken || Date.now().toString()
    const sourceParam = source ? `&source=${encodeURIComponent(source)}` : ''
    router.push(`/quiz?attempt=${nextAttempt}${sourceParam}`)
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

  return (
    <div className="min-h-screen bg-[#eef2f6] py-6 md:py-10">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">Quick Survey</p>
            <h1 className="mt-2 text-3xl font-bold text-[#142842]">Tailor Your Quiz Difficulty</h1>
            <p className="mt-2 text-sm text-[#5a6f8a]">
              Two quick questions help us pick the right question difficulty for you.
            </p>

            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm font-semibold text-[#1e3757]">How often do you use MS Excel?</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {usageOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setUsageFrequency(option)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        usageFrequency === option
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-[#dbe5f1] bg-white text-[#1e3757] hover:bg-[#f3f7ff]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#1e3757]">How would you assess your current Excel knowledge?</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selfAssessmentOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelfAssessment(option)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        selfAssessment === option
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-[#dbe5f1] bg-white text-[#1e3757] hover:bg-[#f3f7ff]'
                      }`}
                    >
                      {option}
                      <span className="mt-1 block text-xs font-medium text-[#5a6f8a]">
                        {difficultyLabelMap[option]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => router.push('/')} className="btn-secondary w-full sm:w-auto">
                Back to Home
              </button>
              <button onClick={handleContinue} className="btn-primary w-full sm:w-auto">
                Continue to Quiz
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
