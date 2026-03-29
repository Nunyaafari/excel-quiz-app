export type SiteResource = {
  id: string
  title: string
  description: string
  href: string
  typeLabel: string
}

export const freeExcelResources: SiteResource[] = [
  {
    id: 'excel-cheatsheet',
    title: 'ATI Excel Cheat Sheet',
    description: 'A branded quick-reference PDF packed with practical shortcuts and everyday worksheet actions.',
    href: '/resources/excelcheatsheet-ati.pdf',
    typeLabel: 'PDF Guide',
  },
  {
    id: 'budget-template-pack',
    title: 'ATI Budget Template Pack',
    description: 'An Excel workbook template pack for budgeting, planning, and simple reporting workflows.',
    href: '/resources/free-excel-budget-template-pack-ati.xlsx',
    typeLabel: 'Excel Template',
  },
]

export const freeExcelResourceHub = {
  href: '/resources',
  label: 'Browse Free Resources',
}

export function buildTrainingModulePdfPath(programId: string) {
  return `/api/training-module-pdf/${programId}`
}
