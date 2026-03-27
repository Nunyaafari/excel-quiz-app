import { NextResponse } from 'next/server'
import { sendResultsEmail, normalizeResultsEmailPayload, type ResultsEmailPayload } from '@/lib/results-email'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let leadId = ''

  try {
    const body = (await request.json().catch(() => null)) as (Partial<ResultsEmailPayload> & {
      leadId?: string
      attemptId?: string
    }) | null

    leadId = typeof body?.leadId === 'string' ? body.leadId.trim() : ''
    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required.' }, { status: 400 })
    }

    const payload = normalizeResultsEmailPayload(body)
    if (!payload) {
      return NextResponse.json({ error: 'A valid recipient email is required.' }, { status: 400 })
    }

    const leadSnapshot = await adminDb.collection('quizLeads').doc(leadId).get()
    const leadData = leadSnapshot.data() as { userId?: unknown; email?: unknown } | undefined
    if (!leadSnapshot.exists) {
      return NextResponse.json({ error: 'That lead record could not be found.' }, { status: 404 })
    }

    if (typeof leadData?.email === 'string' && leadData.email !== payload.email) {
      return NextResponse.json(
        { error: 'Lead email does not match the requested recipient.' },
        { status: 409 }
      )
    }

    const result = await sendResultsEmail(payload, {
      leadId,
      userId: typeof leadData?.userId === 'string' ? leadData.userId : undefined,
      attemptId: typeof body?.attemptId === 'string' ? body.attemptId : undefined,
    })

    await adminDb.collection('quizLeads').doc(leadId).set(
      {
        reportEmailStatus: 'sent',
        reportEmailId: result.id ?? null,
        reportEmailSentAt: new Date(),
        reportEmailError: null,
      },
      { merge: true }
    )

    const attemptId = typeof body?.attemptId === 'string' ? body.attemptId.trim() : ''
    if (attemptId) {
      const attemptRef = adminDb.collection('quizAttempts').doc(attemptId)
      const attemptSnapshot = await attemptRef.get()
      const attemptData = attemptSnapshot.data() as { userId?: unknown } | undefined
      const leadUserId = typeof leadData?.userId === 'string' ? leadData.userId : ''
      const canUpdateAttempt =
        !leadUserId || !attemptData?.userId || attemptData.userId === leadUserId

      if (attemptSnapshot.exists && canUpdateAttempt) {
        await attemptRef.set(
          {
            respondentEmail: payload.email,
          },
          { merge: true }
        )
      }
    }

    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    console.error('Results email route failed:', error)

    if (error instanceof Error && error.message === 'results-email-not-configured') {
      if (leadId) {
        await adminDb.collection('quizLeads').doc(leadId).set(
          {
            reportEmailStatus: 'failed',
            reportEmailError: 'results-email-not-configured',
            reportEmailFailedAt: new Date(),
          },
          { merge: true }
        )
      }

      return NextResponse.json(
        { error: 'Results email is not configured yet. Add RESEND_API_KEY and QUIZ_RESULTS_FROM_EMAIL.' },
        { status: 503 }
      )
    }

    if (leadId) {
      await adminDb.collection('quizLeads').doc(leadId).set(
        {
          reportEmailStatus: 'failed',
          reportEmailError: error instanceof Error ? error.message : 'results-email-send-failed',
          reportEmailFailedAt: new Date(),
        },
        { merge: true }
      )
    }

    return NextResponse.json(
      { error: 'We could not send the results email right now.' },
      { status: 502 }
    )
  }
}
