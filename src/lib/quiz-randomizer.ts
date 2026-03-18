import { Question } from '@/types'

type RandomFn = () => number

function shuffleArray<T>(items: T[], randomFn: RandomFn = Math.random): T[] {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(randomFn() * (index + 1))
    const temp = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = temp
  }

  return shuffled
}

function shuffleQuestionOptions(question: Question, randomFn: RandomFn): Question {
  const indexedOptions = question.options.map((option, originalIndex) => ({
    option,
    originalIndex,
  }))

  const shuffledOptions = shuffleArray(indexedOptions, randomFn)
  const remappedCorrectAnswer = shuffledOptions.findIndex(
    (item) => item.originalIndex === question.correctAnswer
  )

  return {
    ...question,
    options: shuffledOptions.map((item) => item.option),
    correctAnswer: remappedCorrectAnswer >= 0 ? remappedCorrectAnswer : 0,
  }
}

export function prepareQuizQuestions(
  questions: Question[],
  count: number,
  randomFn: RandomFn = Math.random
): Question[] {
  const safeCount = Math.max(0, count)
  const questionsWithCopiedOptions = questions.map((question) => ({
    ...question,
    options: [...question.options],
  }))

  return shuffleArray(questionsWithCopiedOptions, randomFn)
    .slice(0, safeCount)
    .map((question) => shuffleQuestionOptions(question, randomFn))
}
