import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MaintenanceMasterHeaderBar } from './MaintenanceMasterHeaderBar'
import { MaintenanceMasterForm } from './MaintenanceMasterForm'
import { MaintenanceMasterTable } from './MaintenanceMasterTable'
import { MaintenanceMasterTableFooterBar } from './MaintenanceMasterFooterBar'
import {
  emptyMaintenanceForm,
  normalizeText,
  type MaintenanceRow,
  type MaintenanceForm as FormType,
  type MaintenanceType,
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
  maintenance_type: string | null
  schedule_frequency: string | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  description: string | null
  performed_by: string | null
  status: string | null
  remarks: string | null
  created_at?: string
  equipment_master?: { equipment_name: string | null; range_of_instrument: string | null } | null
}

export default function MaintenanceMasterMasterPage() {
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<MaintenanceRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [equipmentOptions, setEquipmentOptions] = useState<Array<{ id: string; label: string }>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpTo, setJumpTo] = useState('')
  const [form, setForm] = useState<FormType>(() => emptyMaintenanceForm())

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
        .from('equipment_maintenance')
        .select('*, equipment_master(equipment_name, range_of_instrument)')
        .order('next_maintenance_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const list = (Array.isArray(data) ? (data as DbRow[]) : []).map((r) => ({
        id: r.id,
        equipment_id: r.equipment_id,
        equipment_name: r.equipment_master?.equipment_name ?? null,
        equipment_range: r.equipment_master?.range_of_instrument ?? null,
        maintenance_type: (r.maintenance_type === 'Preventive' || r.maintenance_type === 'Corrective' || r.maintenance_type === 'Predictive'
          ? r.maintenance_type
          : null) as MaintenanceRow['maintenance_type'],
        schedule_frequency: r.schedule_frequency,
        last_maintenance_date: r.last_maintenance_date,
        next_maintenance_date: r.next_maintenance_date,
        description: r.description,
        performed_by: r.performed_by,
        status: r.status,
        remarks: r.remarks,
        created_at: r.created_at,
      }))
      setRows(list)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unable to load maintenance records')
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
    setForm(emptyMaintenanceForm())
    setShowForm(true)
  }

  const handleClear = () => {
    setForm(emptyMaintenanceForm())
    setSaveMessage(null)
  }

  const handleEdit = (row: MaintenanceRow) => {
    setSaveMessage(null)
    setEditingId(row.id)
    setForm({
      equipmentId: row.equipment_id,
      maintenanceType: (row.maintenance_type ?? 'Preventive') as MaintenanceType,
      scheduleFrequency: row.schedule_frequency ?? '',
      lastMaintenanceDate: row.last_maintenance_date ?? '',
      nextMaintenanceDate: row.next_maintenance_date ?? '',
      description: row.description ?? '',
      performedBy: row.performed_by ?? '',
      status: row.status ?? 'Scheduled',
      remarks: row.remarks ?? '',
    })
    setShowForm(true)
  }

  const handleCopy = (row: MaintenanceRow) => {
    setSaveMessage(null)
    setEditingId(null)
    setForm({
      equipmentId: row.equipment_id,
      maintenanceType: (row.maintenance_type ?? 'Preventive') as MaintenanceType,
      scheduleFrequency: row.schedule_frequency ?? '',
      lastMaintenanceDate: row.last_maintenance_date ?? '',
      nextMaintenanceDate: row.next_maintenance_date ?? '',
      description: row.description ?? '',
      performedBy: row.performed_by ?? '',
      status: row.status ?? 'Scheduled',
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
          maintenance_type: form.maintenanceType,
          schedule_frequency: normalizeText(form.scheduleFrequency) || null,
          last_maintenance_date: form.lastMaintenanceDate.trim() ? form.lastMaintenanceDate : null,
          next_maintenance_date: form.nextMaintenanceDate.trim() ? form.nextMaintenanceDate : null,
          description: normalizeText(form.description) || null,
          performed_by: normalizeText(form.performedBy) || null,
          status: normalizeText(form.status) || null,
          remarks: normalizeText(form.remarks) || null,
        }
        if (editingId) {
          const { error } = await supabase.from('equipment_maintenance').update(payload).eq('id', editingId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('equipment_maintenance').insert(payload)
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
        r.maintenance_type ?? '',
        r.schedule_frequency ?? '',
        r.last_maintenance_date ?? '',
        r.next_maintenance_date ?? '',
        r.description ?? '',
        r.performed_by ?? '',
        r.status ?? '',
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
        const { error } = await supabase.from('equipment_maintenance').delete().in('id', ids)
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

  const buildPrintHtml = (list: MaintenanceRow[]) => {
    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const rowsHtml = list
      .map(
        (r) =>
          `<tr><td>${esc(r.equipment_name ?? '')}</td><td>${esc(r.maintenance_type ?? '')}</td><td>${esc(r.schedule_frequency ?? '')}</td><td>${esc(r.last_maintenance_date ?? '')}</td><td>${esc(r.next_maintenance_date ?? '')}</td><td>${esc(r.status ?? '')}</td><td>${esc(r.performed_by ?? '')}</td><td>${esc(r.remarks ?? '')}</td></tr>`,
      )
      .join('')
    return `<!doctype html><html><head><meta charset="utf-8"/><title>Maintenance Master</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:18px;}h1{font-size:18px;}table{border-collapse:collapse;width:100%;font-size:12px;}th,td{border:1px solid #cbd5e1;padding:8px;}th{background:#f1f5f9;}</style></head><body><h1>Maintenance Master</h1><table><thead><tr><th>Equipment</th><th>Type</th><th>Frequency</th><th>Last Date</th><th>Next Date</th><th>Status</th><th>Performed By</th><th>Remarks</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`
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
    const headers = [
      'id', 'equipment_id', 'equipment_name', 'equipment_range', 'maintenance_type', 'schedule_frequency',
      'last_maintenance_date', 'next_maintenance_date', 'description', 'performed_by', 'status', 'remarks', 'created_at',
    ]
    const lines = exportRows.map((r) => ({
      id: r.id,
      equipment_id: r.equipment_id,
      equipment_name: r.equipment_name ?? '',
      equipment_range: r.equipment_range ?? '',
      maintenance_type: r.maintenance_type ?? '',
      schedule_frequency: r.schedule_frequency ?? '',
      last_maintenance_date: r.last_maintenance_date ?? '',
      next_maintenance_date: r.next_maintenance_date ?? '',
      description: r.description ?? '',
      performed_by: r.performed_by ?? '',
      status: r.status ?? '',
      remarks: r.remarks ?? '',
      created_at: r.created_at ?? '',
    }))
    const csv = toCsv(headers, lines)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'equipment_maintenance.csv'
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
          const type = get(cells, 'maintenance_type')
          const maintenanceType = type === 'Corrective' || type === 'Predictive' ? type : 'Preventive'
          const { error } = await supabase.from('equipment_maintenance').insert({
            equipment_id: equipmentId,
            maintenance_type: maintenanceType,
            schedule_frequency: get(cells, 'schedule_frequency') || null,
            last_maintenance_date: get(cells, 'last_maintenance_date') || null,
            next_maintenance_date: get(cells, 'next_maintenance_date') || null,
            description: get(cells, 'description') || null,
            performed_by: get(cells, 'performed_by') || null,
            status: get(cells, 'status') || null,
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
      <MaintenanceMasterHeaderBar
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
            <DialogTitle>{editingId ? 'Edit' : 'Add New'} Maintenance</DialogTitle>
          </DialogHeader>
          {saveMessage && <div className="text-sm text-destructive">{saveMessage}</div>}
          <MaintenanceMasterForm
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

      <MaintenanceMasterTable
        rows={pagedRows}
        loading={listLoading}
        error={listError}
        selectedIds={selectedIds}
        onToggle={toggleRow}
        onToggleAll={toggleAllOnPage}
        onEdit={handleEdit}
        onCopy={handleCopy}
      />

      <MaintenanceMasterTableFooterBar
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
