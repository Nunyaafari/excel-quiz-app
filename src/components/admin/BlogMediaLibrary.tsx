'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useAuth } from '@/lib/auth'

type BlogMediaItem = {
  name: string
  fullPath: string
  url: string
}

type BlogMediaLibraryProps = {
  onInsertImage: (url: string) => void
  onSetCover: (url: string) => void
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
}

function toFriendlyMediaError(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'storage/unauthorized') {
      return 'Permission denied. Add this account to Firestore /admins with active=true, then redeploy rules.'
    }
    if (error.code === 'storage/canceled') {
      return 'Upload canceled.'
    }
    return error.message || 'Media action failed.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Media action failed.'
}

function getSortKey(item: Pick<BlogMediaItem, 'name'>) {
  const match = /^(\d{10,})-/.exec(item.name)
  if (!match) {
    return 0
  }
  return Number(match[1]) || 0
}

export default function BlogMediaLibrary({ onInsertImage, onSetCover }: BlogMediaLibraryProps) {
  const { user } = useAuth()
  const [items, setItems] = useState<BlogMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const canManage = Boolean(user?.uid)

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => getSortKey(right) - getSortKey(left) || right.name.localeCompare(left.name))
  }, [items])

  const loadItems = useCallback(async () => {
    if (!canManage) {
      setItems([])
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const rootRef = ref(storage, 'blog-media')
      const snapshot = await listAll(rootRef)
      const next = await Promise.all(
        snapshot.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef)
          return {
            name: itemRef.name,
            fullPath: itemRef.fullPath,
            url,
          }
        })
      )
      setItems(next)
    } catch (error) {
      setMessage(toFriendlyMediaError(error))
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    if (!canManage) {
      setMessage('Sign in as an admin to upload media.')
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const uploads = Array.from(files).map(async (file) => {
        const safeName = sanitizeFileName(file.name) || 'image'
        const objectPath = `blog-media/${Date.now()}-${safeName}`
        const objectRef = ref(storage, objectPath)
        await uploadBytes(objectRef, file, { contentType: file.type || undefined })
        const url = await getDownloadURL(objectRef)
        return { name: objectRef.name, fullPath: objectRef.fullPath, url }
      })

      const uploadedItems = await Promise.all(uploads)
      setItems((current) => [...uploadedItems, ...current])
      setMessage(`Uploaded ${uploadedItems.length} file${uploadedItems.length === 1 ? '' : 's'}.`)
    } catch (error) {
      setMessage(toFriendlyMediaError(error))
    } finally {
      setUploading(false)
    }
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Copied URL to clipboard.')
    } catch {
      setMessage('Could not copy URL. Select and copy manually.')
    }
  }

  return (
    <section className="rounded-2xl border border-[#d9e3ef] bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#142842]">Media Library</h3>
          <p className="mt-1 text-sm text-[#5a6f8a]">Upload images for blog covers and in-article visuals.</p>
        </div>
        <button type="button" onClick={() => void loadItems()} className="btn-secondary w-full sm:w-auto" disabled={!canManage || loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-lg border border-[#dbe5f1] bg-[#f8fbff] px-4 py-3 text-sm text-[#1e3757]">
          {message}
        </div>
      ) : null}

      <div className="mt-4">
        <label className={`btn-primary inline-flex w-full justify-center sm:w-auto ${!canManage || uploading ? 'opacity-60' : ''}`}>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
            disabled={!canManage || uploading}
          />
          {uploading ? 'Uploading...' : 'Upload Images'}
        </label>
        {!canManage ? <p className="mt-2 text-xs text-[#5a6f8a]">Sign in as an admin to manage media.</p> : null}
      </div>

      {sortedItems.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sortedItems.slice(0, 12).map((item) => (
            <article key={item.fullPath} className="overflow-hidden rounded-xl border border-[#dbe5f1] bg-white">
              <div className="aspect-[16/9] bg-[#eef2f6]">
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-4">
                <p className="truncate text-xs font-semibold text-[#142842]" title={item.name}>
                  {item.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => void copyUrl(item.url)}>
                    Copy URL
                  </button>
                  <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => onInsertImage(item.url)}>
                    Insert
                  </button>
                  <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => onSetCover(item.url)}>
                    Set Cover
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#5a6f8a]">{loading ? 'Loading media...' : 'No uploads yet.'}</p>
      )}
    </section>
  )
}
