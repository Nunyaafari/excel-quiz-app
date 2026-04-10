'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Question, QUESTION_CATEGORIES } from '@/types'

interface QuestionManagerProps {
  onQuestionUpdate?: () => void
}

function toFriendlyQuestionError(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'Permission denied. Ensure this account is an active admin.'
    }
    if (error.code === 'unauthenticated') {
      return 'You are signed out. Sign in with Google to manage questions.'
    }
    return error.message || 'Question action failed.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Question action failed.'
}

function parseQuestionRecord(raw: unknown, id: string): Question | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const data = raw as Partial<Question> & Record<string, unknown>
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  if (!text) {
    return null
  }

  const category = typeof data.category === 'string' && QUESTION_CATEGORIES.includes(data.category as Question['category'])
    ? (data.category as Question['category'])
    : 'Formulas'

  const options = Array.isArray(data.options)
    ? data.options.map((option) => String(option ?? '').trim()).filter(Boolean)
    : []
  if (options.length < 2) {
    return null
  }

  const difficultyValue = Number.parseInt(String(data.difficulty ?? 3), 10)
  const difficulty = (difficultyValue >= 1 && difficultyValue <= 5 ? difficultyValue : 3) as 1 | 2 | 3 | 4 | 5

  const correctAnswerValue = Number.parseInt(String(data.correctAnswer ?? 0), 10)
  const correctAnswer =
    Number.isNaN(correctAnswerValue) || correctAnswerValue < 0 || correctAnswerValue >= options.length ? 0 : correctAnswerValue

  return {
    id,
    text,
    category,
    options,
    correctAnswer,
    difficulty,
    imageUrl: typeof data.imageUrl === 'string' && data.imageUrl.trim() ? data.imageUrl.trim() : undefined,
  }
}

