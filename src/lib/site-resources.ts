export type SiteResource = {
  id: string
  title: string
  description: string
  fileName: string
  typeLabel: string
}

export const freeExcelResources: SiteResource[] = [
  {
    id: 'excel-cheatsheet',
    title: 'ATI Excel Cheat Sheet',
    description: 'A branded quick-reference PDF packed with practical shortcuts and everyday worksheet actions.',
    fileName: 'excelcheatsheet-ati.pdf',
    typeLabel: 'PDF Guide',
  },
  {
    id: 'budget-template-pack',
    title: 'ATI Budget Template Pack',
    description: 'An Excel workbook template pack for budgeting, planning, and simple reporting workflows.',
    fileName: 'free-excel-budget-template-pack-ati.xlsx',
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

export function getSiteResourceById(resourceId: string) {
  return freeExcelResources.find((resource) => resource.id === resourceId) ?? null
}

export function buildSiteResourceDownloadPath(resourceId: string) {
  return `/api/resources/${resourceId}/download`
}
