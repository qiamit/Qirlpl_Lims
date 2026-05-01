export type MaintenanceType = 'Preventive' | 'Corrective' | 'Predictive'

export type MaintenanceRow = {
  id: string
  equipment_id: string
  equipment_name: string | null
  equipment_range: string | null
  maintenance_type: MaintenanceType | null
  schedule_frequency: string | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  description: string | null
  performed_by: string | null
  status: string | null
  remarks: string | null
  created_at?: string
}

export type MaintenanceForm = {
  equipmentId: string
  maintenanceType: MaintenanceType
  scheduleFrequency: string
  lastMaintenanceDate: string
  nextMaintenanceDate: string
  description: string
  performedBy: string
  status: string
  remarks: string
}

export const emptyMaintenanceForm = (): MaintenanceForm => ({
  equipmentId: '',
  maintenanceType: 'Preventive',
  scheduleFrequency: '',
  lastMaintenanceDate: '',
  nextMaintenanceDate: '',
  description: '',
  performedBy: '',
  status: 'Scheduled',
  remarks: '',
})

export const normalizeText = (value: string) => value.trim()
