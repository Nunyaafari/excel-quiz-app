'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import BlogMediaLibrary from '@/components/admin/BlogMediaLibrary'
import BlogContent from '@/components/blog/BlogContent'
import { blogTopicSuggestions, longTailSeoKeywords, primarySeoKeywords } from '@/lib/seo'
import type { BlogPost } from '@/types'

type BlogFormState = {
  title: string
  slug: string
  excerpt: string
  content: string
  category: string
  tags: string
  authorName: string
  coverImageUrl: string
  status: 'draft' | 'published'
  featured: boolean
  focusKeyword: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
}

const defaultFormState: BlogFormState = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: 'Excel Tips',
  tags: '',
  authorName: 'Excel Mastery Team',
  coverImageUrl: '',
  status: 'draft',
  featured: false,
  focusKeyword: '',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function buildExcerpt(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 180 ? `${normalized.slice(0, 177).trimEnd()}...` : normalized
}

function toFriendlyBlogError(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'Permission denied. Ensure this account is listed in Firestore /admins with active=true (then redeploy rules).'
    }
    if (error.code === 'unauthenticated') {
      return 'You are signed out. Sign in with Google to save blog posts.'
    }
    return error.message || 'Could not complete blog action.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Could not complete blog action.'
}

function toDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  if (value instanceof Date) {
    return value
  }

  return new Date()
}

function parseBlogPostRecord(raw: unknown, id: string): BlogPost | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const data = raw as Partial<BlogPost> & { createdAt?: unknown; updatedAt?: unknown; publishedAt?: unknown }
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

type BlogManagerProps = {
  adminName: string
}

