import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IntermediateChecksHeaderBar } from './IntermediateChecksHeaderBar'
import { IntermediateChecksForm } from './IntermediateChecksForm'
import { IntermediateChecksTable } from './IntermediateChecksTable'
import { IntermediateChecksTableFooterBar } from './IntermediateChecksFooterBar'
import {
  emptyIntermediateCheckForm,
  normalizeText,
  type IntermediateCheckRow,
  type IntermediateCheckForm as FormType,
  type CheckResult,
} from './types'

const formatSupabaseError = (err: unknown) => {
  if (!err || typeof err !== 'object') return 'Unknown error'
  const anyErr = err as { message?: string; details?: string; hint?: string; code?: string }
  const parts = [anyErr.message, anyErr.details, anyErr.hint, anyErr.code].filter(Boolean)
  return parts.length ? parts.join(' | ') : 'Unknown error'
}

function toCsv(headers: string[], rows: Array<Record<string, string>>) {
  const esc = (v: string) => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(esc).join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h] ?? '')).join(','))
  }
  return lines.join('\n')
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const flushCell = () => {
    row.push(cell)
    cell = ''
  }
  const flushRow = () => {
    flushCell()
    rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      flushCell()
      continue
    }
    if (ch === '\n') {
      flushRow()
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell.length > 0 || row.length > 0) flushRow()
  return rows.map((r) => r.map((c) => c.trim()))
}

type DbRow = {
  id: string
  equipment_id: string
  check_date: string | null
  next_check_date: string | null
  result: string | null
  reference_standard: string | null
  performed_by: string | null
  remarks: string | null
  created_at?: string
  equipment_master?: { equipment_name: string | null; range_of_instrument: string | null } | null
}

