import { NextResponse } from 'next/server'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export const runtime = 'nodejs'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const systemPrompt =
  'You are a helpful Excel tutor. Answer general Excel questions clearly and concisely. ' +
  'Provide step-by-step guidance for formulas, functions, charts, and shortcuts. ' +
  'If you are unsure, say so and suggest how to verify.'

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

function checkRateLimit(request: Request) {
  const max = Number(process.env.CHAT_RATE_LIMIT_MAX || 30)
  const windowSeconds = Number(process.env.CHAT_RATE_LIMIT_WINDOW_SEC || 60)
  const now = Date.now()
  const key = getClientKey(request)

  const current = rateLimitStore.get(key)
  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return { allowed: true, remaining: max - 1 }
  }

  if (current.count >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now }
  }

  current.count += 1
  rateLimitStore.set(key, current)
  return { allowed: true, remaining: Math.max(0, max - current.count) }
}

function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') {
        return false
      }
      const candidate = item as ChatMessage
      return (
        (candidate.role === 'user' || candidate.role === 'assistant') &&
        typeof candidate.content === 'string' &&
        candidate.content.trim().length > 0
      )
    })
    .slice(-8)
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { reply: 'The Excel assistant is not configured yet.' },
      { status: 501 }
    )
  }

  const limiter = checkRateLimit(request)
  if (!limiter.allowed) {
    const retry = Math.ceil((limiter.retryAfterMs || 0) / 1000)
    return NextResponse.json(
      { reply: `Rate limit reached. Please wait ${retry}s and try again.` },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  const body = await request.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ reply: 'Please enter a question.' }, { status: 400 })
  }

  if (message.length > 800) {
    return NextResponse.json({ reply: 'Please keep questions under 800 characters.' }, { status: 400 })
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const history = sanitizeHistory(body?.history)

  const payload = {
    model,
    temperature: 0.3,
    max_tokens: 400,
    messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }],
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenAI error:', errorText)
    return NextResponse.json({ reply: 'The assistant is temporarily unavailable.' }, { status: 502 })
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const reply = data.choices?.[0]?.message?.content?.trim() || 'I am not sure about that. Try rephrasing.'

  try {
    await addDoc(collection(db, 'analyticsEvents'), {
      type: 'chat_message',
      source: body?.source || 'web',
      model,
      promptLength: message.length,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Failed to log chat analytics:', error)
  }

  return NextResponse.json({ reply })
}
