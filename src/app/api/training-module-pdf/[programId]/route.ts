import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { getTrainingProgramById } from '@/lib/training-content'

export const runtime = 'nodejs'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = 48
const TOP_OFFSET = 138
const BOTTOM_OFFSET = 60

const brandColors = {
  navy: rgb(15 / 255, 39 / 255, 68 / 255),
  teal: rgb(31 / 255, 111 / 255, 109 / 255),
  sky: rgb(93 / 255, 214 / 255, 207 / 255),
  slate: rgb(90 / 255, 111 / 255, 138 / 255),
  ink: rgb(20 / 255, 40 / 255, 66 / 255),
  soft: rgb(238 / 255, 242 / 255, 246 / 255),
  white: rgb(1, 1, 1),
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (font.widthOfTextAtSize(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    currentLine = word
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function addBrandedPage(pdfDoc: PDFDocument) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 112,
    width: PAGE_WIDTH,
    height: 112,
    color: brandColors.navy,
  })

  page.drawRectangle({
    x: PAGE_WIDTH - 190,
    y: PAGE_HEIGHT - 112,
    width: 190,
    height: 112,
    color: brandColors.teal,
  })

  page.drawCircle({
    x: PAGE_WIDTH - 60,
    y: PAGE_HEIGHT - 28,
    size: 52,
    color: rgb(1, 1, 1),
    opacity: 0.08,
  })

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: 10,
    color: brandColors.sky,
  })

  return page
}

function drawHeader(page: PDFPage, boldFont: PDFFont, regularFont: PDFFont) {
  page.drawText('ATI', {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 58,
    size: 20,
    font: boldFont,
    color: brandColors.white,
  })

  page.drawText('Animeight Training Institute', {
    x: PAGE_MARGIN + 46,
    y: PAGE_HEIGHT - 55,
    size: 18,
    font: boldFont,
    color: brandColors.white,
  })

  page.drawText('Practical Excel learning, assessment, and workforce upskilling', {
    x: PAGE_MARGIN + 46,
    y: PAGE_HEIGHT - 76,
    size: 10,
    font: regularFont,
    color: brandColors.white,
  })
}

function drawFooter(page: PDFPage, regularFont: PDFFont, pageIndex: number, pageCount: number) {
  page.drawText('Contact: +233 558358446  |  LinkedIn: linkedin.com/in/nunyaafari', {
    x: PAGE_MARGIN,
    y: 24,
    size: 9,
    font: regularFont,
    color: brandColors.slate,
  })

  page.drawText(`ATI Training Module Guide  |  Page ${pageIndex + 1} of ${pageCount}`, {
    x: PAGE_WIDTH - PAGE_MARGIN - 178,
    y: 24,
    size: 9,
    font: regularFont,
    color: brandColors.slate,
  })
}