export default function IntermediateChecksMasterPage() {
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<IntermediateCheckRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [equipmentOptions, setEquipmentOptions] = useState<Array<{ id: string; label: string }>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpTo, setJumpTo] = useState('')
  const [form, setForm] = useState<FormType>(() => emptyIntermediateCheckForm())

  const canSave = !saveLoading && form.equipmentId.trim().length > 0

  const loadEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_master')
        .select('id, equipment_name, range_of_instrument')
        .order('equipment_name', { ascending: true })
      if (error) throw error
      const list = Array.isArray(data) ? (data as Array<{ id: string; equipment_name: string | null; range_of_instrument: string | null }>) : []
      setEquipmentOptions(
        list.map((r) => ({
          id: r.id,
          label: `${r.equipment_name ?? ''}${r.range_of_instrument ? ` (${r.range_of_instrument})` : ''}`.trim() || r.id,
        })),
      )
    } catch {
      setEquipmentOptions([])
    }
  }

  const loadRows = async () => {
    setListError(null)
    setListLoading(true)
    try {
      const { data, error } = await supabase
        .from('intermediate_checks')
        .select('*, equipment_master(equipment_name, range_of_instrument)')
        .order('check_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const list = (Array.isArray(data) ? (data as DbRow[]) : []).map((r) => ({
        id: r.id,
        equipment_id: r.equipment_id,
        equipment_name: r.equipment_master?.equipment_name ?? null,
        equipment_range: r.equipment_master?.range_of_instrument ?? null,
        check_date: r.check_date,
        next_check_date: r.next_check_date,
        result: (r.result === 'Pass' || r.result === 'Fail' ? r.result : null) as CheckResult | null,
        reference_standard: r.reference_standard,
        performed_by: r.performed_by,
        remarks: r.remarks,
        created_at: r.created_at,
      }))
      setRows(list)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unable to load intermediate checks')
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    void loadEquipment()
    void loadRows()
  }, [])

  const handleNew = () => {
    setSaveMessage(null)
    setEditingId(null)
    setForm(emptyIntermediateCheckForm())
    setShowForm(true)
  }

  const handleClear = () => {
    setForm(emptyIntermediateCheckForm())
    setSaveMessage(null)
  }

  const handleEdit = (row: IntermediateCheckRow) => {
    setSaveMessage(null)
    setEditingId(row.id)
    setForm({
      equipmentId: row.equipment_id,
      checkDate: row.check_date ?? '',
      nextCheckDate: row.next_check_date ?? '',
      result: (row.result ?? 'Pass') as CheckResult,
      referenceStandard: row.reference_standard ?? '',
      performedBy: row.performed_by ?? '',
      remarks: row.remarks ?? '',
    })
    setShowForm(true)
  }

  const handleCopy = (row: IntermediateCheckRow) => {
    setSaveMessage(null)
    setEditingId(null)
    setForm({
      equipmentId: row.equipment_id,
      checkDate: row.check_date ?? '',
      nextCheckDate: row.next_check_date ?? '',
      result: (row.result ?? 'Pass') as CheckResult,
      referenceStandard: row.reference_standard ?? '',
      performedBy: row.performed_by ?? '',
      remarks: row.remarks ?? '',
    })
    setShowForm(true)
  }

  const handleSave = () => {
    void (async () => {
      setSaveMessage(null)
      setSaveLoading(true)
      try {
        const payload = {
          equipment_id: form.equipmentId,
          check_date: form.checkDate.trim() ? form.checkDate : null,
          next_check_date: form.nextCheckDate.trim() ? form.nextCheckDate : null,
          result: form.result,
          reference_standard: normalizeText(form.referenceStandard) || null,
          performed_by: normalizeText(form.performedBy) || null,
          remarks: normalizeText(form.remarks) || null,
        }
        if (editingId) {
          const { error } = await supabase.from('intermediate_checks').update(payload).eq('id', editingId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('intermediate_checks').insert(payload)
          if (error) throw error
        }
        setSaveMessage('Saved successfully.')
        setShowForm(false)
        setEditingId(null)
        await loadRows()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      } finally {
        setSaveLoading(false)
      }
    })()
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const blob = [
        r.equipment_name ?? '',
        r.equipment_range ?? '',
        r.check_date ?? '',
        r.next_check_date ?? '',
        r.result ?? '',
        r.reference_standard ?? '',
        r.performed_by ?? '',
        r.remarks ?? '',
      ].join(' ')
      return blob.toLowerCase().includes(q)
    })
  }, [rows, search])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  useEffect(() => {
    setPage(1)
    setJumpTo('')
  }, [search, pageSize])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of pagedRows) {
        if (checked) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })
  }

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds])

  const handleDeleteSelected = () => {
    void (async () => {
      if (selectedRows.length === 0) return
      if (!window.confirm(`Delete ${selectedRows.length} selected record(s)?`)) return
      setSaveMessage(null)
      setSaveLoading(true)
      try {
        const ids = selectedRows.map((r) => r.id)
        const { error } = await supabase.from('intermediate_checks').delete().in('id', ids)
        if (error) throw error
        setSaveMessage('Deleted successfully.')
        setSelectedIds(new Set())
        await loadRows()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      } finally {
        setSaveLoading(false)
      }
    })()
  }

  const buildPrintHtml = (list: IntermediateCheckRow[]) => {
    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const rowsHtml = list
      .map(
        (r) =>
          `<tr><td>${esc(r.equipment_name ?? '')}</td><td>${esc(r.check_date ?? '')}</td><td>${esc(r.next_check_date ?? '')}</td><td>${esc(r.result ?? '')}</td><td>${esc(r.performed_by ?? '')}</td><td>${esc(r.reference_standard ?? '')}</td><td>${esc(r.remarks ?? '')}</td></tr>`,
      )
      .join('')
    return `<!doctype html><html><head><meta charset="utf-8"/><title>Intermediate Checks</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:18px;}h1{font-size:18px;}table{border-collapse:collapse;width:100%;font-size:12px;}th,td{border:1px solid #cbd5e1;padding:8px;}th{background:#f1f5f9;}</style></head><body><h1>Intermediate Checks</h1><table><thead><tr><th>Equipment</th><th>Check Date</th><th>Next Check</th><th>Result</th><th>Performed By</th><th>Reference</th><th>Remarks</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`
  }

  const handlePrintSelected = () => {
    const exportRows = selectedRows.length > 0 ? selectedRows : filteredRows
    if (exportRows.length === 0) return
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    if (!doc || !win) {
      document.body.removeChild(iframe)
      return
    }
    doc.open()
    doc.write(buildPrintHtml(exportRows))
    doc.close()
    iframe.onload = () => {
      win.focus()
      win.print()
      setTimeout(() => {
        try {
          document.body.removeChild(iframe)
        } catch {}
      }, 500)
    }
  }

  const handleExport = () => {
    const exportRows = selectedRows.length > 0 ? selectedRows : filteredRows
    const headers = ['id', 'equipment_id', 'equipment_name', 'equipment_range', 'check_date', 'next_check_date', 'result', 'reference_standard', 'performed_by', 'remarks', 'created_at']
    const lines = exportRows.map((r) => ({
      id: r.id,
      equipment_id: r.equipment_id,
      equipment_name: r.equipment_name ?? '',
      equipment_range: r.equipment_range ?? '',
      check_date: r.check_date ?? '',
      next_check_date: r.next_check_date ?? '',
      result: r.result ?? '',
      reference_standard: r.reference_standard ?? '',
      performed_by: r.performed_by ?? '',
      remarks: r.remarks ?? '',
      created_at: r.created_at ?? '',
    }))
    const csv = toCsv(headers, lines)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'intermediate_checks.csv'
    a.click()
    URL.revokeObjectURL(url)
    setSaveMessage('Exported.')
  }

  const handleImport = () => {
    setSaveMessage(null)
    importInputRef.current?.click()
  }

  const handleImportFile = (file: File) => {
    void (async () => {
      setSaveMessage(null)
      setSaveLoading(true)
      try {
        const text = await file.text()
        const records = parseCsv(text)
        if (records.length < 2) {
          setSaveMessage('No data rows in CSV.')
          return
        }
        const header = records[0]
        const get = (row: string[], key: string) => {
          const idx = header.indexOf(key)
          return idx >= 0 ? (row[idx] ?? '').trim() : ''
        }
        const dataRows = records.slice(1).filter((r) => r.some((c) => String(c).trim()))
        let inserted = 0
        for (const cells of dataRows) {
          const equipmentId = get(cells, 'equipment_id')
          if (!equipmentId) continue
          const { error } = await supabase.from('intermediate_checks').insert({
            equipment_id: equipmentId,
            check_date: get(cells, 'check_date') || null,
            next_check_date: get(cells, 'next_check_date') || null,
            result: (get(cells, 'result') || 'Pass') === 'Fail' ? 'Fail' : 'Pass',
            reference_standard: get(cells, 'reference_standard') || null,
            performed_by: get(cells, 'performed_by') || null,
            remarks: get(cells, 'remarks') || null,
          })
          if (!error) inserted++
        }
        setSaveMessage(`Imported ${inserted} record(s).`)
        await loadRows()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      } finally {
        setSaveLoading(false)
      }
    })()
  }

  return (
    <div className="p-6 space-y-5">
      <IntermediateChecksHeaderBar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
        onNew={handleNew}
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add New'} Intermediate Check</DialogTitle>
          </DialogHeader>
          {saveMessage && <div className="text-sm text-destructive">{saveMessage}</div>}
          <IntermediateChecksForm
            form={form}
            onChange={setForm}
            onSave={handleSave}
            onClear={handleClear}
            canSave={canSave}
            saveLoading={saveLoading}
            equipmentOptions={equipmentOptions}
          />
        </DialogContent>
      </Dialog>

      <IntermediateChecksTable
        rows={pagedRows}
        loading={listLoading}
        error={listError}
        selectedIds={selectedIds}
        onToggle={toggleRow}
        onToggleAll={toggleAllOnPage}
        onEdit={handleEdit}
        onCopy={handleCopy}
      />

      <IntermediateChecksTableFooterBar
        message={saveMessage}
        loading={saveLoading}
        selectedCount={selectedIds.size}
        onImport={handleImport}
        onExport={handleExport}
        onPrintSelected={handlePrintSelected}
        onDeleteSelected={handleDeleteSelected}
        page={page}
        pageCount={pageCount}
        onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setPage((p) => Math.min(pageCount, p + 1))}
        jumpTo={jumpTo}
        onJumpToChange={setJumpTo}
        onJumpToGo={() => {
          const n = Number(jumpTo)
          if (!Number.isFinite(n) || n <= 0) return
          setPage(Math.min(pageCount, Math.max(1, Math.floor(n))))
          setJumpTo('')
        }}
      />

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImportFile(f)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}
