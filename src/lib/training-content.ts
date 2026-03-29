export type TrainingProgram = {
  id: string
  title: string
  duration: string
  objectives: string[]
  outline: string[]
  description: string
}

export const trainingPrograms: TrainingProgram[] = [
  {
    id: 'program-remote',
    title: 'Microsoft Excel Foundation',
    duration: '6 hrs total',
    objectives: [
      'Provide participants with a foundational understanding of Excel.',
      'Teach participants how to create, format, and manipulate Excel worksheets.',
      'Introduce basic Excel functions and formulas.',
      'Enable participants to confidently use Excel for common tasks.',
    ],
    outline: [
      'Module 1: Introduction to Excel - Overview of Excel, interface, navigating worksheets, creating and opening workbooks.',
      'Module 2: Data Entry and Formatting - Entering and editing data, formatting fonts and borders, alignment, wrapping, fill colors, and shading.',
      'Module 3: Cell Functions and Formulas - Functions vs formulas, SUM, AVERAGE, COUNT, basic arithmetic formulas, relative vs absolute references.',
      'Module 4: Data Management - Sorting, filtering, removing duplicates, and data validation rules.',
      'Module 5: Charts and Graphs - Creating charts, formatting and customizing charts, adding data labels, inserting charts into worksheets.',
      'Module 6: Printing and Sharing - Preparing worksheets for printing, page setup, print preview, sharing, and exporting files.',
      'Module 7: Recap and Q&A - Review of key concepts, clarification, and assessment.',
    ],
    description:
      'Designed for beginners who need a structured path to confident, accurate Excel work.',
  },
  {
    id: 'program-onsite',
    title: 'Intermediate Excel Training',
    duration: '6 hrs total',
    objectives: [
      'Build on foundational Excel skills with stronger data analysis capability.',
      'Develop confidence with advanced formulas, automation, and reporting.',
      'Handle more complex spreadsheet and consolidation tasks efficiently.',
      'Use Excel features that support faster analysis and clearer presentation.',
    ],
    outline: [
      'Session 1: Excel Hacks and Techniques - Data selection strategies, Autofill and Flash Fill, Find & Replace, Named Ranges, Paste Special.',
      'Session 2: Exploring Advanced Formulas and Functions - IF, AND, OR, VLOOKUP, HLOOKUP, ROUND, MOD, text functions, SUMIF, AVERAGEIF, COUNTIF, date functions, MEDIAN, RANK, LARGE.',
      'Session 3: Data Consolidation and Data Tables - Subtotals and grouping, Freeze Panes, consolidating data from multiple worksheets, creating Excel tables.',
      'Session 4: Advanced Charting and Graphical Data Presentation - Advanced chart types, combining charts, dynamic titles and labels, chart elements.',
      'Session 6: PivotTables and PivotCharts - Introduction to PivotTables, creating PivotTables from large datasets, formatting PivotTables, creating PivotCharts.',
      'Session 7: Module Conclusion and Q&A - Recap of key learnings, participant questions, clarification, and assessment.',
    ],
    description:
      'A practical module for analysts and coordinators who already use Excel regularly and need stronger automation skills.',
  },
  {
    id: 'program-offsite',
    title: 'Advanced Excel Training',
    duration: '6 hrs total',
    objectives: [
      'Become proficient in advanced techniques for data analysis and automation.',
      'Strengthen complex modeling, advanced visualization, and business analysis skills.',
      'Use advanced Excel tools for decision support and interactive reporting.',
      'Introduce automation with Macros, VBA, and Power Pivot.',
    ],
    outline: [
      'Session 1: Advanced Formulas and Functions - Array formulas, INDEX and MATCH, financial functions, ISERROR, IFERROR, XLOOKUP, VSTACK, CHOOSE, SEQUENCE, RAND, RANDBETWEEN, AGGREGATE, TRANSPOSE.',
      'Session 2: Advanced PivotTables and PivotCharts - Calculated fields and items, custom measures, interactive dashboards with PivotCharts.',
      'Session 3: Data Validation and Advanced Filtering Mastery - Tailored validation rules, dropdown lists, advanced sorting, advanced filtering.',
      'Session 4: Conditional Formatting - Applying conditional formatting rules and creating custom formatting logic.',
      'Session 5: Advanced Data Visualization - Advanced chart customization, combo charts, waterfall charts, sparklines, and data bars.',
      'Session 6: Advanced Data Analysis Techniques - Scenario Manager, Goal Seek, Solver, Data Tables, VAR, STDEV.P.',
      'Session 6: Automation with Macros and VBA - Introduction to Macros, recording and editing Macros.',
      'Session 6: Power Pivot - Introduction to Power Pivot and creating relationships between tables.',
      'Session 7: Advanced Workbook Management and Collaboration - Excel Online collaboration and protecting workbooks with advanced security settings.',
      'Session 8: Module Conclusion and Q&A - Recap, participant clarification, and assessment.',
    ],
    description:
      'For power users and analysts who need advanced modeling, automation, and visualization capabilities.',
  },
]

export function getTrainingProgramById(programId: string) {
  return trainingPrograms.find((program) => program.id === programId) ?? null
}
