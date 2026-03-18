import { NextResponse } from 'next/server'

function getBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) {
    return configured
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  return host ? `${proto}://${host}` : ''
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const payload = await request.json().catch(() => null)

  if (!token || !phoneNumberId) {
    return NextResponse.json({ ok: true })
  }

  const entries = Array.isArray(payload?.entry) ? payload.entry : []
  const messages = entries.flatMap((entry: any) =>
    Array.isArray(entry?.changes) ? entry.changes.flatMap((change: any) => change?.value?.messages || []) : []
  )

  if (messages.length === 0) {
    return NextResponse.json({ ok: true })
  }

  const baseUrl = getBaseUrl(request)
  const quizLink = `${baseUrl}/quiz/survey?source=whatsapp`
  const body = `Welcome to the Excel Quiz. Start here: ${quizLink}`

  await Promise.all(
    messages.map((message: any) => {
      const to = message.from
      if (!to) {
        return Promise.resolve()
      }

      return fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: body },
            action: {
              buttons: [
                { type: 'url', url: quizLink, title: 'Start Quiz' },
              ],
            },
          },
        }),
      })
    })
  )

  return NextResponse.json({ ok: true })
}
