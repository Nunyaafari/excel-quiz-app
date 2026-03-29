'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const starterMessage: ChatMessage = {
  id: 'starter',
  role: 'assistant',
  content: 'Ask me anything about Excel. I can help with formulas, charts, shortcuts, and pivots.',
}

export default function ChatWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([starterMessage])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bottomOffset, setBottomOffset] = useState(20)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const hideOnQuizRoute = pathname === '/quiz' || pathname.startsWith('/quiz/')

  const historyPayload = useMemo(
    () =>
      messages
        .filter((message) => message.id !== 'starter')
        .slice(-8)
        .map((message) => ({ role: message.role, content: message.content })),
    [messages]
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  useEffect(() => {
    if (hideOnQuizRoute) {
      setOpen(false)
    }
  }, [hideOnQuizRoute])

  useEffect(() => {
    let frameId = 0

    const updateOffset = () => {
      frameId = 0

      const footer = document.querySelector('footer')
      if (!(footer instanceof HTMLElement)) {
        setBottomOffset(20)
        return
      }

      const footerRect = footer.getBoundingClientRect()
      const footerOverlap = Math.max(0, window.innerHeight - footerRect.top)
      setBottomOffset(footerOverlap > 0 ? footerOverlap + 20 : 20)
    }

    const scheduleUpdate = () => {
      if (frameId !== 0) {
        return
      }

      frameId = window.requestAnimationFrame(updateOffset)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) {
      return
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: historyPayload, source: 'web' }),
      })

      if (!response.ok) {
        throw new Error('Chat request failed')
      }

      const data = (await response.json()) as { reply?: string }
      const reply = data.reply?.trim() || 'I am not sure about that. Can you rephrase?'

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: reply,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat error:', err)
      setError('We could not reach the Excel assistant. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (hideOnQuizRoute) {
    return null
  }

  return (
    <div className="fixed right-4 z-50 sm:right-5" style={{ bottom: `${bottomOffset}px` }}>
      {open && (
        <div className="mb-3 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#d9e3ef] bg-white shadow-xl">
          <div className="bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#c8e8ff]">Excel Assistant</p>
                <p className="text-sm font-semibold">Ask me anything</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/30 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 ${
                  message.role === 'user'
                    ? 'ml-auto bg-[#e7edf7] text-[#142842]'
                    : 'mr-auto bg-[#f4f7f5] text-[#1e3757]'
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>

          <div className="border-t border-[#e2e8f2] px-3 py-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder="Ask an Excel question..."
                className="flex-1 rounded-lg border border-[#dbe5f1] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
              />
              <button onClick={handleSend} className="btn-primary px-4" disabled={sending}>
                {sending ? '...' : 'Send'}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1f6f6d] text-white shadow-lg"
        aria-label="Open Excel assistant"
      >
        Ask
      </button>
    </div>
  )
}