function drawSectionTitle(page: PDFPage, text: string, y: number, boldFont: PDFFont) {
  page.drawText(text.toUpperCase(), {
    x: PAGE_MARGIN,
    y,
    size: 11,
    font: boldFont,
    color: brandColors.teal,
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { programId } = await params
  const program = getTrainingProgramById(programId)

  if (!program) {
    return NextResponse.json({ error: 'Training module not found.' }, { status: 404 })
  }

  const pdfDoc = await PDFDocument.create()
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = addBrandedPage(pdfDoc)
  drawHeader(page, boldFont, regularFont)
  let y = PAGE_HEIGHT - TOP_OFFSET

  const startNewPage = () => {
    page = addBrandedPage(pdfDoc)
    drawHeader(page, boldFont, regularFont)
    y = PAGE_HEIGHT - TOP_OFFSET
  }

  const ensureSpace = (heightNeeded: number) => {
    if (y - heightNeeded < BOTTOM_OFFSET) {
      startNewPage()
    }
  }

  const drawParagraph = (text: string, fontSize = 11, color = brandColors.slate, gapAfter = 14) => {
    const lines = wrapText(text, regularFont, fontSize, PAGE_WIDTH - PAGE_MARGIN * 2)
    const lineHeight = fontSize + 4
    ensureSpace(lines.length * lineHeight + gapAfter)

    for (const line of lines) {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y,
        size: fontSize,
        font: regularFont,
        color,
      })
      y -= lineHeight
    }

    y -= gapAfter
  }

  const drawBulletList = (items: string[]) => {
    for (const item of items) {
      const bulletX = PAGE_MARGIN + 4
      const textX = PAGE_MARGIN + 18
      const maxWidth = PAGE_WIDTH - textX - PAGE_MARGIN
      const lines = wrapText(item, regularFont, 11, maxWidth)
      const blockHeight = lines.length * 15 + 6

      ensureSpace(blockHeight)

      page.drawText('•', {
        x: bulletX,
        y,
        size: 13,
        font: boldFont,
        color: brandColors.teal,
      })

      for (const line of lines) {
        page.drawText(line, {
          x: textX,
          y,
          size: 11,
          font: regularFont,
          color: brandColors.ink,
        })
        y -= 15
      }

      y -= 6
    }
  }

  page.drawText(program.title, {
    x: PAGE_MARGIN,
    y,
    size: 24,
    font: boldFont,
    color: brandColors.ink,
  })
  y -= 28

  page.drawText(program.duration, {
    x: PAGE_MARGIN,
    y,
    size: 12,
    font: boldFont,
    color: brandColors.teal,
  })
  y -= 26

  drawParagraph(
    `${program.description} This ATI module guide is designed for coordinators, HR teams, and professionals who need a polished outline for planning, approval, or internal circulation.`,
    11,
    brandColors.slate,
    10
  )

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 58,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 58,
    color: brandColors.soft,
    borderColor: rgb(0.86, 0.9, 0.95),
    borderWidth: 1,
  })
  page.drawText('ATI Promise', {
    x: PAGE_MARGIN + 16,
    y: y - 18,
    size: 11,
    font: boldFont,
    color: brandColors.teal,
  })
  page.drawText('Practical delivery, workplace-ready exercises, and branded training support for every cohort.', {
    x: PAGE_MARGIN + 16,
    y: y - 36,
    size: 10,
    font: regularFont,
    color: brandColors.ink,
  })
  y -= 80

  drawSectionTitle(page, 'Learning Objectives', y, boldFont)
  y -= 22
  drawBulletList(program.objectives)
  y -= 6

  drawSectionTitle(page, 'Module Outline', y, boldFont)
  y -= 22
  drawBulletList(program.outline)
  y -= 2

  ensureSpace(100)
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 86,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 86,
    color: rgb(247 / 255, 250 / 255, 255 / 255),
    borderColor: rgb(0.86, 0.9, 0.95),
    borderWidth: 1,
  })
  page.drawText('Delivery Options', {
    x: PAGE_MARGIN + 16,
    y: y - 18,
    size: 11,
    font: boldFont,
    color: brandColors.teal,
  })
  page.drawText('6 hrs full-day session  |  3 hrs over 2 days  |  2 hrs over 3 days', {
    x: PAGE_MARGIN + 16,
    y: y - 38,
    size: 10,
    font: regularFont,
    color: brandColors.ink,
  })
  page.drawText('Bonus resource included: Excel shortcuts cheat sheet and guided practice files.', {
    x: PAGE_MARGIN + 16,
    y: y - 56,
    size: 10,
    font: regularFont,
    color: brandColors.slate,
  })
  y -= 108

  const pages = pdfDoc.getPages()
  pages.forEach((pdfPage, pageIndex) => {
    drawFooter(pdfPage, regularFont, pageIndex, pages.length)
  })

  const pdfBytes = await pdfDoc.save()
  const fileName = `${slugify(program.title)}-ati-training-module.pdf`

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
