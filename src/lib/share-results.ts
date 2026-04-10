export type ShareResultsSnapshot = {
  percentage: number
  performanceLabel: string
  correctAnswers: number
  totalQuestions: number
  profileLabel: string
  completedLabel: string
  completedAt?: string
  nonce?: string
}

type EncodedShareResultsSnapshot = {
  p: number
  pl: string
  c: number
  t: number
  pr: string
  d: string
  dt?: string
  n?: string
}

const performanceCodes = {
  Excellent: 'e',
  Good: 'g',
  'Needs Improvement': 'n',
} as const

const performanceLabelsByCode: Record<string, string> = Object.fromEntries(
  Object.entries(performanceCodes).map(([label, code]) => [code, label])
)

const profileCodes = {
  'Novice (Level 1)': 'n',
  'Intermediate (Level 2)': 'i',
  'Advanced (Level 3)': 'a',
  'Legend (Level 4)': 'l',
  'Mixed Difficulty': 'm',
  'Administered Batch': 'b',
} as const

const profileLabelsByCode: Record<string, string> = Object.fromEntries(
  Object.entries(profileCodes).map(([label, code]) => [code, label])
)

function toBase64Url(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return atob(`${normalized}${padding}`)
}

function formatCompletedLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function encodeMappedText(value: string, codes: Record<string, string>) {
  const normalized = value.trim()
  return codes[normalized as keyof typeof codes] ?? `~${toBase64Url(normalized)}`
}

function decodeMappedText(value: string, labelsByCode: Record<string, string>) {
  if (value.startsWith('~')) {
    return fromBase64Url(value.slice(1))
  }

  return labelsByCode[value] ?? value
}

function encodeCompletedDate(snapshot: ShareResultsSnapshot) {
  const rawValue = snapshot.completedAt ?? snapshot.completedLabel
  const parsedTime = Date.parse(rawValue)
  if (Number.isFinite(parsedTime)) {
    return Math.round(parsedTime).toString(36)
  }

  return `~${toBase64Url(snapshot.completedLabel.trim())}`
}

function decodeCompletedDate(value: string) {
  if (!value) {
    return { completedLabel: 'Recently', completedAt: undefined }
  }

  if (value.startsWith('~')) {
    return {
      completedLabel: fromBase64Url(value.slice(1)),
      completedAt: undefined,
    }
  }

  const parsedTime = Number.parseInt(value, 36)
  if (Number.isFinite(parsedTime)) {
    const date = new Date(parsedTime)
    return {
      completedLabel: formatCompletedLabel(date),
      completedAt: date.toISOString(),
    }
  }

  return { completedLabel: 'Recently', completedAt: undefined }
}

export function encodeShareResultsToken(snapshot: ShareResultsSnapshot) {
  const compactNonce =
    typeof snapshot.nonce === 'string' && snapshot.nonce.trim()
      ? snapshot.nonce.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8)
      : ''

  const compactToken = [
    '2',
    Math.max(0, Math.min(100, Math.round(snapshot.percentage))).toString(36),
    encodeMappedText(snapshot.performanceLabel, performanceCodes),
    Math.max(0, Math.round(snapshot.correctAnswers)).toString(36),
    Math.max(1, Math.round(snapshot.totalQuestions)).toString(36),
    encodeMappedText(snapshot.profileLabel, profileCodes),
    encodeCompletedDate(snapshot),
    compactNonce,
  ]
    .filter(Boolean)
    .join('.')

  if (compactToken.length > 0) {
    return compactToken
  }

  const payload: EncodedShareResultsSnapshot = {
    p: Math.max(0, Math.min(100, Math.round(snapshot.percentage))),
    pl: snapshot.performanceLabel.trim(),
    c: Math.max(0, Math.round(snapshot.correctAnswers)),
    t: Math.max(1, Math.round(snapshot.totalQuestions)),
    pr: snapshot.profileLabel.trim(),
    d: snapshot.completedLabel.trim(),
    dt: typeof snapshot.completedAt === 'string' && snapshot.completedAt.trim() ? snapshot.completedAt.trim() : undefined,
    n: typeof snapshot.nonce === 'string' && snapshot.nonce.trim() ? snapshot.nonce.trim().slice(0, 80) : undefined,
  }

  return toBase64Url(JSON.stringify(payload))
}

export function decodeShareResultsToken(token: string): ShareResultsSnapshot | null {
  try {
    if (token.startsWith('2.')) {
      const [version, encodedPercentage, encodedPerformance, encodedCorrect, encodedTotal, encodedProfile, encodedDate, encodedNonce] =
        token.split('.')

      if (
        version !== '2' ||
        !encodedPercentage ||
        !encodedPerformance ||
        !encodedCorrect ||
        !encodedTotal ||
        !encodedProfile ||
        !encodedDate
      ) {
        return null
      }

      const percentage = Number.parseInt(encodedPercentage, 36)
      const correctAnswers = Number.parseInt(encodedCorrect, 36)
      const totalQuestions = Number.parseInt(encodedTotal, 36)

      if (!Number.isFinite(percentage) || !Number.isFinite(correctAnswers) || !Number.isFinite(totalQuestions)) {
        return null
      }

      const decodedDate = decodeCompletedDate(encodedDate)

      return {
        percentage,
        performanceLabel: decodeMappedText(encodedPerformance, performanceLabelsByCode),
        correctAnswers,
        totalQuestions,
        profileLabel: decodeMappedText(encodedProfile, profileLabelsByCode),
        completedLabel: decodedDate.completedLabel,
        completedAt: decodedDate.completedAt,
        nonce: typeof encodedNonce === 'string' && encodedNonce ? encodedNonce : undefined,
      }
    }

    const parsed = JSON.parse(fromBase64Url(token)) as Partial<EncodedShareResultsSnapshot>

    if (
      typeof parsed.p !== 'number' ||
      typeof parsed.pl !== 'string' ||
      typeof parsed.c !== 'number' ||
      typeof parsed.t !== 'number' ||
      typeof parsed.pr !== 'string' ||
      typeof parsed.d !== 'string'
    ) {
      return null
    }

    return {
      percentage: parsed.p,
      performanceLabel: parsed.pl,
      correctAnswers: parsed.c,
      totalQuestions: parsed.t,
      profileLabel: parsed.pr,
      completedLabel: parsed.d,
      completedAt: typeof parsed.dt === 'string' ? parsed.dt : undefined,
      nonce: typeof parsed.n === 'string' ? parsed.n : undefined,
    }
  } catch {
    return null
  }
}

export function buildShareResultsPath(snapshot: ShareResultsSnapshot) {
  return `/share/results/${encodeShareResultsToken(snapshot)}`
}

export function buildShareResultsImagePath(token: string) {
  return `/share/results/${token}/opengraph-image?v=5`
}

export function buildShareResultsTitle(snapshot: ShareResultsSnapshot) {
  return `I scored ${snapshot.percentage}%. Dare to take Excel Mastery Quiz?`
}

export function buildShareResultsDescription(snapshot: ShareResultsSnapshot) {
  return `${snapshot.performanceLabel} performance, ${snapshot.correctAnswers}/${snapshot.totalQuestions} correct, ${snapshot.profileLabel}, completed ${snapshot.completedLabel}.`
}
