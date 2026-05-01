import { Copy, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import type { IntermediateCheckRow } from './types'

const fmtDate = (v: string | null | undefined) => (v && v.trim() ? v : '-')

export function IntermediateChecksTable({
  rows,
  loading,
  error,
  selectedIds,
  onToggle,
  onToggleAll,
  onEdit,
  onCopy,
}: {
  rows: IntermediateCheckRow[]
  loading: boolean
  error: string | null
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (row: IntermediateCheckRow) => void
  onCopy: (row: IntermediateCheckRow) => void
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someChecked = rows.some((r) => selectedIds.has(r.id))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {error && <p className="px-4 pt-4 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No intermediate checks added yet.</p>
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
              <TableHead className="text-xs text-center">Check Date</TableHead>
              <TableHead className="text-xs text-center">Next Check Date</TableHead>
              <TableHead className="text-xs text-center">Result</TableHead>
              <TableHead className="text-xs text-center">Performed By</TableHead>
              <TableHead className="text-xs text-center w-[96px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.equipment_name ?? r.id}`}
                    checked={selectedIds.has(r.id)}
                    onChange={() => onToggle(r.id)}
                  />
                </TableCell>
                <TableCell className="break-words whitespace-normal">
                  <div className="font-medium">{r.equipment_name ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">{r.equipment_range ?? '-'}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="text-xs">{fmtDate(r.check_date)}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="text-xs">{fmtDate(r.next_check_date)}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="text-xs">{r.result ?? '-'}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="text-xs">{r.performed_by ?? '-'}</div>
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
