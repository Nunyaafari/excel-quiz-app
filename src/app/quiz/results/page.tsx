'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { QuizAttempt, TrainingMaterial, Recommendation } from '@/types'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

export default function ResultsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  // Sample training materials
  const sampleTrainingMaterials: TrainingMaterial[] = [
    {
      id: '1',
      title: 'Excel Formulas Masterclass',
      category: 'Formulas',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnail: 'https://via.placeholder.com/150',
      description: 'Learn the most important Excel formulas and functions'
    },
    {
      id: '2',
      title: 'Excel Shortcuts Guide',
      category: 'Shortcuts',
      type: 'article',
      url: 'https://example.com/excel-shortcuts',
      thumbnail: 'https://via.placeholder.com/150',
      description: 'Master Excel shortcuts to work faster'
    },
    {
      id: '3',
      title: 'Chart Creation Tutorial',
      category: 'Charts',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnail: 'https://via.placeholder.com/150',
      description: 'Create professional charts in Excel'
    },
    {
      id: '4',
      title: 'Data Analysis with PivotTables',
      category: 'DataAnalysis',
      type: 'exercise',
      url: 'https://example.com/pivot-exercises',
      thumbnail: 'https://via.placeholder.com/150',
      description: 'Practice data analysis with PivotTables'
    },
  ]

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    fetchQuizAttempts()
  }, [user, router])

  const fetchQuizAttempts = async () => {
    if (!user) return

    try {
      const q = query(
        collection(db, 'quizAttempts'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(10)
      )
      
      const querySnapshot = await getDocs(q)
      const attempts: QuizAttempt[] = []
      
      querySnapshot.forEach((doc) => {
        attempts.push({ id: doc.id, ...doc.data() } as QuizAttempt)
      })
      
      setQuizAttempts(attempts)
      
      // Generate recommendations based on latest attempt
      if (attempts.length > 0) {
        generateRecommendations(attempts[0])
      }
    } catch (error) {
      console.error('Error fetching quiz attempts:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateRecommendations = (latestAttempt: QuizAttempt) => {
    const recs: Recommendation[] = []
    
    // Calculate category accuracy
    const categoryAccuracy = calculateCategoryAccuracy(latestAttempt)
    
    Object.entries(categoryAccuracy).forEach(([category, accuracy]) => {
      if (accuracy < 0.7) { // Less than 70% accuracy
        const materials = sampleTrainingMaterials.filter(mat => mat.category === category)
        recs.push({
          category,
          materials,
          accuracy
        })
      }
    })
    
    setRecommendations(recs)
  }

  const calculateCategoryAccuracy = (attempt: QuizAttempt): Record<string, number> => {
    const categoryAccuracy: Record<string, number> = {}
    const categories = ['Formulas', 'Shortcuts', 'Charts', 'DataAnalysis', 'Formatting']
    
    categories.forEach(category => {
      const totalQuestions = 1 // Simplified for MVP
      const correctAnswers = attempt.categoryScores[category] || 0
      categoryAccuracy[category] = correctAnswers / totalQuestions
    })
    
    return categoryAccuracy
  }

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
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

  const latestAttempt = quizAttempts[0]
  const totalScore = latestAttempt ? latestAttempt.score : 0
  const totalQuestions = latestAttempt ? latestAttempt.totalQuestions : 0
  const percentage = totalQuestions > 0 ? (totalScore / (totalQuestions * 10)) * 100 : 0

  return (
    <div className="min-h-screen bg-excel-gray py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-excel-dark-gray mb-2">Quiz Results</h1>
            <p className="text-gray-600">See your performance and get personalized recommendations</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Score Summary */}
            <div className="card lg:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Your Score</h2>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold text-excel-dark-gray">{totalScore}</p>
                  <p className="text-gray-600">out of {totalQuestions * 10}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${getScoreColor(totalScore, totalQuestions * 10)}`}>
                    {percentage.toFixed(0)}%
                  </p>
                  <p className="text-gray-600">Accuracy</p>
                </div>
              </div>
              
              {/* Progress Ring */}
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="#217346"
                      strokeWidth="8"
                      strokeDasharray={`${percentage * 3.39} 339`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Questions</span>
                  <span className="font-semibold">{totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Correct Answers</span>
                  <span className="font-semibold text-green-600">{latestAttempt?.correctAnswers || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Wrong Categories</span>
                  <span className="font-semibold text-red-600">{latestAttempt?.wrongCategories.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Score</span>
                  <span className="font-semibold">{latestAttempt?.score || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold mb-4">Recommended Training</h2>
              <p className="text-gray-600 mb-4">Based on your weak areas, here are personalized recommendations to help you improve:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.map((rec, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-red-600">{rec.category}</h3>
                      <span className="text-sm text-gray-500">{(rec.accuracy * 100).toFixed(0)}% accuracy</span>
                    </div>
                    <div className="space-y-2">
                      {rec.materials.map((material) => (
                        <a
                          key={material.id}
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <div className="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center">
                            <span className="text-xs font-bold">{material.type.toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium">{material.title}</p>
                            <p className="text-sm text-gray-600">{material.description}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Chart */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Performance History</h2>
            {quizAttempts.length > 0 ? (
              <div className="h-64">
                <Bar
                  data={{
                    labels: quizAttempts.slice(0, 5).reverse().map((_, index) => `Quiz ${index + 1}`),
                    datasets: [{
                      label: 'Score',
                      data: quizAttempts.slice(0, 5).reverse().map(attempt => attempt.score),
                      backgroundColor: '#217346',
                      borderColor: '#1f6e42',
                      borderWidth: 1,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: Math.max(...quizAttempts.map(a => a.score)) + 10,
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No quiz history available yet. Take your first quiz to see performance data!</p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex justify-center space-x-4">
            <button
              onClick={() => router.push('/quiz')}
              className="btn-primary px-8 py-3"
            >
              Take Another Quiz
            </button>
            <button
              onClick={() => router.push('/')}
              className="btn-secondary px-6 py-3"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}