export default function BlogManager({ adminName }: BlogManagerProps) {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [contentMode, setContentMode] = useState<'write' | 'preview'>('write')
  const [formState, setFormState] = useState<BlogFormState>({
    ...defaultFormState,
    authorName: adminName || defaultFormState.authorName,
  })
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'success' | 'error' | null>(null)
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'blogPosts'), orderBy('updatedAt', 'desc')))
        const parsedPosts = snapshot.docs
          .map((docSnapshot) => parseBlogPostRecord(docSnapshot.data(), docSnapshot.id))
          .filter((post): post is BlogPost => post !== null)
        setPosts(parsedPosts)
      } catch (error) {
        console.error('Failed to load blog posts:', error)
        setMessageTone('error')
        setMessage(toFriendlyBlogError(error))
      } finally {
        setLoading(false)
      }
    }

    void loadPosts()
  }, [])

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  )

  const resetForm = () => {
    setSelectedPostId(null)
    setFormState({
      ...defaultFormState,
      authorName: adminName || defaultFormState.authorName,
    })
  }

  const applyPostToForm = (post: BlogPost) => {
    setSelectedPostId(post.id)
    setFormState({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      tags: post.tags.join(', '),
      authorName: post.authorName,
      coverImageUrl: post.coverImageUrl ?? '',
      status: post.status,
      featured: post.featured,
      focusKeyword: post.focusKeyword ?? '',
      seoTitle: post.seoTitle ?? '',
      seoDescription: post.seoDescription ?? '',
      seoKeywords: post.seoKeywords.join(', '),
    })
  }

  const upsertPostInState = (post: BlogPost) => {
    setPosts((current) => {
      const next = current.some((item) => item.id === post.id)
        ? current.map((item) => (item.id === post.id ? post : item))
        : [post, ...current]

      return next.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    })
  }

  const applyContentTransform = (
    transform: (value: string, selectionStart: number, selectionEnd: number) => {
      nextValue: string
      nextSelectionStart: number
      nextSelectionEnd: number
    }
  ) => {
    const textarea = contentTextareaRef.current
    const selectionStart = textarea?.selectionStart ?? formState.content.length
    const selectionEnd = textarea?.selectionEnd ?? formState.content.length
    const result = transform(formState.content, selectionStart, selectionEnd)

    setFormState((current) => ({ ...current, content: result.nextValue }))

    requestAnimationFrame(() => {
      const nextTextarea = contentTextareaRef.current
      if (!nextTextarea) {
        return
      }
      nextTextarea.focus()
      nextTextarea.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd)
    })
  }

  const wrapSelection = (prefix: string, suffix: string, placeholder: string) => {
    applyContentTransform((value, start, end) => {
      const hasSelection = end > start
      const selectedText = value.slice(start, end)
      const innerText = hasSelection ? selectedText : placeholder
      const nextValue = `${value.slice(0, start)}${prefix}${innerText}${suffix}${value.slice(end)}`
      const innerStart = start + prefix.length
      const innerEnd = innerStart + innerText.length
      return { nextValue, nextSelectionStart: innerStart, nextSelectionEnd: innerEnd }
    })
  }

  const prefixSelectedLines = (prefix: string) => {
    applyContentTransform((value, start, end) => {
      const beforeSelection = value.slice(0, start)
      const selection = value.slice(start, end)
      const afterSelection = value.slice(end)

      const prefixStart = beforeSelection.lastIndexOf('\n') + 1
      const prefixEndOffset = selection.lastIndexOf('\n')
      const selectionEnd =
        prefixEndOffset >= 0 ? end - (selection.length - prefixEndOffset) : end

      const lines = value.slice(prefixStart, selectionEnd).split('\n')
      const nextLines = lines.map((line) => (line.trim().length === 0 ? line : `${prefix}${line}`))
      const nextBlock = nextLines.join('\n')
      const nextValue = `${value.slice(0, prefixStart)}${nextBlock}${value.slice(selectionEnd)}`

      const nextSelectionStart = start + prefix.length
      const nextSelectionEnd = end + prefix.length * Math.max(1, lines.length)

      return { nextValue, nextSelectionStart, nextSelectionEnd }
    })
  }

  const insertSnippet = (snippet: string, selectFromEnd = 0) => {
    applyContentTransform((value, start, end) => {
      const nextValue = `${value.slice(0, start)}${snippet}${value.slice(end)}`
      const cursor = start + snippet.length - selectFromEnd
      return { nextValue, nextSelectionStart: cursor, nextSelectionEnd: cursor }
    })
  }

  const insertImageMarkdown = (url: string) => {
    applyContentTransform((value, start, end) => {
      const snippet = `\n\n![Image](${url})\n\n`
      const nextValue = `${value.slice(0, start)}${snippet}${value.slice(end)}`
      const altStart = start + 3
      const altEnd = altStart + 'Image'.length
      return { nextValue, nextSelectionStart: altStart, nextSelectionEnd: altEnd }
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setMessageTone(null)

    const title = formState.title.trim()
    const content = formState.content.trim()
    const slug = slugify(formState.slug || title)

    if (!title || !content || !slug) {
      setMessageTone('error')
      setMessage('Title, slug, and content are required.')
      return
    }

    setSaving(true)

    const now = new Date()
    const excerpt = formState.excerpt.trim() || buildExcerpt(content)
    const tags = formState.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    const seoKeywords = formState.seoKeywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean)

    const payload = {
      title,
      slug,
      excerpt,
      content,
      category: formState.category.trim() || 'Excel Tips',
      tags,
      authorName: formState.authorName.trim() || adminName || defaultFormState.authorName,
      coverImageUrl: formState.coverImageUrl.trim() || null,
      status: formState.status,
      featured: formState.featured,
      focusKeyword: formState.focusKeyword.trim() || null,
      seoTitle: formState.seoTitle.trim() || null,
      seoDescription: formState.seoDescription.trim() || null,
      seoKeywords,
      updatedAt: serverTimestamp(),
      publishedAt:
        formState.status === 'published'
          ? selectedPost?.publishedAt ?? serverTimestamp()
          : null,
    }

    try {
      if (selectedPost) {
        await updateDoc(doc(db, 'blogPosts', selectedPost.id), payload)

        upsertPostInState({
          ...selectedPost,
          ...payload,
          coverImageUrl: formState.coverImageUrl.trim() || undefined,
          focusKeyword: formState.focusKeyword.trim() || undefined,
          seoTitle: formState.seoTitle.trim() || undefined,
          seoDescription: formState.seoDescription.trim() || undefined,
          createdAt: selectedPost.createdAt,
          updatedAt: now,
          publishedAt: formState.status === 'published' ? selectedPost.publishedAt ?? now : undefined,
        })

        setMessageTone('success')
        setMessage(`Updated "${title}".`)
      } else {
        const docRef = await addDoc(collection(db, 'blogPosts'), {
          ...payload,
          createdAt: serverTimestamp(),
        })

        const nextPost: BlogPost = {
          id: docRef.id,
          title,
          slug,
          excerpt,
          content,
          category: formState.category.trim() || 'Excel Tips',
          tags,
          authorName: formState.authorName.trim() || adminName || defaultFormState.authorName,
          coverImageUrl: formState.coverImageUrl.trim() || undefined,
          status: formState.status,
          featured: formState.featured,
          focusKeyword: formState.focusKeyword.trim() || undefined,
          seoTitle: formState.seoTitle.trim() || undefined,
          seoDescription: formState.seoDescription.trim() || undefined,
          seoKeywords,
          createdAt: now,
          updatedAt: now,
          publishedAt: formState.status === 'published' ? now : undefined,
        }

        upsertPostInState(nextPost)
        setSelectedPostId(docRef.id)
        setMessageTone('success')
        setMessage(`Created "${title}".`)
      }
    } catch (error) {
      console.error('Failed to save blog post:', error)
      setMessageTone('error')
      setMessage(toFriendlyBlogError(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (post: BlogPost) => {
    const confirmed = window.confirm(`Delete "${post.title}"?`)
    if (!confirmed) {
      return
    }

    setDeletingId(post.id)
    setMessage(null)
    setMessageTone(null)

    try {
      await deleteDoc(doc(db, 'blogPosts', post.id))
      setPosts((current) => current.filter((item) => item.id !== post.id))
      if (selectedPostId === post.id) {
        resetForm()
      }
      setMessageTone('success')
      setMessage(`Deleted "${post.title}".`)
    } catch (error) {
      console.error('Failed to delete blog post:', error)
      setMessageTone('error')
      setMessage(toFriendlyBlogError(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#142842]">Blog & SEO Studio</h2>
          <p className="mt-1 text-sm text-[#5a6f8a]">
            Create blog posts, target Ghana-focused Excel keywords, and publish SEO-friendly content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/blog" target="_blank" rel="noreferrer" className="btn-secondary w-full sm:w-auto">
            View Blog
          </a>
          <button type="button" onClick={resetForm} className="btn-secondary w-full sm:w-auto">
            New Post
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            messageTone === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-[#1e3757]">Title</label>
              <input
                value={formState.title}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    title: event.target.value,
                    slug: current.slug ? current.slug : slugify(event.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                placeholder="Excel Skills Employers Look For in Ghana"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1e3757]">Slug</label>
              <input
                value={formState.slug}
                onChange={(event) => setFormState((current) => ({ ...current, slug: slugify(event.target.value) }))}
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                placeholder="excel-skills-employers-look-for-in-ghana"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1e3757]">Category</label>
              <input
                value={formState.category}
                onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                placeholder="Job Readiness"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1e3757]">Author</label>
              <input
                value={formState.authorName}
                onChange={(event) => setFormState((current) => ({ ...current, authorName: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                placeholder="Excel Mastery Team"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1e3757]">Cover Image URL</label>
              <input
                value={formState.coverImageUrl}
                onChange={(event) => setFormState((current) => ({ ...current, coverImageUrl: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                placeholder="https://..."
              />
              {formState.coverImageUrl.trim() ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[#dbe5f1] bg-[#f8fbff]">
                  <img src={formState.coverImageUrl.trim()} alt="Cover preview" className="h-40 w-full object-cover" />
                </div>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1e3757]">Tags</label>
              <input
                value={formState.tags}
                onChange={(event) => setFormState((current) => ({ ...current, tags: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                placeholder="excel quiz, ghana jobs, spreadsheet skills"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1e3757]">Status</label>
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value === 'draft' ? 'draft' : 'published',
                  }))
                }
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-[#dbe5f1] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#1e3757]">
              <input
                type="checkbox"
                checked={formState.featured}
                onChange={(event) => setFormState((current) => ({ ...current, featured: event.target.checked }))}
              />
              Feature this post on the blog landing page
            </label>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-[#1e3757]">Excerpt</label>
              <textarea
                value={formState.excerpt}
                onChange={(event) => setFormState((current) => ({ ...current, excerpt: event.target.value }))}
                rows={3}
                className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                placeholder="Short summary shown in blog cards and previews."
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label className="text-sm font-semibold text-[#1e3757]">Content</label>
                  <p className="mt-1 text-xs text-[#5a6f8a]">
                    Supports: ## headings, - lists, &gt; quotes, **bold**, *italic*, [links](url), ![alt](url)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={contentMode === 'write' ? 'btn-primary w-full sm:w-auto' : 'btn-secondary w-full sm:w-auto'}
                    onClick={() => setContentMode('write')}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    className={contentMode === 'preview' ? 'btn-primary w-full sm:w-auto' : 'btn-secondary w-full sm:w-auto'}
                    onClick={() => setContentMode('preview')}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {contentMode === 'write' ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-3">
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => prefixSelectedLines('## ')}>
                      H2
                    </button>
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => prefixSelectedLines('### ')}>
                      H3
                    </button>
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => wrapSelection('**', '**', 'bold text')}>
                      Bold
                    </button>
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => wrapSelection('*', '*', 'italic text')}>
                      Italic
                    </button>
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => prefixSelectedLines('- ')}>
                      Bullets
                    </button>
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => prefixSelectedLines('> ')}>
                      Quote
                    </button>
                    <button
                      type="button"
                      className="btn-secondary w-full sm:w-auto"
                      onClick={() => insertSnippet('[link text](https://)', 'https://'.length + 1)}
                    >
                      Link
                    </button>
                    <button
                      type="button"
                      className="btn-secondary w-full sm:w-auto"
                      onClick={() => insertSnippet('\n\n![Image](https://)\n\n', 'https://'.length + 3)}
                    >
                      Image
                    </button>
                  </div>

                  <textarea
                    ref={contentTextareaRef}
                    value={formState.content}
                    onChange={(event) => setFormState((current) => ({ ...current, content: event.target.value }))}
                    rows={16}
                    className="mt-3 w-full rounded-lg border border-[#dbe5f1] px-4 py-3 text-sm leading-relaxed focus:border-transparent focus:ring-2 focus:ring-excel-green"
                    placeholder={
                      'Write like Substack: short paragraphs with blank lines.\n\n## Heading\n\n- Bullet one\n- Bullet two\n\n> A short callout\n\n**Bold**, *italic*, [links](https://...), and images: ![alt](url)'
                    }
                  />
                </>
              ) : (
                <div className="mt-3 rounded-xl border border-[#dbe5f1] bg-white p-5">
                  {formState.content.trim() ? (
                    <BlogContent content={formState.content} />
                  ) : (
                    <p className="text-sm text-[#5a6f8a]">Nothing to preview yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
            <h3 className="text-lg font-semibold text-[#142842]">SEO Fields</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-[#1e3757]">Focus Keyword</label>
                <input
                  value={formState.focusKeyword}
                  onChange={(event) => setFormState((current) => ({ ...current, focusKeyword: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  placeholder="excel test questions for job interviews"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#1e3757]">SEO Title</label>
                <input
                  value={formState.seoTitle}
                  onChange={(event) => setFormState((current) => ({ ...current, seoTitle: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  placeholder="Free Excel Test Questions for Job Interviews in Ghana"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-[#1e3757]">SEO Description</label>
                <textarea
                  value={formState.seoDescription}
                  onChange={(event) => setFormState((current) => ({ ...current, seoDescription: event.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  placeholder="Concise summary for search results, around 150-160 characters."
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-[#1e3757]">SEO Keywords</label>
                <input
                  value={formState.seoKeywords}
                  onChange={(event) => setFormState((current) => ({ ...current, seoKeywords: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[#dbe5f1] px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-excel-green"
                  placeholder="excel quiz online, excel training ghana, excel assessment test"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
              {saving ? 'Saving...' : selectedPost ? 'Update Post' : 'Create Post'}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary w-full sm:w-auto" disabled={saving}>
              Reset Form
            </button>
            {selectedPost?.status === 'published' ? (
              <a href={`/blog/${selectedPost.slug}`} target="_blank" rel="noreferrer" className="btn-secondary w-full sm:w-auto">
                View Live Post
              </a>
            ) : null}
          </div>
        </form>

        <div className="space-y-5">
          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <h3 className="text-lg font-semibold text-[#142842]">Keyword Bank</h3>
            <p className="mt-1 text-sm text-[#5a6f8a]">Primary and long-tail keywords pulled from the Ghana SEO strategy document.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...primarySeoKeywords.slice(0, 6), ...longTailSeoKeywords.slice(0, 4)].map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center rounded-full border border-[#cfdceb] bg-[#f8fbff] px-3 py-1 text-xs font-medium text-[#1e3757]"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </section>

          <BlogMediaLibrary
            onInsertImage={(url) => {
              insertImageMarkdown(url)
              setContentMode('write')
            }}
            onSetCover={(url) => setFormState((current) => ({ ...current, coverImageUrl: url }))}
          />

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <h3 className="text-lg font-semibold text-[#142842]">Suggested Blog Topics</h3>
            <div className="mt-3 space-y-2">
              {blogTopicSuggestions.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      title: current.title || topic,
                      slug: current.slug || slugify(topic),
                      seoTitle: current.seoTitle || topic,
                    }))
                  }
                  className="block w-full rounded-lg border border-[#dbe5f1] bg-[#f8fbff] px-4 py-3 text-left text-sm text-[#1e3757] transition-colors hover:bg-white"
                >
                  {topic}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
            <h3 className="text-lg font-semibold text-[#142842]">Posts</h3>
            {loading ? (
              <p className="mt-3 text-sm text-[#5a6f8a]">Loading posts...</p>
            ) : posts.length > 0 ? (
              <div className="mt-4 space-y-3">
                {posts.map((post) => (
                  <article key={post.id} className="rounded-xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-[#142842]">{post.title}</h4>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              post.status === 'published'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }`}
                          >
                            {post.status}
                          </span>
                          {post.featured ? (
                            <span className="inline-flex rounded-full border border-[#cfdceb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1e3757]">
                              featured
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[#5a6f8a]">/{post.slug}</p>
                        <p className="mt-2 text-sm text-[#5a6f8a]">{post.excerpt || buildExcerpt(post.content)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => applyPostToForm(post)} className="btn-secondary w-full sm:w-auto">
                          Edit
                        </button>
                        {post.status === 'published' ? (
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="btn-secondary w-full sm:w-auto">
                            View
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleDelete(post)}
                          className="btn-secondary w-full sm:w-auto"
                          disabled={deletingId === post.id}
                        >
                          {deletingId === post.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#5a6f8a]">
                      <span className="inline-flex items-center rounded-full border border-[#dbe5f1] bg-white px-3 py-1">
                        {post.category}
                      </span>
                      {post.focusKeyword ? (
                        <span className="inline-flex items-center rounded-full border border-[#dbe5f1] bg-white px-3 py-1">
                          Focus: {post.focusKeyword}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center rounded-full border border-[#dbe5f1] bg-white px-3 py-1">
                        Updated {post.updatedAt.toLocaleDateString()}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#5a6f8a]">No blog posts yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
