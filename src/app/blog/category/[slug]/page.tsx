import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BlogPostCard from '@/components/blog/BlogPostCard'
import { findBlogCategoryBySlug, getBlogCategories, getPublishedBlogPosts, slugifyBlogValue } from '@/lib/blog'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

type BlogCategoryPageProps = {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  const posts = await getPublishedBlogPosts()
  return getBlogCategories(posts).map((category) => ({
    slug: category.slug,
  }))
}

export async function generateMetadata({ params }: BlogCategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const posts = await getPublishedBlogPosts()
  const category = findBlogCategoryBySlug(posts, slug)

  if (!category) {
    return buildMetadata({
      title: 'Blog Category Not Found',
      description: 'The requested blog category could not be found.',
      path: `/blog/category/${slug}`,
      noIndex: true,
    })
  }

  return buildMetadata({
    title: `${category.name} Articles`,
    description: `Explore Excel blog posts in the ${category.name} category for Ghana-based learners and teams.`,
    path: `/blog/category/${slugifyBlogValue(category.name)}`,
    keywords: [category.name, `${category.name} excel tips`, 'excel blog ghana'],
  })
}

export default async function BlogCategoryPage({ params }: BlogCategoryPageProps) {
  const { slug } = await params
  const posts = await getPublishedBlogPosts()
  const category = findBlogCategoryBySlug(posts, slug)

  if (!category) {
    notFound()
  }

  const categoryPosts = posts.filter((post) => slugifyBlogValue(post.category) === category.slug)

  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#144d6a] to-[#1f6f6d] px-6 py-8 text-white shadow-xl md:px-10">
            <p className="text-xs uppercase tracking-[0.22em] text-[#c8e8ff]">Category Archive</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">{category.name}</h1>
            <p className="mt-3 max-w-3xl text-sm text-[#d6ebff] md:text-base">
              {categoryPosts.length} article{categoryPosts.length === 1 ? '' : 's'} focused on {category.name.toLowerCase()}.
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
            {categoryPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
