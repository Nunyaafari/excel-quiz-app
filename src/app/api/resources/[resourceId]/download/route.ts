import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { getSiteResourceById } from '@/lib/site-resources'

export const runtime = 'nodejs'

const contentTypesByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params
  const resource = getSiteResourceById(resourceId)

  if (!resource) {
    return NextResponse.json({ error: 'Resource not found.' }, { status: 404 })
  }

  const absolutePath = path.join(process.cwd(), 'public', 'resources', resource.fileName)

  try {
    const fileBuffer = await readFile(absolutePath)
    const extension = resource.fileName.split('.').pop()?.toLowerCase() ?? ''
    const contentType = contentTypesByExtension[extension] ?? 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${resource.fileName}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Resource file is unavailable.' }, { status: 404 })
  }
}
