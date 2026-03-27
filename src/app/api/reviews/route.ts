import { NextResponse } from 'next/server'
import { adminDb, verifyBearerToken } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

function sanitizeReviewComment(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .replace(/\uFEFF/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

function sanitizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .replace(/\uFEFF/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      rating?: unknown
      comment?: unknown
      displayName?: unknown
      userId?: unknown
    } | null

    let decodedToken:
      | Awaited<ReturnType<typeof verifyBearerToken>>
      | null = null

    const authorization = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authorization?.startsWith('Bearer ')) {
      try {
        decodedToken = await verifyBearerToken(request)
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'missing-auth-token') {
          throw error
        }
      }
    }

    const rating = typeof body?.rating === 'number' ? Math.trunc(body.rating) : NaN
    const comment = sanitizeReviewComment(body?.comment)

    if (![1, 2, 3, 4, 5].includes(rating)) {
      return NextResponse.json({ error: 'Please choose a rating between 1 and 5.' }, { status: 400 })
    }

    if (!comment) {
      return NextResponse.json({ error: 'Please enter a short review before submitting.' }, { status: 400 })
    }

    await adminDb.collection('reviews').add({
      userId:
        (decodedToken?.uid && decodedToken.uid.trim()) ||
        (typeof body?.userId === 'string' && body.userId.trim()) ||
        'guest',
      displayName:
        (typeof decodedToken?.name === 'string' && decodedToken.name.trim()) ||
        (typeof decodedToken?.email === 'string' && decodedToken.email.trim()) ||
        sanitizeDisplayName(body?.displayName) ||
        'Participant',
      rating,
      comment,
      createdAt: new Date(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Review submission route failed:', error)

    return NextResponse.json({ error: 'We could not submit your review right now.' }, { status: 502 })
  }
}
