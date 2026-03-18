'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { auth, signInWithGoogle, signOutUser } from './firebase'

interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  signIn: async () => {},
  signOut: async () => {}
 })

export function useAuth() {
  return useContext(AuthContext)
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let resolved = false

    const clearLoading = () => {
      if (!resolved) {
        resolved = true
      }
      setLoading(false)
    }

    const fallbackTimer = window.setTimeout(() => {
      clearLoading()
    }, 4000)

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(mapAuthUser(firebaseUser))
        window.clearTimeout(fallbackTimer)
        clearLoading()
      },
      (error) => {
        console.error('Firebase auth state listener error:', error)
        setUser(null)
        window.clearTimeout(fallbackTimer)
        clearLoading()
      }
    )

    return () => {
      window.clearTimeout(fallbackTimer)
      unsubscribe()
    }
  }, [])

  const signIn = async () => {
    await signInWithGoogle()
  }

  const signOut = async () => {
    await signOutUser()
  }

  const value = {
    user,
    loading,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

function mapAuthUser(firebaseUser: FirebaseUser | null): AuthUser | null {
  if (!firebaseUser) {
    return null
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  }
}
