import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { Webhook } from 'svix'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

type ResendWebhookEvent = {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[]
    tags?: Record<string, string>
    subject?: string
    from?: string
  }
}

function statusFromEventType(type: string): string {
  switch (type) {
    case 'email.sent':
      return 'sent'
    case 'email.delivered':
      return 'delivered'
    case 'email.delivery_delayed':
      return 'delivery_delayed'
    case 'email.bounced':
      return 'bounced'
    case 'email.complained':
      return 'complained'
    case 'email.clicked':
      return 'clicked'
    case 'email.opened':
      return 'opened'
    case 'email.failed':
      return 'failed'
    case 'email.suppressed':
      return 'suppressed'
    default:
      return type.replace(/^email\./, '')
  }
}

async function findLeadRef(event: ResendWebhookEvent) {
  const leadId = event.data?.tags?.lead_id
  if (leadId) {
    return adminDb.collection('quizLeads').doc(leadId)
  }

  const emailId = event.data?.email_id
  if (!emailId) {
    return null
  }

  const snapshot = await adminDb.collection('quizLeads').where('reportEmailId', '==', emailId).limit(1).get()
  if (snapshot.empty) {
    return null
  }

  return snapshot.docs[0].ref
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing RESEND_WEBHOOK_SECRET.' }, { status: 503 })
  }

  const payload = await request.text()
  const headers = {
    'svix-id': request.headers.get('svix-id') || '',
    'svix-timestamp': request.headers.get('svix-timestamp') || '',
    'svix-signature': request.headers.get('svix-signature') || '',
  }

  let event: ResendWebhookEvent

  try {
    const webhook = new Webhook(webhookSecret)
    event = webhook.verify(payload, headers) as ResendWebhookEvent
  } catch (error) {
    console.error('Invalid Resend webhook signature:', error)
    return new NextResponse('Invalid webhook signature', { status: 400 })
  }

  const leadRef = await findLeadRef(event)
  if (!leadRef) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const status = statusFromEventType(event.type)
  const eventTimestamp =
    event.created_at && !Number.isNaN(new Date(event.created_at).getTime())
      ? new Date(event.created_at)
      : new Date()

  const updatePayload: Record<string, unknown> = {
    reportEmailStatus: status,
    reportEmailLastEvent: event.type,
    reportEmailLastEventAt: eventTimestamp,
    reportEmailWebhookReceivedAt: FieldValue.serverTimestamp(),
    reportEmailId: event.data?.email_id || null,
    reportEmailRecipient: Array.isArray(event.data?.to) ? event.data?.to[0] || null : null,
  }

  if (event.type === 'email.sent') {
    updatePayload.reportEmailSentAt = eventTimestamp
  }
  if (event.type === 'email.delivered') {
    updatePayload.reportEmailDeliveredAt = eventTimestamp
  }
  if (event.type === 'email.opened') {
    updatePayload.reportEmailOpenedAt = eventTimestamp
    updatePayload.reportEmailOpenCount = FieldValue.increment(1)
  }
  if (event.type === 'email.clicked') {
    updatePayload.reportEmailClickedAt = eventTimestamp
    updatePayload.reportEmailClickCount = FieldValue.increment(1)
  }
  if (event.type === 'email.bounced' || event.type === 'email.failed' || event.type === 'email.complained' || event.type === 'email.suppressed') {
    updatePayload.reportEmailFailedAt = eventTimestamp
  }

  await leadRef.set(updatePayload, { merge: true })

  return NextResponse.json({ ok: true })
}
