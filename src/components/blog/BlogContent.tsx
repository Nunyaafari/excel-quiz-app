import { Fragment } from 'react'

type BlogContentProps = {
  content: string
}

type InlineTokenMatch =
  | { type: 'link'; index: number; raw: string; text: string; href: string }
  | { type: 'bold'; index: number; raw: string; text: string }
  | { type: 'italic'; index: number; raw: string; text: string }
  | { type: 'code'; index: number; raw: string; text: string }

const imageBlockPattern = /^!\[([^\]]*)\]\(([^)]+)\)$/

function renderInlineContent(input: string) {
  const nodes: Array<string | JSX.Element> = []
  let remaining = input
  let keyIndex = 0

  const pickNextMatch = (value: string): InlineTokenMatch | null => {
    const link = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(value)
    const bold = /\*\*([^*]+)\*\*/.exec(value)
    const code = /`([^`]+)`/.exec(value)
    const italic = /\*([^*]+)\*/.exec(value)

    const candidates: InlineTokenMatch[] = []

    if (link) {
      candidates.push({ type: 'link', index: link.index, raw: link[0], text: link[1], href: link[2] })
    }
    if (bold) {
      candidates.push({ type: 'bold', index: bold.index, raw: bold[0], text: bold[1] })
    }
    if (code) {
      candidates.push({ type: 'code', index: code.index, raw: code[0], text: code[1] })
    }
    if (italic) {
      candidates.push({ type: 'italic', index: italic.index, raw: italic[0], text: italic[1] })
    }

    if (candidates.length === 0) {
      return null
    }

    return candidates.reduce((best, current) => {
      if (current.index < best.index) {
        return current
      }
      if (current.index > best.index) {
        return best
      }

      const rank = { link: 0, bold: 1, code: 2, italic: 3 } as const
      if (rank[current.type] < rank[best.type]) {
        return current
      }
      if (rank[current.type] > rank[best.type]) {
        return best
      }
      return current.raw.length > best.raw.length ? current : best
    })
  }

  while (remaining.length > 0) {
    const match = pickNextMatch(remaining)
    if (!match) {
      nodes.push(remaining)
      break
    }

    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index))
    }

    if (match.type === 'link') {
      const external = match.href.startsWith('http://') || match.href.startsWith('https://')
      nodes.push(
        <a
          key={`inline-${keyIndex}`}
          href={match.href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          className="font-medium text-[#1e3757] underline decoration-[#aac0de] underline-offset-4 hover:text-[#0f2744]"
        >
          {match.text}
        </a>
      )
    }

    if (match.type === 'bold') {
      nodes.push(
        <strong key={`inline-${keyIndex}`} className="font-semibold text-[#142842]">
          {match.text}
        </strong>
      )
    }

    if (match.type === 'italic') {
      nodes.push(
        <em key={`inline-${keyIndex}`} className="italic text-[#1e3757]">
          {match.text}
        </em>
      )
    }

    if (match.type === 'code') {
      nodes.push(
        <code
          key={`inline-${keyIndex}`}
          className="rounded-md bg-[#eef5ff] px-1.5 py-0.5 font-mono text-[0.95em] text-[#1e3757]"
        >
          {match.text}
        </code>
      )
    }

    keyIndex += 1
    remaining = remaining.slice(match.index + match.raw.length)
  }

  return nodes.map((node, index) => (typeof node === 'string' ? <Fragment key={`txt-${index}`}>{node}</Fragment> : node))
}

function renderBlocks(content: string) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block, index) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const firstLine = lines[0] ?? ''

    const imageMatch = lines.length === 1 ? imageBlockPattern.exec(firstLine) : null
    if (imageMatch) {
      const altText = imageMatch[1]
      const src = imageMatch[2]
      return (
        <figure key={index} className="overflow-hidden rounded-xl border border-[#dbe5f1] bg-white">
          <img src={src} alt={altText || 'Blog image'} className="h-auto w-full object-cover" />
          {altText ? <figcaption className="px-4 py-3 text-xs text-[#5a6f8a]">{altText}</figcaption> : null}
        </figure>
      )
    }

    if (firstLine.startsWith('### ')) {
      return (
        <h3 key={index} className="text-xl font-semibold text-[#142842]">
          {renderInlineContent(firstLine.replace(/^###\s+/, ''))}
        </h3>
      )
    }

    if (firstLine.startsWith('## ')) {
      return (
        <h2 key={index} className="text-2xl font-semibold text-[#142842]">
          {renderInlineContent(firstLine.replace(/^##\s+/, ''))}
        </h2>
      )
    }

    if (lines.every((line) => line.startsWith('> '))) {
      return (
        <blockquote
          key={index}
          className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] px-5 py-4 text-sm text-[#1e3757] md:text-base"
        >
          {renderInlineContent(lines.map((line) => line.replace(/^>\s+/, '')).join(' '))}
        </blockquote>
      )
    }

    if (lines.every((line) => line.startsWith('- '))) {
      return (
        <ul key={index} className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#1e3757] md:text-base">
          {lines.map((line) => (
            <li key={line}>{renderInlineContent(line.replace(/^- /, ''))}</li>
          ))}
        </ul>
      )
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return (
        <ol key={index} className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#1e3757] md:text-base">
          {lines.map((line) => (
            <li key={line}>{renderInlineContent(line.replace(/^\d+\.\s+/, ''))}</li>
          ))}
        </ol>
      )
    }

    return (
      <p key={index} className="text-sm leading-relaxed text-[#4f6483] md:text-base">
        {renderInlineContent(lines.join(' '))}
      </p>
    )
  })
}

export default function BlogContent({ content }: BlogContentProps) {
  if (!content.trim()) {
    return null
  }

  return <div className="space-y-5">{renderBlocks(content)}</div>
}
