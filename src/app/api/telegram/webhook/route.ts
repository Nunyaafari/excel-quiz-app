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

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const payload = await request.json().catch(() => null)
  const message = payload?.message

  if (!message || !message.chat || !message.chat.id) {
    return NextResponse.json({ ok: true })
  }

  if (!token) {
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  const textMessage = typeof message.text === 'string' ? message.text.trim().toLowerCase() : ''
  if (textMessage === '/start' || textMessage === '/help') {
    await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'Start the Excel quiz' },
          { command: 'quiz', description: 'Get the quiz link' },
          { command: 'help', description: 'How this works' },
        ],
      }),
    })
  }

  const quizLink = `${getBaseUrl(request)}/quiz/survey?source=telegram`
  const text =
    `Welcome to the Excel Quiz. Click the link to start your assessment:\n${quizLink}\n` +
    'After the intro, you will continue in the web quiz.'

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Start Quiz', url: quizLink }],
          [{ text: 'Need Help?', callback_data: 'help' }],
        ],
      },
    }),
  })

  return NextResponse.json({ ok: true })
}
