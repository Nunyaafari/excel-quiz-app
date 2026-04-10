import Papa from 'papaparse'
import { FirebaseError } from 'firebase/app'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { Question } from '@/types'

export interface CSVQuestion {
  text: string
  category: string
  option1: string
  option2: string
  option3: string
  option4: string
  correctAnswer: string
  difficulty?: string
  imageUrl?: string
}

type ParsedCSVRow = Record<string, string | undefined>

const HEADER_ALIASES: Record<string, keyof CSVQuestion> = {
  text: 'text',
  category: 'category',
  option1: 'option1',
  option2: 'option2',
  option3: 'option3',
  option4: 'option4',
  correctanswer: 'correctAnswer',
  difficulty: 'difficulty',
  imageurl: 'imageUrl',
}

const CATEGORY_ALIASES: Record<string, Question['category']> = {
  formulas: 'Formulas',
  shortcuts: 'Shortcuts',
  charts: 'Charts',
  dataanalysis: 'DataAnalysis',
  formatting: 'Formatting',
  advancedformulas: 'Advanced Formulas',
  advancedcharts: 'Advanced Charts',
  advancedfiltering: 'Advanced Filtering',
  advancedlookup: 'Advanced Lookup',
  advancedpivottables: 'Advanced PivotTables',
  advancedsorting: 'Advanced Sorting',
  advancedvisualization: 'Advanced Visualization',
  arithmeticfunctions: 'Arithmetic Functions',
  arrayformulas: 'Array Formulas',
  autofillandflashfill: 'Autofill and Flash Fill',
  chartelements: 'Chart Elements',
  conditionalfuctions: 'Conditional Functions',
  dashboards: 'Dashboards',
  dataanalysistools: 'Data Analysis Tools',
  dataconsolidation: 'Data Consolidation',
  datatools: 'Data Tools',
  dataentry: 'Data Entry',
  dataselectionstrategies: 'Data Selection Strategies',
  datavalidation: 'Data Validation',
  datefunctions: 'Date Functions',
  dynamicarrays: 'Dynamic Arrays',
  dynamicarrayfunctions: 'Dynamic Array Functions',
  excelbasics: 'Excel Basics',
  excelinterface: 'Excel Interface',
  exceltables: 'Excel Tables',
  financialfunctions: 'Financial Functions',
  findandreplace: 'Find and Replace',
  freezepanes: 'Freeze Panes',
  functions: 'Functions',
  informationfunctions: 'Information Functions',
  logicalfunctions: 'Logical Functions',
  lookupfunctions: 'Lookup Functions',
  macros: 'Macros',
  mathfunctions: 'Math Functions',
  modernfunctions: 'Modern Functions',
  namedranges: 'Named Ranges',
  pastespecial: 'Paste Special',
  pivotcharts: 'PivotCharts',
  pivottables: 'PivotTables',
  powerquery: 'Power Query',
  powerpivot: 'Power Pivot',
  printing: 'Printing',
  statisticalfunctions: 'Statistical Functions',
  subtotalsandgrouping: 'Subtotals and Grouping',
  textfunctions: 'Text Functions',
  viewtools: 'View Tools',
  powerfunctions: 'Power Functions',
  conditionalformatting: 'Conditional Formatting',
  statisticalanalysis: 'Statistical Analysis',
  macrosandvba: 'Macros and VBA',
  collaboration: 'Collaboration',
  workbooksecurity: 'Workbook Security',
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function createQuestionSignature(input: Pick<Question, 'text' | 'category'>): string {
  return `${input.category.toLowerCase()}::${normalizeQuestionText(input.text)}`
}

function toCanonicalHeader(header: string): string {
  const normalized = normalizeHeader(header)
  return HEADER_ALIASES[normalized] ?? normalized
}

function getField(row: ParsedCSVRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string') {
      return value.trim()
    }
  }
  return ''
}

function mapRowToCSVQuestion(row: ParsedCSVRow): CSVQuestion {
  return {
    text: getField(row, 'text'),
    category: getField(row, 'category') || 'Formulas',
    option1: getField(row, 'option1'),
    option2: getField(row, 'option2'),
    option3: getField(row, 'option3'),
    option4: getField(row, 'option4'),
    correctAnswer: getField(row, 'correctAnswer', 'correctanswer') || '0',
    difficulty: getField(row, 'difficulty') || '3',
    imageUrl: getField(row, 'imageUrl', 'imageurl'),
  }
}

function isEmptyCSVQuestion(question: CSVQuestion): boolean {
  return [
    question.text,
    question.category,
    question.option1,
    question.option2,
    question.option3,
    question.option4,
    question.correctAnswer,
    question.difficulty || '',
    question.imageUrl || '',
  ].every((value) => value.trim() === '')
}

