import type { Metadata } from 'next'

export const siteConfig = {
  name: 'Excel Mastery Quiz Ghana',
  shortName: 'Excel Mastery Quiz',
  description:
    'Free Excel quiz platform for students, job seekers, and corporate teams in Ghana. Test spreadsheet skills, review gaps, and grow with targeted practice.',
  locale: 'en_GH',
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
}

export const primarySeoKeywords = [
  'excel quiz online',
  'free excel test',
  'excel practice questions',
  'excel skills quiz',
  'excel assessment test',
  'microsoft excel quiz',
  'excel training ghana',
  'excel course for beginners',
  'advanced excel quiz',
  'excel certification practice',
]

export const longTailSeoKeywords = [
  'free excel quiz for students in ghana',
  'excel test questions for job interviews',
  'how to improve excel skills with quizzes',
  'excel quiz for corporate training',
  'beginner excel practice test online',
  'intermediate excel skills assessment',
  'excel formulas quiz with answers',
  'excel quiz game for learning',
  'microsoft excel certification ghana practice',
  'advanced excel functions quiz online',
]

export const blogTopicSuggestions = [
  'Top 10 Excel Functions Every Student Should Know',
  'Excel Skills Employers Look For in Ghana',
  'How Gamified Learning Boosts Excel Mastery',
  'Common Excel Test Questions in Job Assessments',
  'Excel Certification and Training Resources in Ghana',
  'Excel Shortcuts and Tricks to Save Time',
]

export function absoluteUrl(path = '/') {
  const base = siteConfig.siteUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

type SeoMetadataInput = {
  title: string
  description: string
  path?: string
  keywords?: string[]
  image?: string
  noIndex?: boolean
}

export function buildMetadata({
  title,
  description,
  path = '/',
  keywords = [],
  image,
  noIndex = false,
}: SeoMetadataInput): Metadata {
  const canonical = absoluteUrl(path)
  const resolvedImage = image ? absoluteUrl(image) : undefined

  return {
    title,
    description,
    keywords: [...primarySeoKeywords, ...keywords],
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: 'website',
      ...(resolvedImage
        ? {
            images: [
              {
                url: resolvedImage,
                alt: title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: resolvedImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(resolvedImage ? { images: [resolvedImage] } : {}),
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
  }
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: siteConfig.name,
    url: siteConfig.siteUrl,
    description: siteConfig.description,
    areaServed: 'Ghana',
    keywords: [...primarySeoKeywords, ...longTailSeoKeywords].join(', '),
  }
}

export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.siteUrl,
    inLanguage: siteConfig.locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/blog')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}
