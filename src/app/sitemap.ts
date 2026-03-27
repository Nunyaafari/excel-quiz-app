import type { MetadataRoute } from 'next'
import { getBlogCategories, getBlogTags, getPublishedBlogPosts } from '@/lib/blog'
import { absoluteUrl } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedBlogPosts()
  const categories = getBlogCategories(posts)
  const tags = getBlogTags(posts)
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/blog'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/training'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/training/request'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.updatedAt,
    changeFrequency: 'monthly',
    priority: post.featured ? 0.85 : 0.75,
  }))

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: absoluteUrl(`/blog/category/${category.slug}`),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const tagRoutes: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: absoluteUrl(`/blog/tag/${tag.slug}`),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.65,
  }))

  return [...staticRoutes, ...blogRoutes, ...categoryRoutes, ...tagRoutes]
}