export function normalizeCategory(category: string): Question['category'] | null {
  const normalized = category.replace(/"/g, '').trim().toLowerCase().replace(/\s+/g, '')
  return CATEGORY_ALIASES[normalized] ?? null
}

export function parseCSVText(content: string): Promise<CSVQuestion[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<ParsedCSVRow>(content, {
      header: true,
      skipEmptyLines: 'greedy',
      comments: '#',
      transformHeader: toCanonicalHeader,
      complete: (results) => {
        if (results.errors.length > 0) {
          const parseErrors = results.errors
            .map((error) => `Row ${error.row ?? 'unknown'}: ${error.message}`)
            .join(' | ')
          reject(new Error(`CSV parse error. ${parseErrors}`))
          return
        }

        const questions = results.data
          .map(mapRowToCSVQuestion)
          .filter((question) => !isEmptyCSVQuestion(question))

        resolve(questions)
      },
      error: (error: Error) => {
        reject(new Error(`Failed to read CSV file. ${error.message}`))
      },
    })
  })
}

export async function parseCSVFile(file: File): Promise<CSVQuestion[]> {
  const content = await file.text()
  return parseCSVText(content)
}

export function validateCSVQuestions(questions: CSVQuestion[]): { valid: Question[]; invalid: string[] } {
  const valid: Question[] = []
  const invalid: string[] = []
  const seenSignatures = new Set<string>()

  questions.forEach((question, index) => {
    const errors: string[] = []

    if (!question.text.trim()) {
      errors.push('Missing question text')
    }

    const normalizedCategory = normalizeCategory(question.category)
    if (!normalizedCategory) {
      errors.push('Invalid category')
    }

    const options = [question.option1, question.option2, question.option3, question.option4]
      .map((option) => option.trim())
      .filter(Boolean)

    if (!question.option1.trim() || !question.option2.trim()) {
      errors.push('option1 and option2 are required')
    }

    if (options.length < 2) {
      errors.push('Need at least 2 options')
    }

    const correctAnswerIndex = parseInt(question.correctAnswer, 10)
    if (Number.isNaN(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex > 3) {
      errors.push('Invalid correct answer index')
    } else if (correctAnswerIndex >= options.length) {
      errors.push('Correct answer points to a missing option')
    }

    const difficulty = parseInt(question.difficulty || '3', 10)
    if (Number.isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
      errors.push('Invalid difficulty')
    }

    if (errors.length > 0 || !normalizedCategory) {
      invalid.push(`Row ${index + 1}: ${errors.join(', ')}`)
      return
    }

    const candidateQuestion: Question = {
      id: `csv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      text: question.text.trim(),
      category: normalizedCategory,
      options,
      correctAnswer: correctAnswerIndex,
      difficulty: difficulty as Question['difficulty'],
      imageUrl: question.imageUrl?.trim() || undefined,
    }

    const signature = createQuestionSignature(candidateQuestion)
    if (seenSignatures.has(signature)) {
      invalid.push(`Row ${index + 1}: Duplicate question text in the same category`)
      return
    }

    seenSignatures.add(signature)
    valid.push(candidateQuestion)
  })

  return { valid, invalid }
}

export function generateSampleCSV(): string {
  return `text,category,option1,option2,option3,option4,correctAnswer,difficulty,imageUrl
"What does the SUM function do?","Formulas","Adds values in a range","Multiplies values","Subtracts values","Divides values","0","1",""
"Which shortcut creates an absolute reference?","Shortcuts","F4","F2","Ctrl+A","Alt+Enter","0","1",""
"What chart type shows trends over time?","Charts","Line Chart","Pie Chart","Bar Chart","Scatter Plot","0","1",""
"What does VLOOKUP search for?","Formulas","Value in first column","Value in last column","Value in any column","Value in header","0","2",""
"How to insert a new row?","Shortcuts","Ctrl+Shift++","Ctrl+Shift+-","Ctrl+R","Ctrl+I","0","1",""`
}

export function generateSampleCSVWithHeaders(): string {
  return `# Excel Quiz CSV Import Template
# 
# COLUMN REQUIREMENTS:
# - text: The question text (required)
# - category: Question category (required) - Options: Formulas, Shortcuts, Charts, DataAnalysis, Formatting, Advanced Formulas, Advanced Charts, Advanced Filtering, Advanced Lookup, Advanced PivotTables, Advanced Sorting, Advanced Visualization, Arithmetic Functions, Array Formulas, Autofill and Flash Fill, Chart Elements, Conditional Functions, Dashboards, Data Analysis Tools, Data Consolidation, Data Tools, Data Entry, Data Selection Strategies, Data Validation, Date Functions, Dynamic Arrays, Dynamic Array Functions, Excel Basics, Excel Interface, Excel Tables, Financial Functions, Find & Replace, Freeze Panes, Functions, Information Functions, Logical Functions, Lookup Functions, Macros, Math Functions, Modern Functions, Named Ranges, Paste Special, PivotCharts, PivotTables, Power Query, Power Pivot, Printing, Statistical Functions, Subtotals and Grouping, Text Functions, View Tools, Power Functions, Conditional Formatting, Statistical Analysis, Macros and VBA, Collaboration, Workbook Security
# - option1-4: Answer options (required) - At least 2 options needed
# - correctAnswer: Index of correct answer (required) - 0=option1, 1=option2, 2=option3, 3=option4
# - difficulty: Difficulty level (optional) - 1=easy, 5=hard
# - imageUrl: Optional image URL for the question
#
# EXAMPLE:
# "What does SUM do?","Formulas","Adds values","Multiplies","Subtracts","Divides","0","1",""

text,category,option1,option2,option3,option4,correctAnswer,difficulty,imageUrl
"What does the SUM function do?","Formulas","Adds values in a range","Multiplies values","Subtracts values","Divides values","0","1",""
"Which shortcut creates an absolute reference?","Shortcuts","F4","F2","Ctrl+A","Alt+Enter","0","1",""
"What chart type shows trends over time?","Charts","Line Chart","Pie Chart","Bar Chart","Scatter Plot","0","1",""
"What does VLOOKUP search for?","Formulas","Value in first column","Value in last column","Value in any column","Value in header","0","2",""
"How to insert a new row?","Shortcuts","Ctrl+Shift++","Ctrl+Shift+-","Ctrl+R","Ctrl+I","0","1",""`
}

export function downloadSampleCSV(): void {
  const csvContent = generateSampleCSVWithHeaders()
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'excel-quiz-sample.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadImportErrorsCSV(errors: string[]): void {
  const escapeCSV = (value: string) => `"${value.replace(/"/g, '""')}"`
  const rows = ['row,error']

  errors.forEach((error) => {
    const match = error.match(/^Row\s+(\d+):\s*(.*)$/i)
    const rowValue = match?.[1] ?? ''
    const message = match?.[2] ?? error
    rows.push(`${escapeCSV(rowValue)},${escapeCSV(message)}`)
  })

  const csvContent = rows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'csv-import-failed-rows.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function mapImportError(question: Question, error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return `Failed to import question "${question.text}" - Signed in but not admin`
    }

    if (error.code === 'unauthenticated') {
      return `Failed to import question "${question.text}" - Please sign in with Google`
    }
  }

  return `Failed to import question "${question.text}" - ${error instanceof Error ? error.message : 'Unknown error'}`
}

