export type CalibrationStatus = 'Valid' | 'Due' | 'Over Due' | 'Not Required'

export type CalibrationRow = {
  id: string
  equipment_id: string
  equipment_name: string | null
  equipment_range: string | null
  calibration_date: string | null
  due_date: string | null
  certificate_number: string | null
  calibration_agency: string | null
  uncertainty: number | null
  is_required: boolean | null
  remarks: string | null
  created_at?: string
}

export type CalibrationForm = {
  equipmentId: string
  calibrationDate: string
  dueDate: string
  certificateNumber: string
  calibrationAgency: string
  uncertainty: string
  required: boolean
  remarks: string
  files: File[]
}

export const emptyCalibrationForm = (): CalibrationForm => ({
  equipmentId: '',
  calibrationDate: '',
  dueDate: '',
  certificateNumber: '',
  calibrationAgency: '',
  uncertainty: '',
  required: true,
  remarks: '',
  files: [],
})

export const normalizeText = (value: string) => value.trim()

export const isValidNumberOrEmpty = (value: string) => {
  const v = value.trim()
  if (!v) return true
  const n = Number(v)
  return Number.isFinite(n)
}

export const computeCalibrationStatus = ({
  required,
  dueDate,
  thresholdDays,
}: {
  required: boolean
  dueDate: string | null | undefined
  thresholdDays: number
}): CalibrationStatus => {
  if (!required) return 'Not Required'
  if (!dueDate || !dueDate.trim()) return 'Not Required'

  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return 'Not Required'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = due.getTime() - startOfToday.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Over Due'
  if (diffDays <= thresholdDays) return 'Due'
  return 'Valid'
}
