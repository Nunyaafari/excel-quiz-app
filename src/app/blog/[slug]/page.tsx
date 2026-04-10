import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublishedBlogPostBySlug, slugifyBlogValue } from '@/lib/blog'
import { absoluteUrl, buildMetadata } from '@/lib/seo'
import BlogContent from '@/components/blog/BlogContent'

export const revalidate = 300

type BlogArticlePageProps = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedBlogPostBySlug(slug)

  if (!post) {
    return buildMetadata({
      title: 'Blog Article Not Found',
      description: 'The requested Excel blog article could not be found.',
      path: `/blog/${slug}`,
      noIndex: true,
    })
  }

  const metadata = buildMetadata({
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    path: `/blog/${post.slug}`,
    keywords: [
      post.focusKeyword || '',
      ...post.seoKeywords,
      ...post.tags,
      post.category,
    ].filter(Boolean),
    image: post.coverImageUrl,
  })

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString() || post.updatedAt.toISOString(),
      authors: [post.authorName],
    },
  }
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params
  const post = await getPublishedBlogPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : [],
    datePublished: post.publishedAt?.toISOString() || post.updatedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: post.authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Excel Mastery Quiz Ghana',
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    keywords: [post.focusKeyword, ...post.seoKeywords, ...post.tags].filter(Boolean).join(', '),
  }

  return (
    <div className="min-h-screen bg-[#eef2f6] py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <div className="container mx-auto px-4">
        <article className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap gap-2">
            <Link href="/blog" className="btn-secondary">
              Back to Blog
            </Link>
            <Link href="/quiz/survey" className="btn-primary">
              Take the Quiz
            </Link>
          </div>

          <header className="overflow-hidden rounded-2xl border border-[#d9e3ef] bg-white shadow-sm">
            {post.coverImageUrl ? (
              <img src={post.coverImageUrl} alt={post.title} className="h-72 w-full object-cover" />
            ) : null}
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap gap-2 text-xs text-[#5f7491]">
                <Link
                  href={`/blog/category/${slugifyBlogValue(post.category)}`}
                  className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1 transition hover:border-[#aac0de] hover:bg-[#eef5ff]"
                >
                  {post.category}
                </Link>
                {post.focusKeyword ? (
                  <span className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1">
                    {post.focusKeyword}
                  </span>
                ) : null}
                <span className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1">
                  {post.publishedAt?.toLocaleDateString() ?? post.updatedAt.toLocaleDateString()}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold text-[#142842] md:text-5xl">{post.title}</h1>
              <p className="mt-4 text-sm leading-relaxed text-[#4f6483] md:text-base">{post.excerpt}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#5a6f8a]">
                <span>By {post.authorName}</span>
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog/tag/${slugifyBlogValue(tag)}`}
                    className="inline-flex rounded-full border border-[#dbe5f1] px-2.5 py-1 transition hover:border-[#aac0de] hover:bg-[#f8fbff]"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          </header>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-8">
            <BlogContent content={post.content} />
          </section>

          <section className="rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-semibold text-[#142842]">Keep Building Your Excel Skills</h2>
            <p className="mt-2 text-sm text-[#5a6f8a]">
              Ready to move from reading to practice? Take the quiz, review your weak areas, and use the results to guide training.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/quiz/survey" className="btn-primary">
                Start the Excel Quiz
              </Link>
              <Link href="/training" className="btn-secondary">
                Explore Training
              </Link>
            </div>
          </section>
        </article>
      </div>
    </div>
  )
}
