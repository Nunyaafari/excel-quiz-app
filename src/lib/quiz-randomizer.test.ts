import { describe, expect, it } from 'vitest'
import { Question } from '@/types'
import { prepareQuizQuestions } from './quiz-randomizer'

const sampleQuestions: Question[] = [
  {
    id: 'q1',
    text: 'Question 1',
    category: 'Formulas',
    options: ['A1', 'B1', 'C1', 'D1'],
    correctAnswer: 2,
    difficulty: 2,
  },
  {
    id: 'q2',
    text: 'Question 2',
    category: 'Charts',
    options: ['A2', 'B2', 'C2', 'D2'],
    correctAnswer: 0,
    difficulty: 1,
  },
  {
    id: 'q3',
    text: 'Question 3',
    category: 'Formatting',
    options: ['A3', 'B3', 'C3', 'D3'],
    correctAnswer: 3,
    difficulty: 4,
  },
]

describe('prepareQuizQuestions', () => {
  it('returns requested count without mutating source', () => {
    const sourceSnapshot = JSON.parse(JSON.stringify(sampleQuestions))
    const prepared = prepareQuizQuestions(sampleQuestions, 2)

    expect(prepared).toHaveLength(2)
    expect(sampleQuestions).toEqual(sourceSnapshot)
  })

  it('caps question count to available pool and keeps unique ids', () => {
    const prepared = prepareQuizQuestions(sampleQuestions, 20)
    const ids = prepared.map((question) => question.id)

    expect(prepared).toHaveLength(sampleQuestions.length)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('preserves correct answer text after option shuffle', () => {
    const prepared = prepareQuizQuestions(sampleQuestions, 3)

    prepared.forEach((question) => {
      const original = sampleQuestions.find((item) => item.id === question.id)
      expect(original).toBeDefined()
      if (!original) {
        return
      }

      const originalCorrectOption = original.options[original.correctAnswer]
      expect(question.options[question.correctAnswer]).toBe(originalCorrectOption)
    })
  })

  it('supports deterministic random function for stable shuffle output', () => {
    const deterministicValues = [0.9, 0.2, 0.7, 0.5, 0.3, 0.1, 0.8, 0.4, 0.6]
    let pointer = 0
    const deterministicRandom = () => {
      const value = deterministicValues[pointer % deterministicValues.length]
      pointer += 1
      return value
    }

    const firstRun = prepareQuizQuestions(sampleQuestions, 3, deterministicRandom)
    pointer = 0
    const secondRun = prepareQuizQuestions(sampleQuestions, 3, deterministicRandom)

    expect(secondRun).toEqual(firstRun)
  })
})
