export type CheckResult = 'Pass' | 'Fail'

export type IntermediateCheckRow = {
  id: string
  equipment_id: string
  equipment_name: string | null
  equipment_range: string | null
  check_date: string | null
  next_check_date: string | null
  result: CheckResult | null
  reference_standard: string | null
  performed_by: string | null
  remarks: string | null
  created_at?: string
}

export type IntermediateCheckForm = {
  equipmentId: string
  checkDate: string
  nextCheckDate: string
  result: CheckResult
  referenceStandard: string
  performedBy: string
  remarks: string
}

export const emptyIntermediateCheckForm = (): IntermediateCheckForm => ({
  equipmentId: '',
  checkDate: '',
  nextCheckDate: '',
  result: 'Pass',
  referenceStandard: '',
  performedBy: '',
  remarks: '',
})

export const normalizeText = (value: string) => value.trim()
