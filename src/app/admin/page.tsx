'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { useAuth } from '@/lib/auth'
import { auth, db } from '@/lib/firebase'
import { AdminStats, CSVImportResult, Question, QuizBatch, QuizLead, TrainingRequest } from '@/types'
import { getAdminAnalyticsSnapshot, type AdminAnalyticsSnapshot } from '@/lib/admin-analytics'
import {
  createQuestionSignature,
  downloadImportErrorsCSV,
  downloadSampleCSV,
  importQuestionsToFirestore,
  normalizeCategory,
  parseCSVFile,
  validateCSVQuestions,
} from '@/lib/csv-import'
import QuestionManager from '@/components/admin/QuestionManager'
import BlogManager from '@/components/admin/BlogManager'
import { Chart as ChartJS, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, BarElement } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, ArcElement, BarElement, Tooltip, Legend)

type AnalyticsDetails = Pick<
  AdminAnalyticsSnapshot,
  'sourceDistribution'
  | 'landingSourceDistribution'
  | 'scoreBandDistribution'
  | 'difficultyLevelDistribution'
  | 'dailyAttempts'
  | 'weakCategoryCounts'
>

type AdminTab = 'overview' | 'content' | 'questionBank' | 'analytics' | 'batches' | 'outreach'

const CHART_COLORS = ['#0f2744', '#144d6a', '#1f6f6d', '#3f86a8', '#82b8d7', '#94d2bd']

