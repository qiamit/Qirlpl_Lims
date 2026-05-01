import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EquipmentMasterForm } from './EquipmentMasterForm'
import { EquipmentMasterHeaderBar } from './EquipmentMasterHeaderBar'
import { EquipmentMasterTable } from './EquipmentMasterTable'
import { EquipmentMasterTableFooterBar } from './EquipmentMasterFooterBar'
import { emptyEquipmentForm, normalizeText, type EquipmentForm, type EquipmentRow, type EquipmentStatus } from './types'
import { computeCalibrationStatus } from '../calibration-master/types'

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
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
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

    if (ch === '\r') {
      continue
    }

    cell += ch
  }

  if (cell.length > 0 || row.length > 0) flushRow()

  return rows
}

export default function EquipmentMasterMasterPage() {
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)

  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState<EquipmentRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [calibrationStatusByEquipmentId, setCalibrationStatusByEquipmentId] = useState<Record<string, string>>(() => ({}))

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpTo, setJumpTo] = useState('')

  const [locations] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem('userManagement.departments')
      const parsed = raw ? (JSON.parse(raw) as unknown) : []
      const list = Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
      const uniq = Array.from(new Set(list.map((x) => String(x).trim()).filter(Boolean)))
      if (uniq.length > 0) return uniq
    } catch {
      // ignore
    }
    return ['Mechanical']
  })

  const [codePrefix, setCodePrefix] = useState('EQ')

  const [form, setForm] = useState<EquipmentForm>(() => {
    const base = emptyEquipmentForm()
    const loc = base.location
    return { ...base, location: loc, equipmentCode: '' }
  })

  const canSave = !saveLoading && form.equipmentName.trim().length > 0 && form.equipmentCode.trim().length > 0

  const loadPrefix = async () => {
    try {
      const { data, error } = await supabase.from('lab_prefixes').select('name,prefix')
      if (error) throw error
      const list = Array.isArray(data) ? (data as Array<{ name?: unknown; prefix?: unknown }>) : []
      const best =
        list.find((r) => String(r.name ?? '').toLowerCase().includes('equipment')) ??
        list.find((r) => String(r.name ?? '').toLowerCase().includes('equip')) ??
        list[0]
      const p = best ? String(best.prefix ?? '').trim() : ''
      if (p) setCodePrefix(p)
    } catch {
      // ignore
    }
  }

  const generateEquipmentCodeFromRows = (prefix: string, list: EquipmentRow[]) => {
    const px = String(prefix ?? '').trim() || 'EQ'
    const numericLen = Math.max(1, 10 - px.length)
    const max = list
      .map((r) => r.equipment_code)
      .filter((code) => typeof code === 'string' && code.startsWith(px))
      .map((code) => Number(code.slice(px.length).replace(/[^0-9]/g, '')))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), 0)

    const next = Math.max(1, max + 1)
    return `${px}${String(next).padStart(numericLen, '0')}`
  }

  const loadEquipment = async () => {
    setListError(null)
    setListLoading(true)
    try {
      const { data, error } = await supabase.from('equipment_master').select('*').order('created_at', { ascending: false })
      if (error) throw error
      const list = (Array.isArray(data) ? (data as EquipmentRow[]) : []).map((r) => ({
        ...r,
        status: (r.status ?? 'Active') as EquipmentStatus,
        equipment_name: r.equipment_name ?? '',
        equipment_code: r.equipment_code ?? '',
      }))
      setRows(list)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unable to load equipment')
    } finally {
      setListLoading(false)
    }
  }

  const loadCalibrationStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('calibration_master')
        .select('equipment_id, calibration_date, due_date, is_required, created_at')
        .order('calibration_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      const list = Array.isArray(data)
        ? (data as Array<{
            equipment_id: string
            calibration_date: string | null
            due_date: string | null
            is_required: boolean | null
            created_at?: string
          }>)
        : []

      const seen = new Set<string>()
      const map: Record<string, string> = {}
      for (const r of list) {
        const id = String(r.equipment_id ?? '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        map[id] = computeCalibrationStatus({
          required: Boolean(r.is_required ?? true),
          dueDate: r.due_date,
          thresholdDays: 30,
        })
      }

      setCalibrationStatusByEquipmentId(map)
    } catch {
      setCalibrationStatusByEquipmentId({})
    }
  }

  useEffect(() => {
    void loadPrefix()
    void loadEquipment()
    void loadCalibrationStatuses()
  }, [])

  useEffect(() => {
    setForm((prev) => {
      const loc = prev.location || (locations[0] ?? 'Mechanical')
      const code = prev.equipmentCode || generateEquipmentCodeFromRows(codePrefix, rows)
      return { ...prev, location: loc, equipmentCode: code }
    })
  }, [rows, codePrefix, locations])

  const handleNew = () => {
    setSaveMessage(null)
    setEditingId(null)
    const base = emptyEquipmentForm()
    const nextLoc = locations.includes('Mechanical') ? 'Mechanical' : (locations[0] ?? 'Mechanical')
    setForm({ ...base, location: nextLoc, equipmentCode: generateEquipmentCodeFromRows(codePrefix, rows) })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleClear = () => {
    const base = emptyEquipmentForm()
    const nextLoc = form.location || (locations.includes('Mechanical') ? 'Mechanical' : (locations[0] ?? 'Mechanical'))
    setForm({ ...base, location: nextLoc, equipmentCode: form.equipmentCode })
    setSaveMessage(null)
  }

  const handleEdit = (row: EquipmentRow) => {
    setSaveMessage(null)
    setEditingId(row.id)
    setForm({
      equipmentName: row.equipment_name ?? '',
      equipmentCode: row.equipment_code ?? '',
      status: (row.status ?? 'Active') as EquipmentStatus,
      make: row.make ?? '',
      modelSerialNo: row.model_serial_no ?? '',
      leastCount: row.least_count ?? '',
      rangeOfInstrument: row.range_of_instrument ?? '',
      location: row.location ?? (locations[0] ?? 'Mechanical'),
      placedDate: row.placed_date ?? '',
      uncertaintyMu: row.uncertainty_mu == null ? '' : String(row.uncertainty_mu),
      acceptanceCriteria: row.acceptance_criteria == null ? '' : String(row.acceptance_criteria),
      remarks: row.remarks ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCopy = (row: EquipmentRow) => {
    setSaveMessage(null)
    setEditingId(null)
    setForm({
      equipmentName: row.equipment_name ?? '',
      equipmentCode: generateEquipmentCodeFromRows(codePrefix, rows),
      status: (row.status ?? 'Active') as EquipmentStatus,
      make: row.make ?? '',
      modelSerialNo: row.model_serial_no ?? '',
      leastCount: row.least_count ?? '',
      rangeOfInstrument: row.range_of_instrument ?? '',
      location: row.location ?? (locations[0] ?? 'Mechanical'),
      placedDate: row.placed_date ?? '',
      uncertaintyMu: row.uncertainty_mu == null ? '' : String(row.uncertainty_mu),
      acceptanceCriteria: row.acceptance_criteria == null ? '' : String(row.acceptance_criteria),
      remarks: row.remarks ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = () => {
    void (async () => {
      setSaveMessage(null)
      setSaveLoading(true)
      try {
        const payload = {
          equipment_name: normalizeText(form.equipmentName),
          equipment_code: normalizeText(form.equipmentCode),
          status: form.status,
          make: normalizeText(form.make) || null,
          model_serial_no: normalizeText(form.modelSerialNo) || null,
          least_count: normalizeText(form.leastCount) || null,
          range_of_instrument: normalizeText(form.rangeOfInstrument) || null,
          location: normalizeText(form.location) || null,
          placed_date: form.placedDate.trim() ? form.placedDate : null,
          uncertainty_mu: form.uncertaintyMu.trim() ? Number(form.uncertaintyMu) : null,
          acceptance_criteria: form.acceptanceCriteria.trim() ? Number(form.acceptanceCriteria) : null,
          remarks: normalizeText(form.remarks) || null,
        }

        if (!payload.equipment_name) {
          setSaveMessage('Name of the Equipment is required.')
          return
        }

        if (!payload.equipment_code) {
          setSaveMessage('Equipment Code is required.')
          return
        }

        if (editingId) {
          const { error } = await supabase.from('equipment_master').update(payload).eq('id', editingId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('equipment_master').insert(payload)
          if (error) throw error
        }

        setSaveMessage('Saved successfully.')
        setShowForm(false)
        setEditingId(null)
        await loadEquipment()
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
        r.equipment_name,
        r.equipment_code,
        r.status,
        r.make ?? '',
        r.model_serial_no ?? '',
        r.least_count ?? '',
        r.range_of_instrument ?? '',
        r.location ?? '',
        r.placed_date ?? '',
        String(r.uncertainty_mu ?? ''),
        String(r.acceptance_criteria ?? ''),
        r.remarks ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return blob.includes(q)
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
      const ok = window.confirm(`Delete ${selectedRows.length} selected equipment item(s)?`)
      if (!ok) return
      setSaveMessage(null)
      setSaveLoading(true)
      try {
        const ids = selectedRows.map((r) => r.id)
        const { error } = await supabase.from('equipment_master').delete().in('id', ids)
        if (error) throw error
        setSaveMessage('Deleted successfully.')
        setSelectedIds(new Set())
        await loadEquipment()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      } finally {
        setSaveLoading(false)
      }
    })()
  }

  const buildPrintHtml = (list: EquipmentRow[]) => {
    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const fmtMu = (v: number | null | undefined) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return ''
      return `± ${v.toFixed(2)} %`
    }

    const rowsHtml = list
      .map((r) =>
        `<tr>
<td>${esc(r.equipment_name)}</td>
<td>${esc(r.equipment_code)}</td>
<td>${esc(r.status)}</td>
<td>${esc(r.make ?? '')}</td>
<td>${esc(r.model_serial_no ?? '')}</td>
<td>${esc(r.least_count ?? '')}</td>
<td>${esc(r.range_of_instrument ?? '')}</td>
<td>${esc(r.location ?? '')}</td>
<td>${esc(r.placed_date ?? '')}</td>
<td>${esc(fmtMu(r.uncertainty_mu))}</td>
<td>${esc(fmtMu(r.acceptance_criteria))}</td>
<td>${esc(r.remarks ?? '')}</td>
</tr>`,
      )
      .join('')

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Equipment Master</title>
<style>
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:18px;}
  h1{font-size:18px; margin:0 0 12px 0;}
  table{border-collapse:collapse; width:100%; font-size:12px;}
  th,td{border:1px solid #cbd5e1; padding:8px; vertical-align:top;}
  th{background:#f1f5f9; text-align:left;}
</style>
</head>
<body>
<h1>Equipment Master</h1>
<table>
<thead>
<tr>
<th>Name</th>
<th>Code</th>
<th>Status</th>
<th>Make</th>
<th>Model/Serial</th>
<th>Least Count</th>
<th>Range</th>
<th>Location</th>
<th>Placed</th>
<th>MU</th>
<th>Acceptance</th>
<th>Remarks</th>
</tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>
</body>
</html>`
  }

  const handlePrintSelected = () => {
    const exportRows = selectedRows.length > 0 ? selectedRows : filteredRows
    if (exportRows.length === 0) return
    const html = buildPrintHtml(exportRows)

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const cleanup = () => {
      try {
        document.body.removeChild(iframe)
      } catch {
        // ignore
      }
    }

    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    if (!doc || !win) {
      cleanup()
      setSaveMessage('Unable to open print preview.')
      return
    }

    doc.open()
    doc.write(html)
    doc.close()

    iframe.onload = () => {
      try {
        win.focus()
        win.print()
      } finally {
        window.setTimeout(cleanup, 500)
      }
    }
  }

  const handleExport = () => {
    const exportRows = selectedRows.length > 0 ? selectedRows : filteredRows

    const headers = [
      'id',
      'equipment_name',
      'equipment_code',
      'status',
      'make',
      'model_serial_no',
      'least_count',
      'range_of_instrument',
      'location',
      'placed_date',
      'uncertainty_mu',
      'acceptance_criteria',
      'remarks',
      'created_at',
    ]

    const lines = exportRows.map((r) => ({
      id: r.id,
      equipment_name: r.equipment_name,
      equipment_code: r.equipment_code,
      status: r.status,
      make: r.make ?? '',
      model_serial_no: r.model_serial_no ?? '',
      least_count: r.least_count ?? '',
      range_of_instrument: r.range_of_instrument ?? '',
      location: r.location ?? '',
      placed_date: r.placed_date ?? '',
      uncertainty_mu: String(r.uncertainty_mu ?? ''),
      acceptance_criteria: String(r.acceptance_criteria ?? ''),
      remarks: r.remarks ?? '',
      created_at: r.created_at ?? '',
    }))

    const csv = toCsv(headers, lines)

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'equipment_master.csv'
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
        if (records.length === 0) {
          setSaveMessage('No rows found in CSV.')
          return
        }

        const header = records[0].map((h) => h.trim())
        const rowsData = records.slice(1).filter((r) => r.some((c) => String(c ?? '').trim().length > 0))

        const idx = (name: string) => header.findIndex((h) => h === name)

        const payloads = rowsData.map((r) => {
          const get = (name: string) => {
            const i = idx(name)
            return i >= 0 ? (r[i] ?? '') : ''
          }

          const code = get('equipment_code') || generateEquipmentCodeFromRows(codePrefix, rows)

          return {
            equipment_name: get('equipment_name') || '',
            equipment_code: code,
            status: (get('status') || 'Active') as EquipmentStatus,
            make: get('make') || null,
            model_serial_no: get('model_serial_no') || null,
            least_count: get('least_count') || null,
            range_of_instrument: get('range_of_instrument') || null,
            location: get('location') || null,
            placed_date: get('placed_date') || null,
            uncertainty_mu: get('uncertainty_mu') ? Number(get('uncertainty_mu')) : null,
            acceptance_criteria: get('acceptance_criteria') ? Number(get('acceptance_criteria')) : null,
            remarks: get('remarks') || null,
          }
        })

        const cleaned = payloads.filter((p) => normalizeText(p.equipment_name).length > 0)
        if (cleaned.length === 0) {
          setSaveMessage('No valid rows found in CSV.')
          return
        }

        const { error } = await supabase.from('equipment_master').insert(cleaned)
        if (error) throw error

        setSaveMessage('Imported successfully.')
        await loadEquipment()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      } finally {
        setSaveLoading(false)
      }
    })()
  }

  return (
    <div className="p-6 space-y-5">
      <EquipmentMasterHeaderBar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onNew={handleNew}
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Test Equipment</DialogTitle>
            <DialogDescription>Equipment master entry.</DialogDescription>
          </DialogHeader>
          {saveMessage && <div className="text-sm text-destructive">{saveMessage}</div>}
          <EquipmentMasterForm
            form={form}
            onChange={setForm}
            canSave={canSave}
            saveLoading={saveLoading}
            onSave={handleSave}
            onClear={handleClear}
            locations={locations.length ? locations : ['Mechanical']}
          />
        </DialogContent>
      </Dialog>

      <EquipmentMasterTable
        rows={pagedRows}
        loading={listLoading}
        error={listError}
        selectedIds={selectedIds}
        onToggle={toggleRow}
        onToggleAll={toggleAllOnPage}
        onEdit={handleEdit}
        onCopy={handleCopy}
        calibrationStatusByEquipmentId={calibrationStatusByEquipmentId}
      />

      <EquipmentMasterTableFooterBar
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
          setPage(Math.min(pageCount, Math.max(1, n)))
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