export async function importQuestionsToFirestore(
  questions: Question[]
): Promise<{ success: boolean; importedCount: number; failedCount: number; errors: string[] }> {
  const errors: string[] = []
  let importedCount = 0

  try {
    const { db } = await import('./firebase')

    const validQuestions = questions.filter(
      (question) =>
        question.text.trim() &&
        question.category &&
        question.options.length >= 2 &&
        question.correctAnswer >= 0 &&
        question.correctAnswer < question.options.length
    )

    if (validQuestions.length === 0) {
      return {
        success: false,
        importedCount: 0,
        failedCount: questions.length,
        errors: ['No valid questions to import'],
      }
    }

    // Process in smaller batches for better performance
    const batchSize = 5
    console.log(`Starting import of ${validQuestions.length} questions in batches of ${batchSize}`)

    for (let i = 0; i < validQuestions.length; i += batchSize) {
      const batchQuestions = validQuestions.slice(i, i + batchSize)
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(validQuestions.length/batchSize)}`)

      const batchResults = await Promise.all(
        batchQuestions.map(async (question, index) => {
          try {
            const questionData: Record<string, unknown> = {
              text: question.text,
              category: question.category,
              options: question.options,
              correctAnswer: question.correctAnswer,
              difficulty: question.difficulty,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              status: 'active',
            }

            if (question.imageUrl) {
              questionData.imageUrl = question.imageUrl
            }

            await addDoc(collection(db, 'questions'), questionData)
            console.log(`Successfully imported question ${i + index + 1}: ${question.text.substring(0, 50)}...`)
            return true
          } catch (error) {
            console.error(`Error importing question ${i + index + 1}:`, question.text, error)
            errors.push(mapImportError(question, error))
            return false
          }
        })
      )

      importedCount += batchResults.filter(Boolean).length
      
      // Add small delay between batches to prevent overwhelming the server
      if (i + batchSize < validQuestions.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`Import completed: ${importedCount} successful, ${validQuestions.length - importedCount} failed`)
    return {
      success: importedCount > 0,
      importedCount,
      failedCount: validQuestions.length - importedCount,
      errors,
    }
  } catch (error) {
    console.error('Error importing questions:', error)
    return {
      success: false,
      importedCount: 0,
      failedCount: questions.length,
      errors: [
        `Failed to import questions to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    }
  }
}
