'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/lib/auth'
import { db } from '@/lib/firebase'

type RequestType = 'training' | 'assessment'

const requestCopy: Record<RequestType, { title: string; subtitle: string }> = {
  training: {
    title: 'Request Training',
    subtitle: 'Tell us about your team so we can recommend the right program.',
  },
  assessment: {
    title: 'Request Internal Assessment',
    subtitle: 'Schedule an assessment for your team and we will follow up.',
  },
}

function TrainingRequestPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawType = searchParams.get('type')
  const requestType: RequestType = rawType === 'assessment' ? 'assessment' : 'training'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [organization, setOrganization] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !phone.trim() || !organization.trim()) {
      setError('Email, phone, and organization are required.')
      return
    }

    setSubmitting(true)
    try {
      await addDoc(collection(db, 'trainingRequests'), {
        requestType,
        email: email.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
        notes: notes.trim() || null,
        userId: user?.uid || null,
        createdAt: serverTimestamp(),
      })
      setSubmitted(true)
    } catch (err) {
      console.error('Failed to submit training request:', err)
      setError('We could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#eef2f6] py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl border border-[#d9e3ef] bg-white p-8 text-center shadow-sm">
            <h1 className="text-3xl font-bold text-[#142842]">Request Received</h1>
            <p className="mt-2 text-sm text-[#5a6f8a]">
              Thanks. Our team will reach out shortly.
            </p>
            <button onClick={() => router.push('/training')} className="btn-secondary mt-6">
              Back to Training Programs
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7491]">
              {requestType === 'training' ? 'Training Request' : 'Assessment Request'}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#142842]">{requestCopy[requestType].title}</h1>
            <p className="mt-2 text-sm text-[#5a6f8a]">{requestCopy[requestType].subtitle}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-[#1e3757]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1e3757]">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1e3757]">Organization</label>
                <input
                  type="text"
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1e3757]">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  placeholder="Share any specific goals or constraints."
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => router.push('/training')} className="btn-secondary w-full sm:w-auto">
                  Back to Programs
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

function TrainingRequestLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
    </div>
  )
}

export default function TrainingRequestPage() {
  return (
    <Suspense fallback={<TrainingRequestLoadingScreen />}>
      <TrainingRequestPageContent />
    </Suspense>
  )
}
