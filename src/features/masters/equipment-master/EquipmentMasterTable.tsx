import { Copy, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import type { EquipmentRow } from './types'

const fmtDate = (v: string | null | undefined) => {
  if (!v) return '-'
  return v
}

const fmtMu = (v: number | null | undefined) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return `± ${v.toFixed(2)} %`
}

export function EquipmentMasterTable({
  rows,
  loading,
  error,
  selectedIds,
  onToggle,
  onToggleAll,
  onEdit,
  onCopy,
  calibrationStatusByEquipmentId,
}: {
  rows: EquipmentRow[]
  loading: boolean
  error: string | null
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (row: EquipmentRow) => void
  onCopy: (row: EquipmentRow) => void
  calibrationStatusByEquipmentId: Record<string, string>
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someChecked = rows.some((r) => selectedIds.has(r.id))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {error && <p className="px-4 pt-4 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No equipment added yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs w-[44px] text-center">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = !allChecked && someChecked
                  }}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </TableHead>
              <TableHead className="text-xs">Name of the Equipment</TableHead>
              <TableHead className="text-xs text-center">Least Count &amp; Range</TableHead>
              <TableHead className="text-xs text-center">Make &amp; Model</TableHead>
              <TableHead className="text-xs text-center">Uncertainty &amp; Acceptance Criteria</TableHead>
              <TableHead className="text-xs text-center">Activity</TableHead>
              <TableHead className="text-xs text-center w-[96px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.equipment_name}`}
                    checked={selectedIds.has(r.id)}
                    onChange={() => onToggle(r.id)}
                  />
                </TableCell>

                <TableCell className="break-words whitespace-normal">
                  <div className="font-medium">{r.equipment_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.equipment_code} &nbsp;|&nbsp; {r.status} &nbsp;|&nbsp; DOP: {fmtDate(r.placed_date)}
                  </div>
                </TableCell>

                <TableCell className="text-center">
                  <div className="text-xs">Least Count - <span className="text-muted-foreground">{r.least_count || '-'}</span></div>
                  <div className="text-xs">Range - <span className="text-muted-foreground">{r.range_of_instrument || '-'}</span></div>
                </TableCell>

                <TableCell className="text-center">
                  <div className="text-xs">Make - <span className="text-muted-foreground">{r.make || '-'}</span></div>
                  <div className="text-xs">Model - <span className="text-muted-foreground">{r.model_serial_no || '-'}</span></div>
                </TableCell>

                <TableCell className="text-center">
                  <div className="text-xs">Uncertainty - <span className="text-muted-foreground">{fmtMu(r.uncertainty_mu)}</span></div>
                  <div className="text-xs">Acceptance Criteria - <span className="text-muted-foreground">{fmtMu(r.acceptance_criteria)}</span></div>
                </TableCell>

                <TableCell className="text-center">
                  <div className="text-xs">
                    <a className="underline" href={`/equipment/calibration-master?equipmentId=${encodeURIComponent(r.id)}`}>
                      Calibration Status - {calibrationStatusByEquipmentId[r.id] ?? 'Not Required'}
                    </a>
                  </div>
                  <div className="text-xs">
                    {r.calibration_link ? (
                      <a className="underline" href={r.calibration_link} target="_blank" rel="noreferrer">
                        Calibration Link
                      </a>
                    ) : (
                      '-'
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.intermediate_link ? (
                      <a className="underline" href={r.intermediate_link} target="_blank" rel="noreferrer">
                        Intermediate Link
                      </a>
                    ) : (
                      '-'
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button type="button" size="icon" variant="ghost" aria-label="Edit" onClick={() => onEdit(r)}>
                      <Pencil size={16} />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Copy" onClick={() => onCopy(r)}>
                      <Copy size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
