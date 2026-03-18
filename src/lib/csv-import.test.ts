import { describe, expect, it } from 'vitest'
import { parseCSVText, validateCSVQuestions } from './csv-import'

describe('parseCSVText', () => {
  it('parses comments, quoted commas, and header aliases', async () => {
    const csv = `# template comment
# another comment
text,category,option1,option2,option3,option4,correct answer,difficulty,image url
"What does SUM do, in Excel?","Formulas","Adds values","Subtracts values","Multiplies values","Divides values","0","2","https://example.com/sum.png"`

    const parsed = await parseCSVText(csv)

    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      text: 'What does SUM do, in Excel?',
      category: 'Formulas',
      option1: 'Adds values',
      correctAnswer: '0',
      difficulty: '2',
      imageUrl: 'https://example.com/sum.png',
    })
  })
})

describe('validateCSVQuestions', () => {
  it('flags invalid rows and keeps valid ones', () => {
    const result = validateCSVQuestions([
      {
        text: 'Valid question?',
        category: 'Formulas',
        option1: 'Yes',
        option2: 'No',
        option3: '',
        option4: '',
        correctAnswer: '0',
        difficulty: '3',
      },
      {
        text: '',
        category: 'UnknownCategory',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correctAnswer: '9',
        difficulty: '10',
      },
    ])

    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toHaveLength(1)
    expect(result.invalid[0]).toContain('Missing question text')
    expect(result.invalid[0]).toContain('Invalid category')
  })

  it('marks duplicate question text in same category as invalid', () => {
    const result = validateCSVQuestions([
      {
        text: 'What does SUM do?',
        category: 'Formulas',
        option1: 'Adds',
        option2: 'Subtracts',
        option3: '',
        option4: '',
        correctAnswer: '0',
        difficulty: '1',
      },
      {
        text: '  what   does sum do? ',
        category: 'Formulas',
        option1: 'Adds',
        option2: 'Subtracts',
        option3: '',
        option4: '',
        correctAnswer: '0',
        difficulty: '1',
      },
    ])

    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toHaveLength(1)
    expect(result.invalid[0]).toContain('Duplicate question text in the same category')
  })
})
