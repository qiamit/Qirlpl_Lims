import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { MaintenanceForm, MaintenanceType } from './types'

export function MaintenanceMasterForm({
  form,
  onChange,
  onSave,
  onClear,
  canSave,
  saveLoading,
  equipmentOptions,
}: {
  form: MaintenanceForm
  onChange: (next: MaintenanceForm) => void
  onSave: () => void
  onClear: () => void
  canSave: boolean
  saveLoading: boolean
  equipmentOptions: Array<{ id: string; label: string }>
}) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Equipment</Label>
            <Select value={form.equipmentId || ''} onValueChange={(v) => onChange({ ...form, equipmentId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipmentOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Maintenance Type</Label>
            <Select value={form.maintenanceType} onValueChange={(v) => onChange({ ...form, maintenanceType: v as MaintenanceType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Preventive">Preventive</SelectItem>
                <SelectItem value="Corrective">Corrective</SelectItem>
                <SelectItem value="Predictive">Predictive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Schedule Frequency</Label>
            <Input
              value={form.scheduleFrequency}
              onChange={(e) => onChange({ ...form, scheduleFrequency: e.target.value })}
              placeholder="e.g. Monthly, Quarterly"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Input
              value={form.status}
              onChange={(e) => onChange({ ...form, status: e.target.value })}
              placeholder="e.g. Scheduled, Completed"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Last Maintenance Date</Label>
            <Input
              type="date"
              value={form.lastMaintenanceDate}
              onChange={(e) => onChange({ ...form, lastMaintenanceDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Next Maintenance Date</Label>
            <Input
              type="date"
              value={form.nextMaintenanceDate}
              onChange={(e) => onChange({ ...form, nextMaintenanceDate: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description / Activity</Label>
          <Textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Description of maintenance activity"
          />
        </div>
        <div className="space-y-2">
          <Label>Performed By</Label>
          <Input
            value={form.performedBy}
            onChange={(e) => onChange({ ...form, performedBy: e.target.value })}
            placeholder="Name of person"
          />
        </div>
        <div className="space-y-2">
          <Label>Remarks</Label>
          <Textarea value={form.remarks} onChange={(e) => onChange({ ...form, remarks: e.target.value })} rows={2} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2 hover:bg-primary/90 disabled:opacity-50"
            onClick={onSave}
            disabled={!canSave || saveLoading}
          >
            {saveLoading ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background h-10 px-4 py-2 hover:bg-accent"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
