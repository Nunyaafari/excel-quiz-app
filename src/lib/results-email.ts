import 'server-only'

export type ResultsEmailCategoryScore = {
  category: string
  correct: number
  total: number
  accuracy: number
}

export type ResultsEmailRecommendation = {
  category: string
  accuracy: number
  materials: Array<{
    title: string
    type: string
    url: string
    description: string
  }>
}

export type ResultsEmailQuestionReview = {
  order: number
  text: string
  category: string
  selectedAnswer: string
  correctAnswer: string
  result: string
}

export type ResultsEmailPayload = {
  email: string
  displayName: string
  percentage: number
  totalScore: number
  maxScore: number
  correctAnswers: number
  totalQuestions: number
  performanceLabel: string
  profileLabel: string
  completedLabel: string
  categoryScores: ResultsEmailCategoryScore[]
  recommendations: ResultsEmailRecommendation[]
  questionReview: ResultsEmailQuestionReview[]
  shareCaption: string
  shareUrl: string
  reportText: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function normalizeResultsEmailPayload(body: Partial<ResultsEmailPayload> | null): ResultsEmailPayload | null {
  if (!body) {
    return null
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!isValidEmail(email)) {
    return null
  }

  return {
    email,
    displayName:
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : 'Excel Quiz Participant',
    percentage: typeof body.percentage === 'number' ? body.percentage : 0,
    totalScore: typeof body.totalScore === 'number' ? body.totalScore : 0,
    maxScore: typeof body.maxScore === 'number' ? body.maxScore : 0,
    correctAnswers: typeof body.correctAnswers === 'number' ? body.correctAnswers : 0,
    totalQuestions: typeof body.totalQuestions === 'number' ? body.totalQuestions : 0,
    performanceLabel:
      typeof body.performanceLabel === 'string' ? body.performanceLabel : 'Performance Summary',
    profileLabel: typeof body.profileLabel === 'string' ? body.profileLabel : 'Mixed Difficulty',
    completedLabel: typeof body.completedLabel === 'string' ? body.completedLabel : 'Recently',
    categoryScores: Array.isArray(body.categoryScores) ? body.categoryScores : [],
    recommendations: Array.isArray(body.recommendations) ? body.recommendations : [],
    questionReview: Array.isArray(body.questionReview) ? body.questionReview : [],
    shareCaption: typeof body.shareCaption === 'string' ? body.shareCaption : '',
    shareUrl: typeof body.shareUrl === 'string' ? body.shareUrl : process.env.NEXT_PUBLIC_APP_URL || '',
    reportText: typeof body.reportText === 'string' ? body.reportText : '',
  }
}

export function buildResultsEmailHtml(payload: ResultsEmailPayload): string {
  const categoryRows =
    payload.categoryScores.length > 0
      ? payload.categoryScores
          .map(
            (score) => `
              <tr>
                <td style="padding:12px 10px;border-bottom:1px solid #e2e8f2;color:#183251;">${escapeHtml(score.category)}</td>
                <td style="padding:12px 10px;border-bottom:1px solid #e2e8f2;color:#183251;text-align:right;">${score.correct}/${score.total}</td>
                <td style="padding:12px 10px;border-bottom:1px solid #e2e8f2;color:#183251;text-align:right;">${score.accuracy}%</td>
              </tr>
            `
          )
          .join('')
      : `
          <tr>
            <td colspan="3" style="padding:12px 10px;color:#5a6f8a;">No category breakdown available for this attempt.</td>
          </tr>
        `

  const recommendationBlocks =
    payload.recommendations.length > 0
      ? payload.recommendations
          .map((recommendation) => {
            const materials =
              recommendation.materials.length > 0
                ? recommendation.materials
                    .map(
                      (material) => `
                        <li style="margin-bottom:10px;">
                          <a href="${escapeHtml(material.url)}" style="color:#144d6a;font-weight:700;text-decoration:none;">
                            ${escapeHtml(material.title)}
                          </a>
                          <span style="color:#5a6f8a;"> (${escapeHtml(material.type)})</span>
                          ${material.description ? `<div style="color:#5a6f8a;margin-top:4px;">${escapeHtml(material.description)}</div>` : ''}
                        </li>
                      `
                    )
                    .join('')
                : '<li style="color:#5a6f8a;">No mapped resources yet.</li>'

            return `
              <div style="margin-top:16px;padding:18px;border:1px solid #dbe5f1;border-radius:18px;background:#f8fbff;">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
                  <strong style="color:#142842;font-size:16px;">${escapeHtml(recommendation.category)}</strong>
                  <span style="color:#5a6f8a;">${recommendation.accuracy}% accuracy</span>
                </div>
                <ul style="margin:12px 0 0 18px;padding:0;">
                  ${materials}
                </ul>
              </div>
            `
          })
          .join('')
      : '<p style="color:#166534;background:#ecfdf5;border:1px solid #bbf7d0;padding:14px 16px;border-radius:14px;">Great result. No weak-category recommendations right now.</p>'

  const questionBlocks =
    payload.questionReview.length > 0
      ? payload.questionReview
          .map(
            (question) => `
              <div style="margin-top:16px;padding:18px;border:1px solid #dbe5f1;border-radius:18px;background:#f8fbff;">
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                  <div style="color:#142842;font-weight:700;">Question ${question.order}</div>
                  <div style="color:#5a6f8a;">${escapeHtml(question.category)}</div>
                </div>
                <div style="margin-top:8px;color:#183251;line-height:1.5;">${escapeHtml(question.text)}</div>
                <div style="margin-top:12px;color:#183251;"><strong>Your answer:</strong> ${escapeHtml(question.selectedAnswer)}</div>
                <div style="margin-top:6px;color:#183251;"><strong>Correct answer:</strong> ${escapeHtml(question.correctAnswer)}</div>
                <div style="margin-top:8px;color:${question.result === 'Correct' ? '#166534' : '#b45309'};"><strong>Result:</strong> ${escapeHtml(question.result)}</div>
              </div>
            `
          )
          .join('')
      : '<p style="color:#5a6f8a;">Question-level review was not available for this attempt.</p>'

  return `
    <div style="margin:0;padding:36px 16px;background:#eaf0f6;font-family:Arial,sans-serif;">
      <div style="max-width:780px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0f2744 0%,#144d6a 55%,#1f6f6d 100%);border-radius:28px;overflow:hidden;box-shadow:0 18px 45px rgba(15,39,68,0.18);">
          <div style="padding:32px 32px 22px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c8e8ff;">Excel Assessment Report</div>
            <h1 style="margin:14px 0 0;font-size:36px;line-height:1.15;color:white;">Your Detailed Quiz Results</h1>
            <p style="margin:12px 0 0;max-width:560px;color:#d6ebff;line-height:1.6;">
              A polished copy of your latest Excel quiz report, including strengths, weaker areas, and follow-up recommendations.
            </p>

            <div style="margin-top:24px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(260px,0.9fr);gap:16px;">
              <div style="padding:22px;border-radius:22px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.24);">
                <div style="font-size:13px;color:#d6ebff;">Overall performance</div>
                <div style="margin-top:10px;font-size:56px;font-weight:700;color:white;">${payload.percentage}%</div>
                <div style="margin-top:10px;display:inline-flex;padding:10px 14px;border-radius:999px;background:white;color:#183251;font-weight:700;">
                  ${escapeHtml(payload.performanceLabel)}
                </div>
                <div style="margin-top:14px;color:#d6ebff;line-height:1.6;">
                  ${payload.correctAnswers}/${payload.totalQuestions} correct<br />
                  ${escapeHtml(payload.profileLabel)}<br />
                  Completed ${escapeHtml(payload.completedLabel)}
                </div>
              </div>

              <div style="padding:22px;border-radius:22px;background:white;color:#183251;">
                <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#5f7491;">Shareable Highlight</div>
                <div style="margin-top:12px;font-size:24px;font-weight:700;">Excel Skills Badge Ready</div>
                <p style="margin:10px 0 0;color:#5a6f8a;line-height:1.6;">Use your summary score and share caption to post your result on LinkedIn or internal team channels.</p>
              </div>
            </div>
          </div>

          <div style="background:white;padding:30px 32px 34px;">
            <p style="margin:0 0 18px;color:#5a6f8a;line-height:1.6;">Hi ${escapeHtml(
              payload.displayName
            )}, here is a copy of your quiz report.</p>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">
              <div style="padding:16px;border:1px solid #dbe5f1;border-radius:16px;background:#f8fbff;">
                <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5f7491;">Score</div>
                <div style="margin-top:8px;font-size:28px;font-weight:700;color:#142842;">${payload.totalScore}/${payload.maxScore}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe5f1;border-radius:16px;background:#f8fbff;">
                <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5f7491;">Correct Answers</div>
                <div style="margin-top:8px;font-size:28px;font-weight:700;color:#142842;">${payload.correctAnswers}/${payload.totalQuestions}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe5f1;border-radius:16px;background:#f8fbff;">
                <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5f7491;">Track</div>
                <div style="margin-top:8px;font-size:18px;font-weight:700;color:#142842;">${escapeHtml(payload.profileLabel)}</div>
              </div>
            </div>

            <h2 style="margin:30px 0 12px;color:#142842;">Category Breakdown</h2>
            <table style="width:100%;border-collapse:collapse;border:1px solid #dbe5f1;border-radius:16px;overflow:hidden;">
              <thead style="background:#f8fbff;">
                <tr>
                  <th style="padding:12px 10px;text-align:left;color:#5f7491;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Category</th>
                  <th style="padding:12px 10px;text-align:right;color:#5f7491;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Correct</th>
                  <th style="padding:12px 10px;text-align:right;color:#5f7491;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Accuracy</th>
                </tr>
              </thead>
              <tbody>${categoryRows}</tbody>
            </table>

            <h2 style="margin:30px 0 12px;color:#142842;">Recommended Training</h2>
            ${recommendationBlocks}

            <h2 style="margin:30px 0 12px;color:#142842;">Question Review</h2>
            ${questionBlocks}

            <div style="margin-top:30px;padding:18px;border:1px solid #dbe5f1;border-radius:18px;background:#f8fbff;">
              <div style="font-weight:700;color:#142842;">Suggested share caption</div>
              <p style="margin:12px 0 0;color:#5a6f8a;line-height:1.6;">${escapeHtml(payload.shareCaption)}</p>
              <a
                href="${escapeHtml(payload.shareUrl)}"
                style="display:inline-block;margin-top:16px;padding:12px 18px;border-radius:10px;background:#0f2744;color:white;text-decoration:none;font-weight:700;"
              >
                Retake or share the quiz
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

export async function sendResultsEmail(
  payload: ResultsEmailPayload,
  metadata?: { leadId?: string; userId?: string; attemptId?: string; idempotencyKey?: string }
) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.QUIZ_RESULTS_FROM_EMAIL
  const replyTo = process.env.QUIZ_RESULTS_REPLY_TO

  if (!apiKey || !from) {
    throw new Error('results-email-not-configured')
  }

  const emailPayload = {
    from,
    to: [payload.email],
    subject: `Your Excel quiz results: ${payload.percentage}%`,
    html: buildResultsEmailHtml(payload),
    text: payload.reportText,
    tags: [
      { name: 'flow', value: 'quiz_results' },
      ...(metadata?.leadId ? [{ name: 'lead_id', value: metadata.leadId }] : []),
      ...(metadata?.userId ? [{ name: 'user_id', value: metadata.userId }] : []),
      ...(metadata?.attemptId ? [{ name: 'attempt_id', value: metadata.attemptId }] : []),
    ],
    headers: {
      'X-Quiz-Lead-Id': metadata?.leadId || '',
      'X-Quiz-User-Id': metadata?.userId || '',
      'X-Quiz-Attempt-Id': metadata?.attemptId || '',
    },
    ...(replyTo ? { reply_to: replyTo } : {}),
  }

  const idempotencyKey =
    metadata?.idempotencyKey ||
    (metadata?.leadId ? `quiz-results-${metadata.leadId}` : `quiz-results-${payload.email}-${payload.completedLabel}`)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(emailPayload),
    })

    const resendData = (await resendResponse.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null

    if (resendResponse.ok) {
      return {
        id: resendData?.id ?? null,
      }
    }

    const shouldRetry = attempt === 0 && (resendResponse.status >= 500 || resendResponse.status === 429)
    console.error('Failed to send quiz results email:', resendData)
    if (!shouldRetry) {
      throw new Error('results-email-send-failed')
    }
  }

  throw new Error('results-email-send-failed')
}
