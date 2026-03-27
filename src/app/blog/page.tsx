import Link from 'next/link'
import type { Metadata } from 'next'
import BlogPostCard from '@/components/blog/BlogPostCard'
import { filterBlogPosts, findBlogCategoryBySlug, findBlogTagBySlug, getBlogCategories, getBlogTags, getPublishedBlogPosts } from '@/lib/blog'
import { buildMetadata, longTailSeoKeywords } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Excel Blog Ghana',
  description:
    'Read Excel tips, quiz prep guides, interview practice ideas, and training content tailored for learners and teams in Ghana.',
  path: '/blog',
  keywords: longTailSeoKeywords,
})

export const revalidate = 300

type BlogPageProps = {
  searchParams?: Promise<{
    q?: string
    category?: string
    tag?: string
  }>
}

function buildBlogFilterHref(filters: { q?: string; category?: string; tag?: string }) {
  const params = new URLSearchParams()

  if (filters.q) {
    params.set('q', filters.q)
  }

  if (filters.category) {
    params.set('category', filters.category)
  }

  if (filters.tag) {
    params.set('tag', filters.tag)
  }

  const query = params.toString()
  return query ? `/blog?${query}` : '/blog'
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const query = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q.trim() : ''
  const categorySlug = typeof resolvedSearchParams.category === 'string' ? resolvedSearchParams.category.trim() : ''
  const tagSlug = typeof resolvedSearchParams.tag === 'string' ? resolvedSearchParams.tag.trim() : ''
  const posts = await getPublishedBlogPosts()
  const categories = getBlogCategories(posts)
  const tags = getBlogTags(posts)
  const activeCategory = categorySlug ? findBlogCategoryBySlug(posts, categorySlug) : null
  const activeTag = tagSlug ? findBlogTagBySlug(posts, tagSlug) : null
  const filteredPosts = filterBlogPosts(posts, { query, categorySlug, tagSlug })
  const featuredPosts = filteredPosts.filter((post) => post.featured)
  const regularPosts = filteredPosts.filter((post) => !post.featured)

  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] px-6 py-8 text-white shadow-xl md:px-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#5dd6cf]/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#8fb8ff]/20 blur-3xl" />
            <p className="text-xs uppercase tracking-[0.22em] text-[#c8e8ff]">Excel Learning Blog</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Excel Tips, Quiz Prep, and Skill Growth for Ghana</h1>
            <p className="mt-3 max-w-3xl text-sm text-[#d6ebff] md:text-base">
              Practical articles for students, job seekers, and corporate teams who want to improve Excel skills with guided practice and assessments.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#d6ebff]">
              <span className="inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-1">Excel quiz online</span>
              <span className="inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-1">Excel training Ghana</span>
              <span className="inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-1">Excel interview practice</span>
            </div>
            <form action="/blog" className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm md:flex-row">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search posts, topics, skills, or keywords"
                className="min-w-0 flex-1 rounded-xl border border-white/25 bg-white/95 px-4 py-3 text-sm text-[#142842] outline-none placeholder:text-[#68809d]"
              />
              <button type="submit" className="btn-hero-primary w-full sm:w-auto">
                Search Blog
              </button>
              {(query || activeCategory || activeTag) ? (
                <Link href="/blog" className="btn-hero-secondary w-full sm:w-auto">
                  Clear Filters
                </Link>
              ) : null}
            </form>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-[#142842]">Discover Articles</h2>
                  <p className="mt-1 text-sm text-[#5a6f8a]">
                    {filteredPosts.length} article{filteredPosts.length === 1 ? '' : 's'} found
                    {query ? ` for "${query}"` : ''}
                    {activeCategory ? ` in ${activeCategory.name}` : ''}
                    {activeTag ? ` tagged ${activeTag.name}` : ''}.
                  </p>
                </div>
                <Link href="/training" className="btn-secondary w-full sm:w-auto">
                  Explore Training Programs
                </Link>
              </div>

              {(query || activeCategory || activeTag) ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#5f7491]">
                  {query ? <span className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1">Search: {query}</span> : null}
                  {activeCategory ? (
                    <span className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1">
                      Category: {activeCategory.name}
                    </span>
                  ) : null}
                  {activeTag ? (
                    <span className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1">Tag: {activeTag.name}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[#142842]">Categories</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Link
                      key={category.slug}
                      href={buildBlogFilterHref({ q: query, category: category.slug })}
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs transition ${
                        activeCategory?.slug === category.slug
                          ? 'border-[#12365a] bg-[#12365a] text-white'
                          : 'border-[#dbe5f1] bg-[#f8fbff] text-[#1e3757] hover:border-[#aac0de]'
                      }`}
                    >
                      {category.name} ({category.count})
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[#142842]">Popular Tags</h2>
                  <Link href="/blog" className="text-xs font-semibold text-[#12365a] hover:text-[#0f2744]">
                    View all
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.slice(0, 14).map((tag) => (
                    <Link
                      key={tag.slug}
                      href={buildBlogFilterHref({ q: query, tag: tag.slug })}
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs transition ${
                        activeTag?.slug === tag.slug
                          ? 'border-[#12365a] bg-[#12365a] text-white'
                          : 'border-[#dbe5f1] bg-[#f8fbff] text-[#1e3757] hover:border-[#aac0de]'
                      }`}
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          {featuredPosts.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#142842]">Featured Articles</h2>
                <p className="mt-1 text-sm text-[#5a6f8a]">High-priority articles selected from the admin blog studio.</p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {featuredPosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} featured />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#142842]">All Blog Posts</h2>
              <p className="mt-1 text-sm text-[#5a6f8a]">Fresh Excel learning content published through the admin dashboard.</p>
            </div>

            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {(regularPosts.length > 0 ? regularPosts : filteredPosts).map((post) => (
                  <BlogPostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d9e3ef] bg-white p-10 text-center text-sm text-[#5a6f8a]">
                No blog posts matched your search yet. Try a broader keyword or clear the active filters.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
