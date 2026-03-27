import Link from 'next/link'
import type { BlogPost } from '@/types'
import { slugifyBlogValue } from '@/lib/blog'

type BlogPostCardProps = {
  post: BlogPost
  featured?: boolean
}

export default function BlogPostCard({ post, featured = false }: BlogPostCardProps) {
  return (
    <article
      className={
        featured
          ? 'overflow-hidden rounded-2xl border border-[#d9e3ef] bg-white shadow-sm'
          : 'rounded-2xl border border-[#d9e3ef] bg-white p-6 shadow-sm'
      }
    >
      {featured ? (
        post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt={post.title} className="h-56 w-full object-cover" />
        ) : (
          <div className="h-40 bg-gradient-to-br from-[#d9e8f7] via-[#edf4fb] to-[#d9f0ea]" />
        )
      ) : null}

      <div className={featured ? 'p-6' : ''}>
        <div className="flex flex-wrap gap-2 text-xs text-[#5f7491]">
          <Link
            href={`/blog/category/${slugifyBlogValue(post.category)}`}
            className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1 transition hover:border-[#aac0de] hover:bg-[#eef5ff]"
          >
            {post.category}
          </Link>
          <span className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1">
            {post.publishedAt?.toLocaleDateString() ?? post.updatedAt.toLocaleDateString()}
          </span>
          {post.focusKeyword ? (
            <span className="inline-flex rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1">
              {post.focusKeyword}
            </span>
          ) : null}
        </div>

        <h3 className={`mt-4 font-semibold text-[#142842] ${featured ? 'text-2xl' : 'text-xl'}`}>{post.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[#5a6f8a]">{post.excerpt}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.slice(0, featured ? 4 : 3).map((tag) => (
            <Link
              key={tag}
              href={`/blog/tag/${slugifyBlogValue(tag)}`}
              className="inline-flex rounded-full border border-[#dbe5f1] px-2.5 py-1 text-[11px] text-[#5a6f8a] transition hover:border-[#aac0de] hover:bg-[#f8fbff]"
            >
              #{tag}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`/blog/${post.slug}`} className={featured ? 'btn-primary w-full sm:w-auto' : 'btn-secondary w-full sm:w-auto'}>
            {featured ? 'Read Article' : 'Read More'}
          </Link>
          <span className="text-xs text-[#7286a2]">By {post.authorName}</span>
        </div>
      </div>
    </article>
  )
}
