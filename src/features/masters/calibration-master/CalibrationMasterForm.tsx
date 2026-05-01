import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isValidNumberOrEmpty, type CalibrationForm } from './types'

export function CalibrationMasterForm({
  form,
  onChange,
  canSave,
  saveLoading,
  onSave,
  onClear,
  equipmentOptions,
  calibrationAgencies,
  onPickFiles,
  onOpenFiles,
}: {
  form: CalibrationForm
  onChange: (next: CalibrationForm) => void
  canSave: boolean
  saveLoading: boolean
  onSave: () => void
  onClear: () => void
  equipmentOptions: Array<{ id: string; label: string }>
  calibrationAgencies: Array<{ id: string; label: string }>
  onPickFiles: (files: File[]) => void
  onOpenFiles: () => void
}) {
  const uncError = isValidNumberOrEmpty(form.uncertainty) ? null : 'Uncertainity must be a number'

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        {uncError && <p className="text-sm text-destructive">{uncError}</p>}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Equipment Reference (Name + Range)</Label>
            <Select value={form.equipmentId} onValueChange={(v) => onChange({ ...form, equipmentId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipmentOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Calibration Required</Label>
            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => onChange({ ...form, required: e.target.checked })}
                aria-label="Calibration required"
              />
              <span className="text-sm text-muted-foreground">{form.required ? 'Required' : 'Not Required'}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Calibration Date</Label>
            <Input type="date" value={form.calibrationDate} onChange={(e) => onChange({ ...form, calibrationDate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => onChange({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Certificate Number</Label>
            <Input value={form.certificateNumber} onChange={(e) => onChange({ ...form, certificateNumber: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Uncertainity (MU) %</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">±</span>
              <Input
                value={form.uncertainty}
                onChange={(e) => onChange({ ...form, uncertainty: e.target.value })}
                className="pl-8 pr-10"
                placeholder="0.60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <Label>Calibration Agency</Label>
            <Select value={form.calibrationAgency} onValueChange={(v) => onChange({ ...form, calibrationAgency: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select agency" />
              </SelectTrigger>
              <SelectContent>
                {calibrationAgencies.map((a) => (
                  <SelectItem key={a.id} value={a.label}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => onChange({ ...form, remarks: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between h-5">
              <Label>Calibration Certificate</Label>
              <button
                type="button"
                className="text-[11px] font-medium text-primary flex items-center gap-1 hover:underline"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.onchange = () => {
                    const list = Array.from(input.files ?? [])
                    onPickFiles(list)
                  }
                  input.click()
                }}
              >
                <Plus size={12} />
                Add
              </button>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={onOpenFiles}>
              View Files
            </Button>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <div className="w-full flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClear} disabled={saveLoading}>
            Clear
          </Button>
          <Button type="button" onClick={onSave} disabled={!canSave}>
            {saveLoading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
