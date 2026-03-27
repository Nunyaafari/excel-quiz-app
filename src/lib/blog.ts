import 'server-only'

import type { BlogPost } from '@/types'
import { adminDb } from '@/lib/firebase-admin'

export function slugifyBlogValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

function parseBlogPost(raw: unknown, id: string): BlogPost | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const data = raw as Partial<BlogPost> & {
    createdAt?: unknown
    updatedAt?: unknown
    publishedAt?: unknown
  }

  if (typeof data.title !== 'string' || typeof data.slug !== 'string' || typeof data.content !== 'string') {
    return null
  }

  return {
    id,
    title: data.title,
    slug: data.slug,
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
    content: data.content,
    category: typeof data.category === 'string' ? data.category : 'Excel Tips',
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    authorName: typeof data.authorName === 'string' ? data.authorName : 'Excel Mastery Team',
    coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined,
    status: data.status === 'draft' ? 'draft' : 'published',
    featured: data.featured === true,
    focusKeyword: typeof data.focusKeyword === 'string' ? data.focusKeyword : undefined,
    seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : undefined,
    seoDescription: typeof data.seoDescription === 'string' ? data.seoDescription : undefined,
    seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords.map(String) : [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
  }
}

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  try {
    const snapshot = await adminDb.collection('blogPosts').orderBy('publishedAt', 'desc').limit(100).get()
    return snapshot.docs
      .map((docSnapshot) => parseBlogPost(docSnapshot.data(), docSnapshot.id))
      .filter((post): post is BlogPost => post !== null && post.status === 'published')
  } catch (error) {
    console.error('Failed to load published blog posts:', error)
    return []
  }
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const snapshot = await adminDb.collection('blogPosts').where('slug', '==', slug).limit(1).get()
    if (snapshot.empty) {
      return null
    }

    const post = parseBlogPost(snapshot.docs[0].data(), snapshot.docs[0].id)
    if (!post || post.status !== 'published') {
      return null
    }

    return post
  } catch (error) {
    console.error('Failed to load blog post by slug:', error)
    return null
  }
}

export function getBlogCategories(posts: BlogPost[]) {
  return Array.from(
    posts.reduce((map, post) => {
      const existing = map.get(post.category)
      map.set(post.category, {
        name: post.category,
        slug: slugifyBlogValue(post.category),
        count: (existing?.count ?? 0) + 1,
      })
      return map
    }, new Map<string, { name: string; slug: string; count: number }>())
  )
    .map(([, category]) => category)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

export function getBlogTags(posts: BlogPost[]) {
  return Array.from(
    posts.reduce((map, post) => {
      post.tags.forEach((tag) => {
        const existing = map.get(tag)
        map.set(tag, {
          name: tag,
          slug: slugifyBlogValue(tag),
          count: (existing?.count ?? 0) + 1,
        })
      })
      return map
    }, new Map<string, { name: string; slug: string; count: number }>())
  )
    .map(([, tag]) => tag)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

export function findBlogCategoryBySlug(posts: BlogPost[], slug: string) {
  return getBlogCategories(posts).find((category) => category.slug === slug) ?? null
}

export function findBlogTagBySlug(posts: BlogPost[], slug: string) {
  return getBlogTags(posts).find((tag) => tag.slug === slug) ?? null
}

type BlogPostFilterInput = {
  query?: string
  categorySlug?: string
  tagSlug?: string
}

export function filterBlogPosts(
  posts: BlogPost[],
  { query, categorySlug, tagSlug }: BlogPostFilterInput
) {
  const normalizedQuery = query?.trim().toLowerCase() ?? ''
  const normalizedCategory = categorySlug ? slugifyBlogValue(categorySlug) : ''
  const normalizedTag = tagSlug ? slugifyBlogValue(tagSlug) : ''

  return posts.filter((post) => {
    const matchesCategory = !normalizedCategory || slugifyBlogValue(post.category) === normalizedCategory
    const matchesTag = !normalizedTag || post.tags.some((tag) => slugifyBlogValue(tag) === normalizedTag)

    if (!matchesCategory || !matchesTag) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const searchableText = [
      post.title,
      post.excerpt,
      post.content,
      post.category,
      post.focusKeyword,
      post.authorName,
      ...post.tags,
      ...post.seoKeywords,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return searchableText.includes(normalizedQuery)
  })
}
