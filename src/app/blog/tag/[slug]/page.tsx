import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BlogPostCard from '@/components/blog/BlogPostCard'
import { findBlogTagBySlug, getBlogTags, getPublishedBlogPosts, slugifyBlogValue } from '@/lib/blog'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

type BlogTagPageProps = {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  const posts = await getPublishedBlogPosts()
  return getBlogTags(posts).map((tag) => ({
    slug: tag.slug,
  }))
}

export async function generateMetadata({ params }: BlogTagPageProps): Promise<Metadata> {
  const { slug } = await params
  const posts = await getPublishedBlogPosts()
  const tag = findBlogTagBySlug(posts, slug)

  if (!tag) {
    return buildMetadata({
      title: 'Blog Tag Not Found',
      description: 'The requested blog tag could not be found.',
      path: `/blog/tag/${slug}`,
      noIndex: true,
    })
  }

  return buildMetadata({
    title: `#${tag.name} Articles`,
    description: `Browse Excel articles tagged ${tag.name} for quiz preparation, office skills, and training support.`,
    path: `/blog/tag/${slugifyBlogValue(tag.name)}`,
    keywords: [tag.name, `${tag.name} excel`, 'excel quiz ghana'],
  })
}

export default async function BlogTagPage({ params }: BlogTagPageProps) {
  const { slug } = await params
  const posts = await getPublishedBlogPosts()
  const tag = findBlogTagBySlug(posts, slug)

  if (!tag) {
    notFound()
  }

  const taggedPosts = posts.filter((post) => post.tags.some((item) => slugifyBlogValue(item) === tag.slug))

  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] px-6 py-8 text-white shadow-xl md:px-10">
            <p className="text-xs uppercase tracking-[0.22em] text-[#c8e8ff]">Tag Archive</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">#{tag.name}</h1>
            <p className="mt-3 max-w-3xl text-sm text-[#d6ebff] md:text-base">
              {taggedPosts.length} article{taggedPosts.length === 1 ? '' : 's'} connected to this topic.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/blog" className="btn-hero-secondary w-full sm:w-auto">
                Back to Blog
              </Link>
              <Link href="/training" className="btn-hero-primary w-full sm:w-auto">
                View Training Programs
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {taggedPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
