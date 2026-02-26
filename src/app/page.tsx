'use client'

import { useAuth } from '@/lib/auth'
import { signInWithGoogle, signOutUser } from '@/lib/firebase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isSigningIn, setIsSigningIn] = useState(false)

  const handleStartQuiz = () => {
    if (!user) {
      handleSignIn()
    } else {
      router.push('/quiz')
    }
  }

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signInWithGoogle()
      router.push('/quiz')
    } catch (error) {
      console.error('Sign in error:', error)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOutUser()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-excel-green to-excel-light-green">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
            <h1 className="text-5xl font-bold text-excel-dark-gray mb-4">
              Excel Mastery Quiz
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Test your Excel knowledge and improve your skills with our comprehensive quiz system
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-semibold mb-2">Comprehensive Quiz</h3>
                <p className="text-sm text-gray-600">10-20 questions covering all Excel topics</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="text-3xl mb-2">🎯</div>
                <h3 className="font-semibold mb-2">Personalized Learning</h3>
                <p className="text-sm text-gray-600">Get recommendations based on your weak areas</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="text-3xl mb-2">📈</div>
                <h3 className="font-semibold mb-2">Track Progress</h3>
                <p className="text-sm text-gray-600">Monitor your improvement over time</p>
              </div>
            </div>

            <div className="space-y-4">
              {!user ? (
                <button
                  onClick={handleStartQuiz}
                  disabled={isSigningIn}
                  className="btn-primary px-8 py-3 text-lg font-bold"
                >
                  {isSigningIn ? 'Signing in...' : 'Start Quiz'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="text-left bg-gray-50 p-4 rounded-lg">
                    <p className="font-semibold">Welcome back, {user.displayName}!</p>
                    <p className="text-sm text-gray-600">Ready to test your Excel skills?</p>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleStartQuiz}
                      className="btn-primary px-8 py-3 text-lg font-bold"
                    >
                      Continue Quiz
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="btn-secondary px-6 py-3"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {user && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-xl font-semibold mb-4">Your Progress</h3>
                <p className="text-gray-600">Track your quiz attempts and improvement</p>
              </div>
              <div className="card">
                <h3 className="text-xl font-semibold mb-4">Training Resources</h3>
                <p className="text-gray-600">Access personalized learning materials</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}