'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { getAdminAnalyticsSnapshot, type AdminAnalyticsSnapshot } from '@/lib/admin-analytics'

ChartJS.register(CategoryScale, LinearScale, ArcElement, BarElement, Tooltip, Legend)

type TimeRange = '7d' | '14d' | 'all'

const CHART_COLORS = ['#0f2744', '#144d6a', '#1f6f6d', '#3f86a8', '#82b8d7', '#94d2bd']

function formatCount(value: number): string {
  return value.toLocaleString()
}

function formatPercent(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`
}

function formatLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatChartDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function sumRecordValues(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0)
}

function pickTopEntry(record: Record<string, number>): [string, number] | null {
  const entries = Object.entries(record)
  if (entries.length === 0) {
    return null
  }

  return entries.sort((left, right) => right[1] - left[1])[0] ?? null
}

function buildRangeData(snapshot: AdminAnalyticsSnapshot | null, timeRange: TimeRange) {
  const allAttempts = snapshot?.dailyAttempts ?? []
  const length = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : allAttempts.length
  return length > 0 ? allAttempts.slice(-length) : []
}

export default function AnalyticsDashboard() {
  const [snapshot, setSnapshot] = useState<AdminAnalyticsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('14d')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      const nextSnapshot = await getAdminAnalyticsSnapshot()
      setSnapshot(nextSnapshot)
      setLastUpdated(new Date())
    } catch (fetchError) {
      console.error('Failed to load analytics dashboard:', fetchError)
      setError('Unable to load analytics right now. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const nextSnapshot = await getAdminAnalyticsSnapshot()
        if (!active) {
          return
        }

        setSnapshot(nextSnapshot)
        setLastUpdated(new Date())
        setError(null)
      } catch (fetchError) {
        if (!active) {
          return
        }

        console.error('Failed to load analytics dashboard:', fetchError)
        setError('Unable to load analytics right now. Please try again.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const filteredDailyAttempts = useMemo(() => buildRangeData(snapshot, timeRange), [snapshot, timeRange])

  const totalLandingVisits = useMemo(
    () => sumRecordValues(snapshot?.landingSourceDistribution ?? {}),
    [snapshot]
  )

  const dominantAttemptSource = useMemo(
    () => pickTopEntry(snapshot?.sourceDistribution ?? {}),
    [snapshot]
  )

  const strongestCategory = useMemo(
    () => pickTopEntry(snapshot?.categoryDistribution ?? {}),
    [snapshot]
  )

  const attemptVolumeInRange = useMemo(
    () => filteredDailyAttempts.reduce((total, entry) => total + entry.attempts, 0),
    [filteredDailyAttempts]
  )

  const avgAttemptsPerDay = useMemo(() => {
    if (filteredDailyAttempts.length === 0) {
      return 0
    }

    return attemptVolumeInRange / filteredDailyAttempts.length
  }, [attemptVolumeInRange, filteredDailyAttempts])

  const conversionRate =
    snapshot && totalLandingVisits > 0 ? (snapshot.totalQuizAttempts / totalLandingVisits) * 100 : 0

  const categoryDistributionEntries = useMemo(
    () =>
      Object.entries(snapshot?.categoryDistribution ?? {})
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6),
    [snapshot]
  )

  const sourceDistributionEntries = useMemo(
    () => Object.entries(snapshot?.sourceDistribution ?? {}).sort((left, right) => right[1] - left[1]),
    [snapshot]
  )

  const scoreBandEntries = useMemo(
    () => Object.entries(snapshot?.scoreBandDistribution ?? {}),
    [snapshot]
  )

  const landingSourceEntries = useMemo(
    () => Object.entries(snapshot?.landingSourceDistribution ?? {}).sort((left, right) => right[1] - left[1]),
    [snapshot]
  )

  if (loading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[#5a6f8a]">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-excel-green" />
          Loading analytics dashboard...
        </div>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <p className="text-sm text-[#5a6f8a]">{error ?? 'No analytics data available yet.'}</p>
          <button onClick={() => void fetchAnalytics()} className="btn-secondary">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] shadow-xl">
        <div className="relative px-6 py-6 md:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#5dd6cf]/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-56 w-56 rounded-full bg-[#8fb8ff]/20 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8e8ff]">Quiz Analytics</p>
              <h2 className="mt-1 text-3xl font-bold text-white">Performance Dashboard</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#d6ebff]">
                Review attempts, learning gaps, traffic sources, and engagement signals across the quiz app.
              </p>
              <p className="mt-3 text-xs text-[#c8e8ff]">
                {lastUpdated ? `Last updated ${lastUpdated.toLocaleString()}` : 'Waiting for first refresh'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['7d', '14d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    timeRange === range
                      ? 'bg-white text-[#0f2744]'
                      : 'border border-white/25 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}

              <button
                type="button"
                onClick={() => void fetchAnalytics(true)}
                className="btn-hero-secondary"
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Quiz Attempts"
          value={formatCount(snapshot.totalQuizAttempts)}
          helper={`${formatCount(attemptVolumeInRange)} attempts in the selected range`}
        />
        <MetricCard
          label="Average Score"
          value={formatPercent(snapshot.averageScore)}
          helper={
            snapshot.weakCategoryCounts[0]
              ? `Top gap: ${formatLabel(snapshot.weakCategoryCounts[0].category)}`
              : 'No weak-category trend yet'
          }
        />
        <MetricCard
          label="Users"
          value={formatCount(snapshot.totalUsers)}
          helper={
            dominantAttemptSource
              ? `Most attempts via ${formatLabel(dominantAttemptSource[0])}`
              : 'No attempt source data yet'
          }
        />
        <MetricCard
          label="Landing Conversion"
          value={totalLandingVisits > 0 ? formatPercent(conversionRate) : 'N/A'}
          helper={totalLandingVisits > 0 ? `${formatCount(totalLandingVisits)} tracked landing visits` : 'No landing traffic tracked yet'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-[#142842]">Attempt Trend</h3>
              <p className="mt-1 text-sm text-[#5a6f8a]">Recorded completions across the selected period.</p>
            </div>
            <div className="rounded-lg border border-[#dbe5f1] bg-[#f8fbff] px-3 py-2 text-sm text-[#1e3757]">
              Avg {avgAttemptsPerDay.toFixed(avgAttemptsPerDay >= 10 ? 0 : 1)} attempts/day
            </div>
          </div>

          {filteredDailyAttempts.length > 0 ? (
            <div className="mt-5 h-80">
              <Bar
                data={{
                  labels: filteredDailyAttempts.map((entry) => formatChartDate(entry.date)),
                  datasets: [
                    {
                      label: 'Attempts',
                      data: filteredDailyAttempts.map((entry) => entry.attempts),
                      backgroundColor: '#144d6a',
                      borderRadius: 10,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 },
                    },
                    x: {
                      grid: { display: false },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <EmptyAnalyticsState message="No daily attempt trend available yet." />
          )}
        </div>

        <div className="card">
          <h3 className="text-2xl font-semibold text-[#142842]">Attempt Sources</h3>
          <p className="mt-1 text-sm text-[#5a6f8a]">Where completed quizzes are coming from.</p>

          {sourceDistributionEntries.length > 0 ? (
            <div className="mt-5 h-80">
              <Doughnut
                data={{
                  labels: sourceDistributionEntries.map(([label]) => formatLabel(label)),
                  datasets: [
                    {
                      data: sourceDistributionEntries.map(([, value]) => value),
                      backgroundColor: ['#0f2744', '#1f6f6d', '#82b8d7'],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          ) : (
            <EmptyAnalyticsState message="No completed attempt source data yet." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-[#142842]">Category Performance</h3>
              <p className="mt-1 text-sm text-[#5a6f8a]">Top knowledge areas by accumulated correct answers.</p>
            </div>
            <div className="rounded-lg border border-[#dbe5f1] bg-[#f8fbff] px-3 py-2 text-sm text-[#1e3757]">
              {strongestCategory ? `Leader: ${formatLabel(strongestCategory[0])}` : 'No category data yet'}
            </div>
          </div>

          {categoryDistributionEntries.length > 0 ? (
            <div className="mt-5 h-80">
              <Bar
                data={{
                  labels: categoryDistributionEntries.map(([label]) => formatLabel(label)),
                  datasets: [
                    {
                      label: 'Correct answers',
                      data: categoryDistributionEntries.map(([, value]) => value),
                      backgroundColor: CHART_COLORS.map((color) => color),
                      borderRadius: 10,
                    },
                  ],
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: { precision: 0 },
                    },
                    y: {
                      grid: { display: false },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <EmptyAnalyticsState message="No quiz attempt category data yet." />
          )}
        </div>

        <div className="card">
          <h3 className="text-2xl font-semibold text-[#142842]">Score Bands</h3>
          <p className="mt-1 text-sm text-[#5a6f8a]">How participant scores are distributed.</p>

          {scoreBandEntries.length > 0 ? (
            <div className="mt-4 space-y-3">
              {scoreBandEntries.map(([band, value]) => (
                <StatRow
                  key={band}
                  label={band}
                  value={formatCount(value)}
                  ratio={snapshot.totalQuizAttempts > 0 ? value / snapshot.totalQuizAttempts : 0}
                />
              ))}
            </div>
          ) : (
            <EmptyAnalyticsState message="No score-band distribution yet." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card">
          <h3 className="text-2xl font-semibold text-[#142842]">Weak Categories</h3>
          <p className="mt-1 text-sm text-[#5a6f8a]">The most-missed areas across recorded attempts.</p>

          {snapshot.weakCategoryCounts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {snapshot.weakCategoryCounts.map((entry, index) => (
                <StatRow
                  key={entry.category}
                  label={formatLabel(entry.category)}
                  value={`${entry.misses} misses`}
                  ratio={snapshot.weakCategoryCounts[0].misses > 0 ? entry.misses / snapshot.weakCategoryCounts[0].misses : 0}
                  color={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </div>
          ) : (
            <EmptyAnalyticsState message="No weak-category trend yet." />
          )}
        </div>

        <div className="card">
          <h3 className="text-2xl font-semibold text-[#142842]">Landing Sources</h3>
          <p className="mt-1 text-sm text-[#5a6f8a]">Traffic sources captured before quiz completion.</p>

          {landingSourceEntries.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {landingSourceEntries.map(([source, value]) => (
                <span
                  key={source}
                  className="inline-flex items-center rounded-full border border-[#cfdceb] bg-[#f8fbff] px-4 py-2 text-sm font-medium text-[#1e3757]"
                >
                  {formatLabel(source)}: {formatCount(value)}
                </span>
              ))}
            </div>
          ) : (
            <EmptyAnalyticsState message="No landing analytics events recorded yet." />
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-2xl font-semibold text-[#142842]">Recent Activity</h3>
        <p className="mt-1 text-sm text-[#5a6f8a]">Latest activity across attempts, leads, training requests, and reviews.</p>

        {snapshot.recentActivity.length > 0 ? (
          <div className="mt-5 space-y-3">
            {snapshot.recentActivity.map((activity, index) => (
              <div
                key={`${activity.action}-${activity.user}-${index}`}
                className="flex flex-col gap-2 rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-[#1d3d61]">{activity.action}</p>
                  <p className="text-sm text-[#5a6f8a]">{activity.user}</p>
                </div>
                <p className="text-sm text-[#5a6f8a]">{activity.timestamp.toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyAnalyticsState message="No recent admin activity to display yet." />
        )}
      </div>
    </section>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="rounded-xl border border-[#d9e3ef] bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-[#5f7491]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[#142842]">{value}</p>
      <p className="mt-2 text-sm text-[#5a6f8a]">{helper}</p>
    </article>
  )
}

function StatRow({
  label,
  value,
  ratio,
  color = '#144d6a',
}: {
  label: string
  value: string
  ratio: number
  color?: string
}) {
  return (
    <div className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#1e3757]">{label}</p>
        <p className="text-sm font-semibold text-[#142842]">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function EmptyAnalyticsState({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-[#dbe5f1] bg-[#f8fbff] px-6 text-center text-sm text-[#5a6f8a]">
      {message}
    </div>
  )
}