export default function QuestionManager({ onQuestionUpdate }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'success' | 'error' | null>(null)

  const loadQuestions = useCallback(async (filter: typeof difficultyFilter) => {
    setLoading(true)
    setMessage(null)
    setMessageTone(null)

    try {
      const base = collection(db, 'questions')
      const firestoreQuery =
        filter === 'all'
          ? query(base, orderBy('category', 'asc'))
          : query(base, where('difficulty', '==', filter))

      const snapshot = await getDocs(firestoreQuery)
      const parsed = snapshot.docs
        .map((docSnapshot) => parseQuestionRecord(docSnapshot.data(), docSnapshot.id))
        .filter((question): question is Question => question !== null)
        .sort((left, right) => {
          const categoryCompare = left.category.localeCompare(right.category)
          if (categoryCompare !== 0) {
            return categoryCompare
          }
          if (left.difficulty !== right.difficulty) {
            return left.difficulty - right.difficulty
          }
          return left.text.localeCompare(right.text)
        })

      setQuestions(parsed)
    } catch (error) {
      console.error('Failed to load questions:', error)
      setMessageTone('error')
      setMessage(toFriendlyQuestionError(error))
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQuestions(difficultyFilter)
  }, [difficultyFilter, loadQuestions])

  const visibleQuestions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const matches = (question: Question) => {
      if (!normalizedQuery) {
        return true
      }

      if (question.text.toLowerCase().includes(normalizedQuery)) {
        return true
      }
      if (question.category.toLowerCase().includes(normalizedQuery)) {
        return true
      }
      if (question.options.some((option) => option.toLowerCase().includes(normalizedQuery))) {
        return true
      }

      return false
    }

    const filteredByDifficulty =
      difficultyFilter === 'all' ? questions : questions.filter((question) => question.difficulty === difficultyFilter)

    return filteredByDifficulty.filter(matches)
  }, [difficultyFilter, questions, searchQuery])

  const emptyStateMessage = useMemo(() => {
    const normalizedQuery = searchQuery.trim()
    if (questions.length === 0) {
      return difficultyFilter === 'all'
        ? 'No questions yet. Use "Add New Question" or the CSV Import panel to add questions.'
        : `No questions found for difficulty level ${difficultyFilter}.`
    }

    if (normalizedQuery) {
      return 'No questions match your search.'
    }

    return 'No questions found.'
  }, [difficultyFilter, questions.length, searchQuery])

  const handleEdit = (question: Question) => {
    setEditingQuestion({ ...question })
    setShowForm(true)
  }

  const handleDelete = async (questionId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this question?')
    if (!confirmed) {
      return
    }

    setDeletingId(questionId)
    setMessage(null)
    setMessageTone(null)

    try {
      await deleteDoc(doc(db, 'questions', questionId))
      setQuestions((current) => current.filter((question) => question.id !== questionId))
      setMessageTone('success')
      setMessage('Question deleted.')
      onQuestionUpdate?.()
    } catch (error) {
      console.error('Failed to delete question:', error)
      setMessageTone('error')
      setMessage(toFriendlyQuestionError(error))
    } finally {
      setDeletingId(null)
    }
  }

  const handleSave = async () => {
    if (!editingQuestion) {
      return
    }

    const text = editingQuestion.text.trim()
    const options = editingQuestion.options.map((option) => option.trim()).filter(Boolean)
    if (!text || options.length < 2) {
      setMessageTone('error')
      setMessage('Question text and at least two options are required.')
      return
    }

    const correctAnswer =
      editingQuestion.correctAnswer >= 0 && editingQuestion.correctAnswer < options.length
        ? editingQuestion.correctAnswer
        : 0

    setSaving(true)
    setMessage(null)
    setMessageTone(null)

    const payload = {
      text,
      category: editingQuestion.category,
      options,
      correctAnswer,
      difficulty: editingQuestion.difficulty,
      updatedAt: serverTimestamp(),
    }

    try {
      if (editingQuestion.id.startsWith('new-')) {
        const docRef = await addDoc(collection(db, 'questions'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
        setQuestions((current) => [{ ...editingQuestion, id: docRef.id, text, options, correctAnswer }, ...current])
        setMessageTone('success')
        setMessage('Question created.')
      } else {
        await updateDoc(doc(db, 'questions', editingQuestion.id), payload)
        setQuestions((current) =>
          current.map((question) =>
            question.id === editingQuestion.id ? { ...editingQuestion, text, options, correctAnswer } : question
          )
        )
        setMessageTone('success')
        setMessage('Question updated.')
      }

      setEditingQuestion(null)
      setShowForm(false)
      onQuestionUpdate?.()
    } catch (error) {
      console.error('Failed to save question:', error)
      setMessageTone('error')
      setMessage(toFriendlyQuestionError(error))
    } finally {
      setSaving(false)
    }
  }

  const handleAddNew = () => {
    setEditingQuestion({
      id: `new-${Date.now()}`,
      text: '',
      category: 'Formulas',
      options: ['', '', '', ''],
      correctAnswer: 0,
      difficulty: 1,
    })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-excel-green mx-auto"></div>
        <p className="text-center mt-4 text-gray-600">Loading questions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            messageTone === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message}
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h3 className="text-xl font-semibold text-excel-dark-gray">Question Management</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Difficulty</label>
            <select
              value={difficultyFilter}
              onChange={(event) => {
                const value = event.target.value
                setDifficultyFilter(value === 'all' ? 'all' : (Number(value) as 1 | 2 | 3 | 4 | 5))
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-excel-green focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>

            <label className="text-sm font-medium text-gray-700">Search</label>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-excel-green focus:border-transparent sm:w-72"
              placeholder="Search text, category, options..."
            />
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="bg-white hover:bg-gray-100 text-excel-dark-gray border border-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
              >
                Clear
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void loadQuestions(difficultyFilter)}
              className="bg-white hover:bg-gray-100 text-excel-dark-gray border border-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
            >
              Refresh
            </button>
            <span className="text-xs text-gray-500">
              Showing {visibleQuestions.length} of {questions.length}
            </span>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-excel-green hover:bg-excel-dark-green text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg shrink-0"
        >
          Add New Question
        </button>
      </div>

      {/* Question List */}
      <div className="grid gap-4">
        {visibleQuestions.length === 0 ? (
          <div className="card">
            <p className="text-gray-600 text-sm">{emptyStateMessage}</p>
          </div>
        ) : null}

        {visibleQuestions.map((question) => (
          <div key={question.id} className="card hover:shadow-md transition-shadow overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-excel-dark-gray mb-2">{question.text}</h4>
                <div className="flex flex-wrap gap-2 text-sm text-gray-600 mb-2">
                  <span className="bg-gray-100 px-2 py-1 rounded">{question.category}</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">Difficulty: {question.difficulty}</span>
                  <span
                    className="bg-excel-light-green px-2 py-1 rounded max-w-full truncate"
                    title={`Correct: ${question.options[question.correctAnswer]}`}
                  >
                    Correct: {question.options[question.correctAnswer]}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(question)}
                  className="bg-white hover:bg-gray-100 text-excel-dark-gray border border-gray-300 font-semibold py-1 px-3 rounded-lg transition-colors duration-200 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(question.id)}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg transition-colors duration-200 text-sm"
                  disabled={deletingId === question.id}
                >
                  {deletingId === question.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {question.options.map((option, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-2 ${
                    index === question.correctAnswer
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                  {option}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Question Form Modal */}
      {showForm && editingQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">
                  {editingQuestion.id.startsWith('new-') ? 'Add New Question' : 'Edit Question'}
                </h4>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
                  <textarea
                    value={editingQuestion.text}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingQuestion({...editingQuestion, text: e.target.value})}
                    placeholder="Enter question text..."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-excel-green focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={editingQuestion.category}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditingQuestion({...editingQuestion, category: e.target.value as Question['category']})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-excel-green focus:border-transparent"
                    >
                      {QUESTION_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category === 'DataAnalysis' ? 'Data Analysis' : category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                    <select
                      value={editingQuestion.difficulty}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditingQuestion({...editingQuestion, difficulty: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-excel-green focus:border-transparent"
                    >
                      <option value={1}>1 - Easy</option>
                      <option value={2}>2 - Easy</option>
                      <option value={3}>3 - Medium</option>
                      <option value={4}>4 - Hard</option>
                      <option value={5}>5 - Very Hard</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Options</label>
                  {editingQuestion.options.map((option, index) => (
                    <div key={index} className="flex gap-3 items-center">
                      <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <input
                        type="text"
                        value={option}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newOptions = [...editingQuestion.options]
                          newOptions[index] = e.target.value
                          setEditingQuestion({...editingQuestion, options: newOptions})
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-excel-green focus:border-transparent"
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={editingQuestion.correctAnswer === index}
                          onChange={() => setEditingQuestion({...editingQuestion, correctAnswer: index})}
                        />
                        <span className="text-sm">Correct</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="bg-white hover:bg-gray-100 text-excel-dark-gray border border-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="bg-excel-green hover:bg-excel-dark-green text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  Save Question
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
