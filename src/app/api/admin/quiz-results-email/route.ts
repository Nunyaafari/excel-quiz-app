import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, assertAdminUser, verifyBearerToken } from '@/lib/firebase-admin'
import { normalizeResultsEmailPayload, sendResultsEmail, type ResultsEmailPayload } from '@/lib/results-email'

export const runtime = 'nodejs'

function toDisplayDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (value instanceof Date) {
    return value.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
  }

  return 'Recently'
}

function buildPayloadFromLeadRecord(raw: Record<string, unknown>, fallbackEmail: string): ResultsEmailPayload | null {
  const categoryScores = Array.isArray(raw.categoryBreakdown) ? raw.categoryBreakdown : []
  const recommendations = Array.isArray(raw.recommendations) ? raw.recommendations : []
  const normalized = normalizeResultsEmailPayload({
    email: typeof raw.email === 'string' ? raw.email : fallbackEmail,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : 'Excel Quiz Participant',
    percentage: typeof raw.percentage === 'number' ? raw.percentage : 0,
    totalScore: typeof raw.score === 'number' ? raw.score : 0,
    maxScore:
      typeof raw.totalQuestions === 'number' && raw.totalQuestions > 0
        ? raw.totalQuestions * 10
        : 10,
    correctAnswers: typeof raw.correctAnswers === 'number' ? raw.correctAnswers : 0,
    totalQuestions: typeof raw.totalQuestions === 'number' ? raw.totalQuestions : 0,
    performanceLabel: typeof raw.performanceLabel === 'string' ? raw.performanceLabel : 'Performance Summary',
    profileLabel: typeof raw.difficultyLabel === 'string' ? raw.difficultyLabel : 'Mixed Difficulty',
    completedLabel: toDisplayDate(raw.createdAt),
    categoryScores,
    recommendations,
    questionReview: [],
    shareCaption: typeof raw.shareCaption === 'string' ? raw.shareCaption : '',
    shareUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/quiz/survey` : '',
    reportText:
      typeof raw.reportText === 'string' && raw.reportText.trim()
        ? raw.reportText
        : `Excel quiz report for ${typeof raw.email === 'string' ? raw.email : fallbackEmail}`,
  })

  return normalized
}

export async function POST(request: Request) {
  try {
    const decodedToken = await verifyBearerToken(request)
    await assertAdminUser(decodedToken.uid)

    const body = (await request.json().catch(() => null)) as { leadId?: string } | null
    const leadId = typeof body?.leadId === 'string' ? body.leadId.trim() : ''
    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required.' }, { status: 400 })
    }

    const leadRef = adminDb.collection('quizLeads').doc(leadId)
    const leadSnapshot = await leadRef.get()
    if (!leadSnapshot.exists) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
    }

    const leadData = (leadSnapshot.data() || {}) as Record<string, unknown>
    const payload = buildPayloadFromLeadRecord(leadData, '')
    if (!payload) {
      return NextResponse.json({ error: 'Lead does not contain enough data to resend a report.' }, { status: 400 })
    }

    const result = await sendResultsEmail(payload, {
      leadId,
      userId: typeof leadData.userId === 'string' ? leadData.userId : undefined,
      attemptId: typeof leadData.attemptId === 'string' ? leadData.attemptId : undefined,
      idempotencyKey: `quiz-results-resend-${leadId}-${Date.now()}`,
    })

    await leadRef.update({
      reportEmailStatus: 'resent',
      reportEmailId: result.id,
      reportEmailResentAt: FieldValue.serverTimestamp(),
      reportEmailLastRequestedBy: decodedToken.uid,
      reportEmailError: FieldValue.delete(),
    })

    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    console.error('Admin resend results email failed:', error)

    if (error instanceof Error && error.message === 'missing-auth-token') {
      return NextResponse.json({ error: 'Please sign in again and retry.' }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
    }

    if (error instanceof Error && error.message === 'results-email-not-configured') {
      return NextResponse.json(
        { error: 'Results email is not configured yet. Add RESEND_API_KEY and QUIZ_RESULTS_FROM_EMAIL.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Could not resend the results email right now.' },
      { status: 502 }
    )
  }
}
