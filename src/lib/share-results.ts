export type ShareResultsSnapshot = {
  percentage: number
  performanceLabel: string
  correctAnswers: number
  totalQuestions: number
  profileLabel: string
  completedLabel: string
  nonce?: string
}

type EncodedShareResultsSnapshot = {
  p: number
  pl: string
  c: number
  t: number
  pr: string
  d: string
  n?: string
}

function toBase64Url(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return atob(`${normalized}${padding}`)
}

export function encodeShareResultsToken(snapshot: ShareResultsSnapshot) {
  const payload: EncodedShareResultsSnapshot = {
    p: Math.max(0, Math.min(100, Math.round(snapshot.percentage))),
    pl: snapshot.performanceLabel.trim(),
    c: Math.max(0, Math.round(snapshot.correctAnswers)),
    t: Math.max(1, Math.round(snapshot.totalQuestions)),
    pr: snapshot.profileLabel.trim(),
    d: snapshot.completedLabel.trim(),
    n: typeof snapshot.nonce === 'string' && snapshot.nonce.trim() ? snapshot.nonce.trim().slice(0, 80) : undefined,
  }

  return toBase64Url(JSON.stringify(payload))
}

export function decodeShareResultsToken(token: string): ShareResultsSnapshot | null {
  try {
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
      nonce: typeof parsed.n === 'string' ? parsed.n : undefined,
    }
  } catch {
    return null
  }
}

export function buildShareResultsPath(snapshot: ShareResultsSnapshot) {
  return `/share/results/${encodeShareResultsToken(snapshot)}`
}
