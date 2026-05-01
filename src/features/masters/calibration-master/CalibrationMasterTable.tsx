import { Copy, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import type { CalibrationRow, CalibrationStatus } from './types'

export function CalibrationMasterTable({
  rows,
  loading,
  error,
  selectedIds,
  onToggle,
  onToggleAll,
  onEdit,
  onCopy,
  getStatus,
  onOpenFiles,
}: {
  rows: CalibrationRow[]
  loading: boolean
  error: string | null
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (row: CalibrationRow) => void
  onCopy: (row: CalibrationRow) => void
  getStatus: (row: CalibrationRow) => CalibrationStatus
  onOpenFiles: (row: CalibrationRow) => void
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someChecked = rows.some((r) => selectedIds.has(r.id))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {error && <p className="px-4 pt-4 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No calibration records added yet.</p>
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
              <TableHead className="text-xs">Equipment</TableHead>
              <TableHead className="text-xs text-center">Dates</TableHead>
              <TableHead className="text-xs text-center">Certificate</TableHead>
              <TableHead className="text-xs text-center">Agency &amp; MU</TableHead>
              <TableHead className="text-xs text-center">Status / Files</TableHead>
              <TableHead className="text-xs text-center w-[96px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const status = getStatus(r)
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.id}`}
                      checked={selectedIds.has(r.id)}
                      onChange={() => onToggle(r.id)}
                    />
                  </TableCell>

                  <TableCell className="break-words whitespace-normal">
                    <div className="font-medium">{r.equipment_name || '-'}</div>
                    <div className="text-xs text-muted-foreground">Range: {r.equipment_range || '-'}</div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="text-xs">Cal: {r.calibration_date || '-'}</div>
                    <div className="text-xs text-muted-foreground">Due: {r.due_date || '-'}</div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="text-xs">{r.certificate_number || '-'}</div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="text-xs">{r.calibration_agency || '-'}</div>
                    <div className="text-xs text-muted-foreground">MU: {typeof r.uncertainty === 'number' ? `± ${r.uncertainty.toFixed(2)} %` : '-'}</div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="text-xs">{status}</div>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => onOpenFiles(r)}
                    >
                      View Files
                    </button>
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
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