export default function AdminPage() {
  const { user, loading: authLoading, signIn } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [analyticsDetails, setAnalyticsDetails] = useState<AnalyticsDetails | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [leads, setLeads] = useState<QuizLead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadActionMessage, setLeadActionMessage] = useState<string | null>(null)
  const [leadActionTone, setLeadActionTone] = useState<'success' | 'warning' | 'error' | null>(null)
  const [leadSendingId, setLeadSendingId] = useState<string | null>(null)
  const [batchName, setBatchName] = useState('')
  const [batchDifficulty, setBatchDifficulty] = useState<'Novice' | 'Intermediate' | 'Advanced' | 'Legend'>('Intermediate')
  const [batchInvitees, setBatchInvitees] = useState('')
  const [batches, setBatches] = useState<QuizBatch[]>([])
  const [batchCreating, setBatchCreating] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<QuizBatch | null>(null)
  const [batchAttempts, setBatchAttempts] = useState<Array<{ score: number; userId: string; date: Date }>>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [trainingRequests, setTrainingRequests] = useState<TrainingRequest[]>([])
  const [trainingRequestsLoading, setTrainingRequestsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  const parseLeadRecord = (raw: unknown, id: string): QuizLead | null => {
    if (!raw || typeof raw !== 'object') {
      return null
    }

    const data = raw as Partial<QuizLead> & { createdAt?: unknown }
    const email = typeof data.email === 'string' ? data.email : ''
    if (!email) {
      return null
    }

    const toDate = (value: unknown) =>
      value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function'
        ? (value as { toDate: () => Date }).toDate()
        : value instanceof Date
          ? value
          : new Date()

    const createdAt = toDate(data.createdAt)

    return {
      id,
      userId: typeof data.userId === 'string' ? data.userId : 'unknown',
      email,
      usageFrequency: typeof data.usageFrequency === 'string' ? data.usageFrequency : 'Mostly',
      selfAssessment: typeof data.selfAssessment === 'string' ? data.selfAssessment : 'Intermediate',
      difficultyLabel: typeof data.difficultyLabel === 'string' ? data.difficultyLabel : 'Mixed Difficulty',
      createdAt,
      percentage: typeof data.percentage === 'number' ? data.percentage : undefined,
      reportEmailStatus: typeof data.reportEmailStatus === 'string' ? data.reportEmailStatus : undefined,
      reportEmailId: typeof data.reportEmailId === 'string' ? data.reportEmailId : undefined,
      reportEmailError: typeof data.reportEmailError === 'string' ? data.reportEmailError : undefined,
      reportEmailSentAt: data.reportEmailSentAt ? toDate(data.reportEmailSentAt) : undefined,
      reportEmailDeliveredAt: data.reportEmailDeliveredAt ? toDate(data.reportEmailDeliveredAt) : undefined,
      reportEmailFailedAt: data.reportEmailFailedAt ? toDate(data.reportEmailFailedAt) : undefined,
      reportEmailOpenedAt: data.reportEmailOpenedAt ? toDate(data.reportEmailOpenedAt) : undefined,
      reportEmailClickedAt: data.reportEmailClickedAt ? toDate(data.reportEmailClickedAt) : undefined,
    }
  }

  const parseBatchRecord = (raw: unknown, id: string): QuizBatch | null => {
    if (!raw || typeof raw !== 'object') {
      return null
    }

    const data = raw as Partial<QuizBatch> & { createdAt?: unknown }
    const name = typeof data.name === 'string' ? data.name : ''
    if (!name) {
      return null
    }

    const levels: Array<1 | 2 | 3 | 4 | 5> = Array.isArray(data.difficultyLevels)
      ? data.difficultyLevels
          .map((level) => Number(level))
          .filter((level): level is 1 | 2 | 3 | 4 | 5 => [1, 2, 3, 4, 5].includes(level))
      : [2]

    const createdAt =
      data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt
        ? (data.createdAt as { toDate: () => Date }).toDate()
        : new Date()

    return {
      id,
      name,
      difficultyLevels: levels,
      difficultyLabel: typeof data.difficultyLabel === 'string' ? data.difficultyLabel : 'Intermediate (Level 2)',
      invitees: Array.isArray(data.invitees) ? data.invitees.map(String) : [],
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'admin',
      createdAt,
    }
  }

  const parseTrainingRequest = (raw: unknown, id: string): TrainingRequest | null => {
    if (!raw || typeof raw !== 'object') {
      return null
    }

    const data = raw as Partial<TrainingRequest> & { createdAt?: unknown }
    if (typeof data.email !== 'string' || typeof data.phone !== 'string' || typeof data.organization !== 'string') {
      return null
    }

    const createdAt =
      data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt
        ? (data.createdAt as { toDate: () => Date }).toDate()
        : new Date()

    return {
      id,
      requestType: data.requestType === 'assessment' ? 'assessment' : 'training',
      email: data.email,
      phone: data.phone,
      organization: data.organization,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      createdAt,
      userId: typeof data.userId === 'string' ? data.userId : undefined,
    }
  }

  const difficultyMap: Record<typeof batchDifficulty, Array<1 | 2 | 3 | 4 | 5>> = {
    Novice: [1],
    Intermediate: [2],
    Advanced: [3],
    Legend: [4, 5],
  }

  const difficultyLabelMap: Record<typeof batchDifficulty, string> = {
    Novice: 'Novice (Level 1)',
    Intermediate: 'Intermediate (Level 2)',
    Advanced: 'Advanced (Level 3)',
    Legend: 'Legend (Levels 4-5)',
  }

  const normalizeInvitees = (value: string) =>
    value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => item && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))

  const filterExistingQuestions = async (
    questions: Question[]
  ): Promise<{ questions: Question[]; duplicateErrors: string[]; warnings: string[] }> => {
    if (questions.length === 0) {
      return { questions: [], duplicateErrors: [], warnings: [] }
    }

    try {
      const existingSnapshot = await getDocs(collection(db, 'questions'))
      const existingSignatures = new Set<string>()

      existingSnapshot.forEach((questionDoc) => {
        const data = questionDoc.data()
        if (typeof data.text !== 'string' || typeof data.category !== 'string') {
          return
        }

        const normalized = normalizeCategory(data.category)
        if (!normalized) {
          return
        }

        existingSignatures.add(
          createQuestionSignature({
            text: data.text,
            category: normalized,
          })
        )
      })

      const uniqueQuestions: Question[] = []
      const duplicateErrors: string[] = []

      questions.forEach((question) => {
        const signature = createQuestionSignature(question)
        if (existingSignatures.has(signature)) {
          duplicateErrors.push(`Duplicate existing question: "${question.text}" (${question.category})`)
          return
        }

        existingSignatures.add(signature)
        uniqueQuestions.push(question)
      })

      return { questions: uniqueQuestions, duplicateErrors, warnings: [] }
    } catch (error) {
      console.error('Could not verify existing question duplicates:', error)
      return {
        questions,
        duplicateErrors: [],
        warnings: ['Could not verify duplicates against existing database questions.'],
      }
    }
  }

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      setPageLoading(false)
      return
    }

    setPageLoading(true)
    setAdminCheckError(null)

    let active = true

    const verifyAdminAccess = async () => {
      try {
        const adminRef = doc(db, 'admins', user.uid)
        const adminSnap = await getDoc(adminRef)
        const adminData = adminSnap.data()
        const hasAdminAccess = adminSnap.exists() && adminData?.active === true

        if (!active) {
          return
        }

        setIsAdmin(hasAdminAccess)

        if (hasAdminAccess) {
          setLeadsLoading(true)
          setTrainingRequestsLoading(true)

          const [analyticsSnapshot, leadSnapshot, batchSnapshot, requestSnapshot] = await Promise.all([
            getAdminAnalyticsSnapshot(),
            getDocs(query(collection(db, 'quizLeads'), orderBy('createdAt', 'desc'), limit(200))),
            getDocs(query(collection(db, 'quizBatches'), orderBy('createdAt', 'desc'), limit(50))),
            getDocs(query(collection(db, 'trainingRequests'), orderBy('createdAt', 'desc'), limit(200))),
          ])

          if (!active) {
            return
          }

          setStats({
            totalQuestions: analyticsSnapshot.totalQuestions,
            totalUsers: analyticsSnapshot.totalUsers,
            totalQuizAttempts: analyticsSnapshot.totalQuizAttempts,
            averageScore: analyticsSnapshot.averageScore,
            categoryDistribution: analyticsSnapshot.categoryDistribution,
            recentActivity: analyticsSnapshot.recentActivity,
          })

          setAnalyticsDetails({
            sourceDistribution: analyticsSnapshot.sourceDistribution,
            landingSourceDistribution: analyticsSnapshot.landingSourceDistribution,
            scoreBandDistribution: analyticsSnapshot.scoreBandDistribution,
            difficultyLevelDistribution: analyticsSnapshot.difficultyLevelDistribution,
            dailyAttempts: analyticsSnapshot.dailyAttempts,
            weakCategoryCounts: analyticsSnapshot.weakCategoryCounts,
          })

          const parsedLeads = leadSnapshot.docs
            .map((docSnap) => parseLeadRecord(docSnap.data(), docSnap.id))
            .filter((lead): lead is QuizLead => lead !== null)
          setLeads(parsedLeads)

          const parsedBatches = batchSnapshot.docs
            .map((docSnap) => parseBatchRecord(docSnap.data(), docSnap.id))
            .filter((batch): batch is QuizBatch => batch !== null)
          setBatches(parsedBatches)

          const parsedRequests = requestSnapshot.docs
            .map((docSnap) => parseTrainingRequest(docSnap.data(), docSnap.id))
            .filter((request): request is TrainingRequest => request !== null)
          setTrainingRequests(parsedRequests)
        }
      } catch (error) {
        console.error('Failed to verify admin access:', error)
        if (active) {
          setAdminCheckError('Unable to verify admin access. Please try again.')
          setIsAdmin(false)
        }
      } finally {
        if (active) {
          setPageLoading(false)
          setLeadsLoading(false)
          setTrainingRequestsLoading(false)
        }
      }
    }

    void verifyAdminAccess()

    return () => {
      active = false
    }
  }, [authLoading, router, user])

  const handleCSVUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert('Signed in but not admin. You do not have permission to import questions.')
      return
    }

    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.includes('csv') && !file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a valid CSV file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setCsvFile(file)
    setImporting(true)
    setImportResult(null)

    try {
      const csvQuestions = await parseCSVFile(file)

      if (csvQuestions.length === 0) {
        setImportResult({
          success: false,
          importedCount: 0,
          failedCount: 0,
          errors: ['No data rows were found in the CSV file.'],
          questions: [],
        })
        return
      }

      const validation = validateCSVQuestions(csvQuestions)
      const existingCheck = await filterExistingQuestions(validation.valid)

      const errors = [...validation.invalid, ...existingCheck.duplicateErrors]
      const warnings: string[] = []

      if (errors.length > 0) {
        warnings.push(`${errors.length} row(s) will be skipped during import.`)
      }
      warnings.push(...existingCheck.warnings)

      setImportResult({
        success: true,
        importedCount: existingCheck.questions.length,
        failedCount: errors.length,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
        questions: existingCheck.questions,
      })
    } catch (error) {
      console.error('CSV parsing error:', error)
      setImportResult({
        success: false,
        importedCount: 0,
        failedCount: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse CSV file. Please check the file format.'],
        questions: [],
      })
    } finally {
      setImporting(false)
    }
  }

  const handleImportQuestions = async () => {
    if (!isAdmin) {
      alert('Signed in but not admin. You do not have permission to import questions.')
      return
    }

    if (!importResult?.questions.length) {
      alert('No valid rows to import.')
      return
    }

    setImporting(true)

    try {
      alert(`Starting import of ${importResult.questions.length} valid question(s)...`)
      const result = await importQuestionsToFirestore(importResult.questions)

      if (result.importedCount > 0) {
        setStats((previous) =>
          previous
            ? {
                ...previous,
                totalQuestions: previous.totalQuestions + result.importedCount,
                recentActivity: [
                  {
                    action: `Successfully imported ${result.importedCount} questions`,
                    timestamp: new Date(),
                    user: user?.email || 'admin',
                  },
                  ...previous.recentActivity.slice(0, 7),
                ],
              }
            : previous
        )

        const skippedFromValidation = importResult.failedCount
        const skippedFromImport = result.failedCount
        const totalSkipped = skippedFromValidation + skippedFromImport

        const summaryParts = [`Imported ${result.importedCount} question(s).`]
        if (totalSkipped > 0) {
          summaryParts.push(`Skipped ${totalSkipped} row(s).`)
        }
        if (result.errors.length > 0) {
          summaryParts.push(`Details: ${result.errors.slice(0, 3).join(' | ')}`)
        }
        alert(summaryParts.join(' '))

        setCsvFile(null)
        setImportResult(null)
      } else {
        const combinedErrors = result.errors.join(' | ')
        if (combinedErrors.includes('Signed in but not admin')) {
          alert('Import failed: signed in but not admin.')
        } else if (combinedErrors.includes('Please sign in with Google')) {
          alert('Import failed: please sign in with Google.')
        } else {
          alert(`Failed to import questions. ${combinedErrors || 'Unknown error.'}`)
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      alert('Failed to import questions to database. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const handleClearUpload = () => {
    setCsvFile(null)
    setImportResult(null)
  }

  const categoryDistributionEntries = useMemo(
    () => Object.entries(stats?.categoryDistribution ?? {}),
    [stats]
  )
  const sourceDistributionEntries = useMemo(
    () => Object.entries(analyticsDetails?.sourceDistribution ?? {}),
    [analyticsDetails]
  )
  const landingSourceEntries = useMemo(
    () => Object.entries(analyticsDetails?.landingSourceDistribution ?? {}),
    [analyticsDetails]
  )
  const scoreBandEntries = useMemo(
    () => Object.entries(analyticsDetails?.scoreBandDistribution ?? {}),
    [analyticsDetails]
  )
  const difficultyLevelEntries = useMemo(() => {
    const entries = Object.entries(analyticsDetails?.difficultyLevelDistribution ?? {})
    return entries.sort(([left], [right]) => Number(left) - Number(right))
  }, [analyticsDetails])
  const requestSnapshot = useMemo(() => {
    return trainingRequests.reduce(
      (accumulator, request) => {
        if (request.requestType === 'assessment') {
          accumulator.assessment += 1
        } else {
          accumulator.training += 1
        }
        return accumulator
      },
      { training: 0, assessment: 0 }
    )
  }, [trainingRequests])
  const adminTabs: Array<{ id: AdminTab; label: string; description: string }> = [
    { id: 'overview', label: 'Overview', description: 'Recent activity and admin shortcuts' },
    { id: 'content', label: 'Blog', description: 'Create and publish SEO blog posts' },
    { id: 'questionBank', label: 'Question Bank', description: 'Manage questions and bulk CSV imports' },
    { id: 'analytics', label: 'Analytics', description: 'Performance, sources, and trends' },
    { id: 'batches', label: 'Batches', description: 'Create invites and review cohort results' },
    { id: 'outreach', label: 'Outreach', description: 'Leads and training requests' },
  ]

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-excel-green"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#eef2f6] py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl border border-[#d9e3ef] bg-white p-8 text-center shadow-sm">
            <h1 className="mb-3 text-3xl font-bold text-[#142842]">Sign In Required</h1>
            <p className="mb-6 text-[#5a6f8a]">Please sign in with Google to access the admin dashboard.</p>

            {adminCheckError && <p className="mb-4 text-sm text-red-600">{adminCheckError}</p>}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => router.push('/')}
              >
                Back to Home
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={signingIn}
                onClick={async () => {
                  setSigningIn(true)
                  try {
                    await signIn()
                  } catch (error) {
                    console.error('Admin sign-in failed:', error)
                    alert('Sign in failed. Please allow popups and try again.')
                  } finally {
                    setSigningIn(false)
                  }
                }}
              >
                {signingIn ? 'Signing In...' : 'Sign In with Google'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#eef2f6] py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-[#d9e3ef] bg-white p-8 text-center shadow-sm">
            <h1 className="mb-3 text-3xl font-bold text-[#142842]">Admin Access Required</h1>
            <p className="mb-2 text-[#5a6f8a]">You are signed in, but your account is not authorized to import questions.</p>
            <p className="mb-6 text-sm text-[#5a6f8a]">
              Add <code className="rounded bg-gray-100 px-1.5 py-0.5">admins/{user.uid}</code> with <code className="rounded bg-gray-100 px-1.5 py-0.5">active: true</code>.
            </p>
            {adminCheckError && <p className="mb-4 text-sm text-red-600">{adminCheckError}</p>}

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => router.push('/')} className="btn-secondary">
                Back to Home
              </button>
              <button onClick={() => router.push('/quiz/survey')} className="btn-primary">
                Take Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const previewHasValidRows = Boolean(importResult?.questions.length)
  const previewHasInvalidRows = Boolean(importResult?.failedCount)
  const previewClassName = previewHasValidRows
    ? previewHasInvalidRows
      ? 'bg-yellow-50 border-yellow-200 text-yellow-900'
      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : 'bg-red-50 border-red-200 text-red-900'

  const handleExportLeads = () => {
    if (leads.length === 0) {
      return
    }

    const header = [
      'email',
      'userId',
      'usageFrequency',
      'selfAssessment',
      'difficultyLabel',
      'percentage',
      'reportEmailStatus',
      'reportEmailSentAt',
      'reportEmailDeliveredAt',
      'createdAt',
    ]
    const rows = leads.map((lead) => [
      lead.email,
      lead.userId,
      lead.usageFrequency,
      lead.selfAssessment,
      lead.difficultyLabel,
      lead.percentage ?? '',
      lead.reportEmailStatus ?? '',
      lead.reportEmailSentAt?.toISOString() ?? '',
      lead.reportEmailDeliveredAt?.toISOString() ?? '',
      lead.createdAt.toISOString(),
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'quiz-leads.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleEmailAll = () => {
    if (leads.length === 0) {
      return
    }

    const emails = leads.map((lead) => lead.email).join(';')
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails)}`
  }

  const handleResendLeadReport = async (lead: QuizLead) => {
    setLeadActionMessage(null)
    setLeadActionTone(null)
    setLeadSendingId(lead.id)

    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        throw new Error('missing-id-token')
      }

      const response = await fetch('/api/admin/quiz-results-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          leadId: lead.id,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not resend results email.')
      }

      const refreshedLead = {
        ...lead,
        reportEmailStatus: 'resent',
        reportEmailSentAt: new Date(),
        reportEmailError: undefined,
      }

      setLeads((current) => current.map((item) => (item.id === lead.id ? refreshedLead : item)))
      setLeadActionTone('success')
      setLeadActionMessage(`Report resent to ${lead.email}.`)
    } catch (error) {
      console.error('Failed to resend lead report:', error)
      setLeadActionTone('error')
      setLeadActionMessage(error instanceof Error ? error.message : 'Could not resend the report.')
    } finally {
      setLeadSendingId(null)
    }
  }

  const handleExportTrainingRequests = () => {
    if (trainingRequests.length === 0) {
      return
    }

    const header = ['requestType', 'email', 'phone', 'organization', 'notes', 'createdAt']
    const rows = trainingRequests.map((request) => [
      request.requestType,
      request.email,
      request.phone,
      request.organization,
      request.notes ?? '',
      request.createdAt.toISOString(),
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'training-requests.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleEmailTrainingRequests = () => {
    if (trainingRequests.length === 0) {
      return
    }

    const emails = trainingRequests.map((request) => request.email).join(';')
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails)}`
  }

  const handleCreateBatch = async () => {
    if (!user) {
      return
    }

    const trimmedName = batchName.trim()
    const invitees = normalizeInvitees(batchInvitees)

    if (!trimmedName) {
      setBatchError('Provide a batch name.')
      return
    }

    if (invitees.length === 0) {
      setBatchError('Add at least one valid email address.')
      return
    }

    setBatchError(null)
    setBatchCreating(true)

    try {
      const difficultyLevels = difficultyMap[batchDifficulty]
      const difficultyLabel = difficultyLabelMap[batchDifficulty]

      const docRef = await addDoc(collection(db, 'quizBatches'), {
        name: trimmedName,
        difficultyLevels,
        difficultyLabel,
        invitees,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })

      setBatches((previous) => [
        {
          id: docRef.id,
          name: trimmedName,
          difficultyLevels,
          difficultyLabel,
          invitees,
          createdBy: user.uid,
          createdAt: new Date(),
        },
        ...previous,
      ])

      setStats((previous) =>
        previous
          ? {
              ...previous,
              recentActivity: [
                {
                  action: `Batch created: ${trimmedName}`,
                  timestamp: new Date(),
                  user: user.email || user.uid,
                },
                ...previous.recentActivity.slice(0, 7),
              ],
            }
          : previous
      )

      setBatchName('')
      setBatchInvitees('')
    } catch (error) {
      console.error('Failed to create batch:', error)
      setBatchError('Failed to create batch. Please try again.')
    } finally {
      setBatchCreating(false)
    }
  }

  const handleLoadBatchAttempts = async (batch: QuizBatch) => {
    setSelectedBatch(batch)
    setBatchLoading(true)
    setBatchError(null)

    try {
      const attemptsSnapshot = await getDocs(
        query(
          collection(db, 'quizAttempts'),
          where('batchId', '==', batch.id),
          orderBy('date', 'desc'),
          limit(300)
        )
      )

      const attempts = attemptsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() as { score?: number; userId?: string; date?: unknown }
        const date =
          data.date && typeof data.date === 'object' && 'toDate' in data.date
            ? (data.date as { toDate: () => Date }).toDate()
            : new Date()

        return {
          score: typeof data.score === 'number' ? data.score : 0,
          userId: typeof data.userId === 'string' ? data.userId : 'unknown',
          date,
        }
      })

      setBatchAttempts(attempts)
    } catch (error) {
      console.error('Failed to load batch attempts:', error)
      setBatchError('Failed to load batch results.')
    } finally {
      setBatchLoading(false)
    }
  }

  const buildBatchInviteLink = (batch: QuizBatch) => {
    if (typeof window === 'undefined') {
      return ''
    }
    return `${window.location.origin}/quiz?batchId=${batch.id}`
  }

  const handleCopyBatchLink = async (batch: QuizBatch) => {
    const link = buildBatchInviteLink(batch)
    if (!link) {
      return
    }
    try {
      await navigator.clipboard.writeText(link)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const handleEmailBatch = (batch: QuizBatch) => {
    const link = buildBatchInviteLink(batch)
    const subject = `Excel Assessment: ${batch.name}`
    const body = `Please complete the Excel competency quiz: ${link}`
    const bcc = batch.invitees.join(';')
    window.location.href = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`
  }

  const handleExportBatchPdf = (batch: QuizBatch, attempts: Array<{ score: number; userId: string; date: Date }>) => {
    const averageScore =
      attempts.length > 0
        ? Math.round(attempts.reduce((total, attempt) => total + attempt.score, 0) / attempts.length)
        : 0

    const win = window.open('', '_blank')
    if (!win) {
      return
    }

    const rows = attempts
      .map(
        (attempt) =>
          `<tr><td>${attempt.userId}</td><td>${attempt.score}</td><td>${attempt.date.toLocaleDateString()}</td></tr>`
      )
      .join('')

    win.document.write(`
      <html>
        <head>
          <title>Batch Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f7ff; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${batch.name} Summary</h1>
          <p>Difficulty: ${batch.difficultyLabel}</p>
          <p>Total Invited: ${batch.invitees.length}</p>
          <p>Total Completed: ${attempts.length}</p>
          <p>Average Score: ${averageScore}</p>
          <table>
            <thead>
              <tr><th>User ID</th><th>Score</th><th>Date</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  const handleExportBatchCsv = (batch: QuizBatch, attempts: Array<{ score: number; userId: string; date: Date }>) => {
    const header = ['batchName', 'batchId', 'userId', 'score', 'date']
    const rows = attempts.map((attempt) => [
      batch.name,
      batch.id,
      attempt.userId,
      attempt.score,
      attempt.date.toISOString(),
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${batch.name.replace(/\s+/g, '-')}-results.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#eef2f6] py-6 md:py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] shadow-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#5dd6cf]/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#8fb8ff]/20 blur-3xl" />
            <div className="relative px-7 py-7 md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#c8e8ff]">Administration</p>
                  <h1 className="mt-1 text-3xl font-bold text-white">Corporate Content Dashboard</h1>
                  <p className="mt-2 text-sm text-[#d6ebff]">
                    Manage question inventory, import pipelines, and platform-level analytics.
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <button onClick={() => router.push('/quiz/survey')} className="btn-hero-secondary w-full sm:w-auto">
                    Open Quiz
                  </button>
                  <button onClick={() => router.push('/')} className="btn-hero-primary w-full sm:w-auto">
                    Home
                  </button>
                </div>
              </div>
            </div>
          </section>

          {stats && (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <MetricCard label="Total Questions" value={String(stats.totalQuestions)} />
              <MetricCard label="Total Users" value={String(stats.totalUsers)} />
              <MetricCard label="Quiz Attempts" value={String(stats.totalQuizAttempts)} />
              <MetricCard label="Average Score" value={`${stats.averageScore}%`} />
              <MetricCard label="Training Requests" value={String(requestSnapshot.training)} />
              <MetricCard label="Assessment Requests" value={String(requestSnapshot.assessment)} />
            </section>
          )}

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap gap-2">
              {adminTabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-[#144d6a] bg-[#144d6a] text-white shadow-sm'
                        : 'border-[#dbe5f1] bg-[#f8fbff] text-[#1e3757] hover:bg-white'
                    }`}
                  >
                    <p className="text-sm font-semibold">{tab.label}</p>
                    <p className={`mt-1 text-xs ${isActive ? 'text-[#d6ebff]' : 'text-[#5a6f8a]'}`}>{tab.description}</p>
                  </button>
                )
              })}
            </div>
          </section>

          {activeTab === 'overview' && (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                <h2 className="text-2xl font-semibold text-[#142842]">Platform Snapshot</h2>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                    <p className="text-sm font-semibold text-[#1e3757]">Content Library</p>
                    <p className="mt-2 text-sm text-[#5a6f8a]">
                      Use the Content tab to manage blog publishing, question updates, and CSV imports.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                    <p className="text-sm font-semibold text-[#1e3757]">Analytics Monitoring</p>
                    <p className="mt-2 text-sm text-[#5a6f8a]">
                      Use the Analytics tab to review category trends, traffic sources, and score distribution.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                    <p className="text-sm font-semibold text-[#1e3757]">Batch Operations</p>
                    <p className="mt-2 text-sm text-[#5a6f8a]">
                      Use the Batches tab to create difficulty-based cohorts, share invite links, and export results.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                    <p className="text-sm font-semibold text-[#1e3757]">Lead Follow-up</p>
                    <p className="mt-2 text-sm text-[#5a6f8a]">
                      Use the Outreach tab to manage quiz leads, resend reports, and review training requests.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                <h2 className="mb-4 text-2xl font-semibold text-[#142842]">Recent Activity</h2>
                {stats && stats.recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg border border-[#dbe5f1] bg-[#f8fbff] p-3">
                        <div>
                          <span className="font-medium text-[#1d3d61]">{activity.action}</span>
                          <p className="text-sm text-[#5a6f8a]">{activity.user}</p>
                        </div>
                        <span className="text-xs text-[#5a6f8a]">{activity.timestamp.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#5a6f8a]">No recent admin activity to display yet.</p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'content' && (
            <>
              <section>
                <BlogManager adminName={user?.displayName || user?.email || 'Excel Mastery Team'} />
              </section>
            </>
          )}

          {activeTab === 'questionBank' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                <h2 className="text-2xl font-semibold text-[#142842]">CSV Import</h2>
                <p className="mt-1 mb-4 text-sm text-[#5a6f8a]">Upload validated CSV files to add question batches.</p>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={downloadSampleCSV} className="btn-secondary w-full sm:w-auto">
                      Download Template
                    </button>
                  </div>

                  <div className="rounded-lg border border-[#dbe5f1] bg-[#f8fbff] p-4 text-sm text-[#45637f]">
                    <p className="mb-2 font-semibold">CSV fields required</p>
                    <p><strong>text</strong>, <strong>category</strong>, <strong>option1-4</strong>, <strong>correctAnswer</strong>, <strong>difficulty</strong>, <strong>imageUrl</strong></p>
                  </div>

                  <div className="rounded-lg border-2 border-dashed border-[#c6d7ee] bg-white p-6 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      className="hidden"
                      id="csv-upload"
                      disabled={importing}
                    />
                    <label htmlFor="csv-upload" className={`cursor-pointer ${importing ? 'opacity-50' : ''}`}>
                      <p className="text-sm font-semibold text-[#1d3d61]">{csvFile ? csvFile.name : 'Select CSV file to upload'}</p>
                      <p className="mt-1 text-xs text-[#5a6f8a]">Maximum file size: 5MB</p>
                    </label>
                  </div>

                  {importing && (
                    <div className="flex items-center justify-center py-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-excel-green"></div>
                      <span className="ml-2 text-sm text-[#5a6f8a]">
                        {importResult ? 'Importing valid questions to database...' : 'Validating CSV file...'}
                      </span>
                    </div>
                  )}

                  {importResult && (
                    <div className={`rounded-lg border p-4 ${previewClassName}`}>
                      <h4 className="font-semibold mb-2">
                        {previewHasValidRows ? (previewHasInvalidRows ? 'Import Preview (Partial)' : 'Import Preview') : 'Import Errors'}
                      </h4>
                      <p className="text-sm mb-2">
                        Valid: {importResult.importedCount} | Invalid: {importResult.failedCount}
                      </p>

                      {importResult.warnings?.length ? (
                        <ul className="text-sm space-y-1 mb-2">
                          {importResult.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      ) : null}

                      {importResult.errors.length > 0 && (
                        <ul className="text-sm space-y-1">
                          {importResult.errors.map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {importResult.questions.length > 0 && (
                          <button onClick={handleImportQuestions} className="btn-primary w-full sm:w-auto" disabled={importing}>
                            Import {importResult.questions.length} Valid Question(s)
                          </button>
                        )}
                        {importResult.errors.length > 0 && (
                          <button
                            onClick={() => downloadImportErrorsCSV(importResult.errors)}
                            className="btn-secondary w-full sm:w-auto"
                            disabled={importing}
                          >
                            Download Failed Rows CSV
                          </button>
                        )}
                        <button onClick={handleClearUpload} className="btn-secondary w-full sm:w-auto" disabled={importing}>
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                <h2 className="text-2xl font-semibold text-[#142842]">Question Management</h2>
                <p className="mt-1 mb-4 text-sm text-[#5a6f8a]">Create, edit, and maintain quiz question quality.</p>
                <QuestionManager
                  onQuestionUpdate={() => {
                    setStats((previous) =>
                      previous
                        ? {
                            ...previous,
                            totalQuestions: previous.totalQuestions + 1,
                            recentActivity: [
                              { action: 'Question updated', timestamp: new Date(), user: user.email || 'admin' },
                              ...previous.recentActivity.slice(0, 7),
                            ],
                          }
                        : previous
                    )
                  }}
                />
              </section>
            </div>
          )}

          {activeTab === 'analytics' && (
            <>
              <section className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold text-[#142842]">Category Performance</h2>
                      <p className="mt-1 text-sm text-[#5a6f8a]">Correct answers accumulated by category across quiz attempts.</p>
                    </div>
                  </div>

                  {categoryDistributionEntries.length > 0 ? (
                    <div className="mt-4 h-72">
                      <Doughnut
                        data={{
                          labels: categoryDistributionEntries.map(([label]) => label),
                          datasets: [
                            {
                              data: categoryDistributionEntries.map(([, value]) => value),
                              backgroundColor: categoryDistributionEntries.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom',
                            },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <EmptyAnalyticsState message="No quiz attempt category data yet." />
                  )}
                </div>

                <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                  <h2 className="text-2xl font-semibold text-[#142842]">Attempt Sources</h2>
                  <p className="mt-1 text-sm text-[#5a6f8a]">Where completed quiz attempts are coming from.</p>

                  {sourceDistributionEntries.length > 0 ? (
                    <div className="mt-4 h-72">
                      <Doughnut
                        data={{
                          labels: sourceDistributionEntries.map(([label]) => label),
                          datasets: [
                            {
                              data: sourceDistributionEntries.map(([, value]) => value),
                              backgroundColor: ['#0f2744', '#1f6f6d', '#82b8d7'],
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom',
                            },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <EmptyAnalyticsState message="No completed attempt source data yet." />
                  )}
                </div>

                <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                  <h2 className="text-2xl font-semibold text-[#142842]">Difficulty Mix</h2>
                  <p className="mt-1 text-sm text-[#5a6f8a]">Difficulty levels selected in the quiz survey.</p>

                  {difficultyLevelEntries.some(([, value]) => value > 0) ? (
                    <div className="mt-4 h-72">
                      <Doughnut
                        data={{
                          labels: difficultyLevelEntries.map(([level]) => `Level ${level}`),
                          datasets: [
                            {
                              data: difficultyLevelEntries.map(([, value]) => value),
                              backgroundColor: ['#0f2744', '#144d6a', '#1f6f6d', '#3f86a8', '#94d2bd'],
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom',
                            },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <EmptyAnalyticsState message="No difficulty-level selection data yet." />
                  )}
                </div>

                <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                  <h2 className="text-2xl font-semibold text-[#142842]">Daily Attempts</h2>
                  <p className="mt-1 text-sm text-[#5a6f8a]">Last 14 days of recorded quiz activity.</p>

                  {analyticsDetails && analyticsDetails.dailyAttempts.length > 0 ? (
                    <div className="mt-4 h-72">
                      <Bar
                        data={{
                          labels: analyticsDetails.dailyAttempts.map((entry) => entry.date),
                          datasets: [
                            {
                              label: 'Attempts',
                              data: analyticsDetails.dailyAttempts.map((entry) => entry.attempts),
                              backgroundColor: '#144d6a',
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            y: { beginAtZero: true, ticks: { precision: 0 } },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <EmptyAnalyticsState message="No daily attempt trend available yet." />
                  )}
                </div>
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                  <h2 className="text-2xl font-semibold text-[#142842]">Analytics Highlights</h2>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                      <p className="text-sm font-semibold text-[#1e3757]">Weak Categories</p>
                      {analyticsDetails && analyticsDetails.weakCategoryCounts.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {analyticsDetails.weakCategoryCounts.map((entry) => (
                            <div key={entry.category} className="flex items-center justify-between rounded-md border border-[#e2e8f2] bg-white px-3 py-2 text-sm">
                              <span className="text-[#1e3757]">{entry.category}</span>
                              <span className="font-semibold text-[#1e3757]">{entry.misses} misses</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[#5a6f8a]">No weak-category trend yet.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                      <p className="text-sm font-semibold text-[#1e3757]">Score Bands</p>
                      {scoreBandEntries.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {scoreBandEntries.map(([band, value]) => (
                            <div key={band} className="flex items-center justify-between rounded-md border border-[#e2e8f2] bg-white px-3 py-2 text-sm">
                              <span className="text-[#1e3757]">{band}</span>
                              <span className="font-semibold text-[#1e3757]">{value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[#5a6f8a]">No score-band distribution yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                    <p className="text-sm font-semibold text-[#1e3757]">Landing Traffic Sources</p>
                    {landingSourceEntries.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {landingSourceEntries.map(([source, value]) => (
                          <span
                            key={source}
                            className="inline-flex items-center rounded-full border border-[#cfdceb] bg-white px-3 py-1 text-sm text-[#1e3757]"
                          >
                            {source}: {value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[#5a6f8a]">No landing analytics events recorded yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                  <h2 className="mb-4 text-2xl font-semibold text-[#142842]">Recent Activity</h2>
                  {stats && stats.recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {stats.recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg border border-[#dbe5f1] bg-[#f8fbff] p-3">
                          <div>
                            <span className="font-medium text-[#1d3d61]">{activity.action}</span>
                            <p className="text-sm text-[#5a6f8a]">{activity.user}</p>
                          </div>
                          <span className="text-xs text-[#5a6f8a]">{activity.timestamp.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#5a6f8a]">No recent admin activity to display yet.</p>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === 'batches' && (
            <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#142842]">Administered Batches</h2>
                <p className="mt-1 text-sm text-[#5a6f8a]">
                  Create difficulty-based assessments and invite participants by email.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.1fr]">
              <div className="rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                <h3 className="text-lg font-semibold text-[#1e3757]">Create Batch</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-[#1e3757]">Batch Name</label>
                    <input
                      value={batchName}
                      onChange={(event) => setBatchName(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                      placeholder="Q2 Hiring Cohort"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#1e3757]">Difficulty</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['Novice', 'Intermediate', 'Advanced', 'Legend'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setBatchDifficulty(level)}
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                            batchDifficulty === level
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : 'border-[#dbe5f1] bg-white text-[#1e3757]'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#1e3757]">Invitee Emails</label>
                    <textarea
                      value={batchInvitees}
                      onChange={(event) => setBatchInvitees(event.target.value)}
                      rows={5}
                      className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                      placeholder="user1@company.com, user2@company.com"
                    />
                    <p className="mt-1 text-xs text-[#5a6f8a]">Separate by commas or new lines.</p>
                  </div>
                </div>

                {batchError && <p className="mt-2 text-sm text-red-600">{batchError}</p>}

                <button
                  onClick={handleCreateBatch}
                  className="btn-primary mt-4 w-full"
                  disabled={batchCreating}
                >
                  {batchCreating ? 'Creating...' : 'Create Batch'}
                </button>
              </div>

              <div className="rounded-xl border border-[#dbe5f1] bg-white p-4">
                <h3 className="text-lg font-semibold text-[#1e3757]">Batch List</h3>
                {batches.length === 0 ? (
                  <p className="mt-3 text-sm text-[#5a6f8a]">No batches created yet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {batches.map((batch) => (
                      <div key={batch.id} className="rounded-lg border border-[#dbe5f1] bg-[#f9fbff] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#1e3757]">{batch.name}</p>
                            <p className="text-xs text-[#5a6f8a]">{batch.difficultyLabel}</p>
                            <p className="text-xs text-[#5a6f8a]">{batch.invitees.length} invitees</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleCopyBatchLink(batch)}
                              className="btn-secondary w-full sm:w-auto"
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => handleEmailBatch(batch)}
                              className="btn-secondary w-full sm:w-auto"
                            >
                              Email Invite
                            </button>
                            <button
                              onClick={() => handleLoadBatchAttempts(batch)}
                              className="btn-secondary w-full sm:w-auto"
                            >
                              View Results
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedBatch && (
              <div className="mt-6 rounded-xl border border-[#dbe5f1] bg-[#f9fbff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1e3757]">{selectedBatch.name} Results</h3>
                    <p className="text-xs text-[#5a6f8a]">{selectedBatch.difficultyLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleExportBatchCsv(selectedBatch, batchAttempts)}
                      className="btn-secondary w-full sm:w-auto"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => handleExportBatchPdf(selectedBatch, batchAttempts)}
                      className="btn-secondary w-full sm:w-auto"
                    >
                      Export PDF
                    </button>
                  </div>
                </div>

                {batchLoading ? (
                  <p className="mt-3 text-sm text-[#5a6f8a]">Loading batch results...</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-[#dbe5f1] bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-[#5f7491]">Invited</p>
                      <p className="mt-1 text-lg font-semibold text-[#1e3757]">{selectedBatch.invitees.length}</p>
                    </div>
                    <div className="rounded-lg border border-[#dbe5f1] bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-[#5f7491]">Completed</p>
                      <p className="mt-1 text-lg font-semibold text-[#1e3757]">{batchAttempts.length}</p>
                    </div>
                    <div className="rounded-lg border border-[#dbe5f1] bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-[#5f7491]">Average Score</p>
                      <p className="mt-1 text-lg font-semibold text-[#1e3757]">
                        {batchAttempts.length > 0
                          ? Math.round(
                              batchAttempts.reduce((total, attempt) => total + attempt.score, 0) / batchAttempts.length
                            )
                          : 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#dbe5f1] bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-[#5f7491]">Completion Rate</p>
                      <p className="mt-1 text-lg font-semibold text-[#1e3757]">
                        {selectedBatch.invitees.length > 0
                          ? Math.round((batchAttempts.length / selectedBatch.invitees.length) * 100)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                )}

                {!batchLoading && batchAttempts.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-lg border border-[#dbe5f1] bg-white p-4">
                      <p className="text-sm font-semibold text-[#1e3757]">Score Distribution</p>
                      <div className="mt-3 h-48">
                        <Bar
                          data={{
                            labels: ['0-39', '40-59', '60-79', '80-100'],
                            datasets: [
                              {
                                label: 'Participants',
                                data: [
                                  batchAttempts.filter((attempt) => attempt.score < 40).length,
                                  batchAttempts.filter((attempt) => attempt.score >= 40 && attempt.score < 60).length,
                                  batchAttempts.filter((attempt) => attempt.score >= 60 && attempt.score < 80).length,
                                  batchAttempts.filter((attempt) => attempt.score >= 80).length,
                                ],
                                backgroundColor: ['#f87171', '#fbbf24', '#34d399', '#22c55e'],
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              y: { beginAtZero: true, ticks: { stepSize: 1 } },
                            },
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#dbe5f1] bg-white p-4">
                      <p className="text-sm font-semibold text-[#1e3757]">Top Performers</p>
                      <div className="mt-3 space-y-2">
                        {batchAttempts
                          .slice()
                          .sort((a, b) => b.score - a.score)
                          .slice(0, 5)
                          .map((attempt, index) => (
                            <div
                              key={`${attempt.userId}-${index}`}
                              className="flex items-center justify-between rounded-md border border-[#e2e8f2] bg-[#f9fbff] px-3 py-2 text-sm"
                            >
                              <span className="text-[#1e3757]">{attempt.userId}</span>
                              <span className="font-semibold text-[#1e3757]">{attempt.score}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {!batchLoading && batchAttempts.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-[#5f7491]">
                        <tr>
                          <th className="px-3 py-2">User</th>
                          <th className="px-3 py-2">Score</th>
                          <th className="px-3 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchAttempts
                          .slice()
                          .sort((a, b) => b.score - a.score)
                          .map((attempt, index) => (
                            <tr key={`${attempt.userId}-${index}`} className="border-t border-[#e2e8f2]">
                              <td className="px-3 py-2 text-[#1e3757]">{attempt.userId}</td>
                              <td className="px-3 py-2 text-[#5a6f8a]">{attempt.score}</td>
                              <td className="px-3 py-2 text-[#5a6f8a]">{attempt.date.toLocaleDateString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            </section>
          )}

          {activeTab === 'outreach' && (
            <>
              <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-[#142842]">Quiz Leads</h2>
                    <p className="mt-1 text-sm text-[#5a6f8a]">
                      Emails captured after quiz completion, with delivery tracking for detailed report sends.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportLeads} className="btn-secondary w-full sm:w-auto">
                      Export CSV
                    </button>
                    <button onClick={handleEmailAll} className="btn-secondary w-full sm:w-auto">
                      Email All
                    </button>
                  </div>
                </div>

                {leadActionMessage ? (
                  <div
                    className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                      leadActionTone === 'success'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                        : leadActionTone === 'warning'
                          ? 'border border-amber-200 bg-amber-50 text-amber-800'
                          : 'border border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {leadActionMessage}
                  </div>
                ) : null}

                {leadsLoading ? (
                  <p className="mt-4 text-sm text-[#5a6f8a]">Loading leads...</p>
                ) : leads.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-[#5f7491]">
                        <tr>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Score</th>
                          <th className="px-3 py-2">Usage</th>
                          <th className="px-3 py-2">Self-Assessment</th>
                          <th className="px-3 py-2">Difficulty</th>
                          <th className="px-3 py-2">Email Status</th>
                          <th className="px-3 py-2">Captured</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => (
                          <tr key={lead.id} className="border-t border-[#e2e8f2]">
                            <td className="px-3 py-2 font-medium text-[#1e3757]">{lead.email}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{typeof lead.percentage === 'number' ? `${lead.percentage}%` : '—'}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{lead.usageFrequency}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{lead.selfAssessment}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{lead.difficultyLabel}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${getLeadStatusTone(lead.reportEmailStatus)}`}>
                                  {formatLeadStatus(lead.reportEmailStatus)}
                                </span>
                                {lead.reportEmailDeliveredAt ? (
                                  <span className="text-xs text-[#5a6f8a]">
                                    Delivered {lead.reportEmailDeliveredAt.toLocaleDateString()}
                                  </span>
                                ) : lead.reportEmailSentAt ? (
                                  <span className="text-xs text-[#5a6f8a]">
                                    Sent {lead.reportEmailSentAt.toLocaleDateString()}
                                  </span>
                                ) : lead.reportEmailError ? (
                                  <span className="max-w-[220px] truncate text-xs text-red-600">{lead.reportEmailError}</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{lead.createdAt.toLocaleDateString()}</td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => void handleResendLeadReport(lead)}
                                className="btn-secondary w-full sm:w-auto"
                                disabled={leadSendingId === lead.id}
                              >
                                {leadSendingId === lead.id ? 'Sending...' : 'Resend Report'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#5a6f8a]">No quiz leads captured yet.</p>
                )}
              </section>

              <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-[#142842]">Training Requests</h2>
                    <p className="mt-1 text-sm text-[#5a6f8a]">
                      Requests for training or internal assessments submitted from the training page.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportTrainingRequests} className="btn-secondary w-full sm:w-auto">
                      Export CSV
                    </button>
                    <button onClick={handleEmailTrainingRequests} className="btn-secondary w-full sm:w-auto">
                      Email All
                    </button>
                  </div>
                </div>

                {trainingRequestsLoading ? (
                  <p className="mt-4 text-sm text-[#5a6f8a]">Loading requests...</p>
                ) : trainingRequests.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-[#5f7491]">
                        <tr>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Organization</th>
                          <th className="px-3 py-2">Notes</th>
                          <th className="px-3 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingRequests.map((request) => (
                          <tr key={request.id} className="border-t border-[#e2e8f2]">
                            <td className="px-3 py-2 text-[#1e3757]">{request.requestType}</td>
                            <td className="px-3 py-2 text-[#1e3757]">{request.email}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{request.phone}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{request.organization}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{request.notes ?? '-'}</td>
                            <td className="px-3 py-2 text-[#5a6f8a]">{request.createdAt.toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#5a6f8a]">No training requests yet.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-[#d9e3ef] bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-[#5f7491]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[#142842]">{value}</p>
    </article>
  )
}

function formatLeadStatus(status?: string) {
  if (!status) {
    return 'Pending'
  }

  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getLeadStatusTone(status?: string) {
  switch (status) {
    case 'delivered':
    case 'opened':
    case 'clicked':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'sent':
    case 'resent':
    case 'delivery_delayed':
      return 'border-blue-200 bg-blue-50 text-blue-800'
    case 'bounced':
    case 'failed':
    case 'complained':
    case 'suppressed':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function EmptyAnalyticsState({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-[#dbe5f1] bg-[#f8fbff] px-6 text-center text-sm text-[#5a6f8a]">
      {message}
    </div>
  )
}
