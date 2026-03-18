'use client'

import { useState, useEffect } from 'react'
import { Question } from '@/types'

interface QuestionManagerProps {
  onQuestionUpdate?: () => void
}

export default function QuestionManager({ onQuestionUpdate }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [showForm, setShowForm] = useState(false)

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
  ]

  useEffect(() => {
    // Mock loading questions
    setTimeout(() => {
      setQuestions(sampleQuestions)
      setLoading(false)
    }, 1000)
  }, [])

  const handleEdit = (question: Question) => {
    setEditingQuestion({ ...question })
    setShowForm(true)
  }

  const handleDelete = (questionId: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      setQuestions(questions.filter(q => q.id !== questionId))
      onQuestionUpdate?.()
    }
  }

  const handleSave = () => {
    if (editingQuestion) {
      if (editingQuestion.id.startsWith('new-')) {
        // Adding new question
        const newQuestion = {
          ...editingQuestion,
          id: `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
        setQuestions([...questions, newQuestion])
      } else {
        // Updating existing question
        const updatedQuestions = questions.map(q => 
          q.id === editingQuestion.id ? editingQuestion : q
        )
        setQuestions(updatedQuestions)
      }
      setEditingQuestion(null)
      setShowForm(false)
      onQuestionUpdate?.()
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-excel-dark-gray">Question Management</h3>
        <button
          onClick={handleAddNew}
          className="bg-excel-green hover:bg-excel-dark-green text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          Add New Question
        </button>
      </div>

      {/* Question List */}
      <div className="grid gap-4">
        {questions.map((question) => (
          <div key={question.id} className="card hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h4 className="font-semibold text-excel-dark-gray mb-2">{question.text}</h4>
                <div className="flex gap-2 text-sm text-gray-600 mb-2">
                  <span className="bg-gray-100 px-2 py-1 rounded">{question.category}</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">Difficulty: {question.difficulty}</span>
                  <span className="bg-excel-light-green px-2 py-1 rounded">Correct: {question.options[question.correctAnswer]}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(question)}
                  className="bg-white hover:bg-gray-100 text-excel-dark-gray border border-gray-300 font-semibold py-1 px-3 rounded-lg transition-colors duration-200 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(question.id)}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg transition-colors duration-200 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
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
                      <option value="Formulas">Formulas</option>
                      <option value="Shortcuts">Shortcuts</option>
                      <option value="Charts">Charts</option>
                      <option value="DataAnalysis">Data Analysis</option>
                      <option value="Formatting">Formatting</option>
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