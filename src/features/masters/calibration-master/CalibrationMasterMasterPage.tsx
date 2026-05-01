import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalibrationMasterHeaderBar } from './CalibrationMasterHeaderBar'
import { CalibrationMasterForm } from './CalibrationMasterForm'
import { CalibrationMasterTable } from './CalibrationMasterTable'
import { CalibrationMasterTableFooterBar } from './CalibrationMasterFooterBar'
import {
  computeCalibrationStatus,
  emptyCalibrationForm,
  normalizeText,
  type CalibrationForm,
  type CalibrationRow,
} from './types'

const DUE_THRESHOLD_DAYS = 30
const BUCKET = 'calibration-files'

type EquipmentOptionRow = {
  id: string
  equipment_name: string
  range_of_instrument: string | null
}

type ClientRowLite = { id: string; company_name: string | null }

type CalibrationDbRow = {
  id: string
  equipment_id: string
  calibration_date: string | null
  due_date: string | null
  certificate_number: string | null
  calibration_agency: string | null
  uncertainty: number | null
  is_required: boolean | null
  remarks: string | null
  created_at?: string
  equipment_master?: { equipment_name: string | null; range_of_instrument: string | null } | null
}

const formatSupabaseError = (err: unknown) => {
  if (!err || typeof err !== 'object') return 'Unknown error'
  const anyErr = err as { message?: string; details?: string; hint?: string; code?: string }
  const parts = [anyErr.message, anyErr.details, anyErr.hint, anyErr.code].filter(Boolean)
  return parts.length ? parts.join(' | ') : 'Unknown error'
}

type PopupFile = { id: string; file_name: string; storage_path: string; url?: string; error?: string }

type CalibrationFileRow = { id: string; calibration_id: string; file_name: string; storage_path: string; created_at?: string }

const toCsv = (headers: string[], rows: Record<string, string>[]) => {
  const esc = (v: string) => {
    if (v == null) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h] ?? '')).join(','))].join('\n')
}

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/)
  const out: string[][] = []
  for (const line of lines) {
    if (!line.trim()) continue
    const row: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        let j = i + 1
        let cell = ''
        while (j < line.length) {
          if (line[j] === '"' && line[j + 1] === '"') {
            cell += '"'
            j += 2
            continue
          }
          if (line[j] === '"') {
            j += 1
            break
          }
          cell += line[j]
          j += 1
        }
        row.push(cell)
        i = j
        if (line[i] === ',') i += 1
      } else {
        const j = line.indexOf(',', i)
        if (j === -1) {
          row.push(line.slice(i))
          break
        }
        row.push(line.slice(i, j))
        i = j + 1
      }
    }
    out.push(row)
  }
  return out
}

const buildLoadingPopupHtml = (title: string) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Calibration Files</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; margin:16px;}
    .muted{color:#64748b; font-size:12px; margin-top:8px;}
  </style>
</head>
<body>
  <h1>Calibration Files</h1>
  <div class="muted">${title}</div>
  <div class="muted">Loading…</div>
</body>
</html>`

const buildFilesPopupHtml = (title: string, files: PopupFile[]) => {
  const esc = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const items = files
    .map((f) => {
      const viewButton = f.url
        ? `<a class="btn" href="${esc(f.url)}" target="_blank" rel="noreferrer">View</a>`
        : `<span class="muted">${esc(f.error || 'Signed URL blocked by storage policy')}</span>`
      return `
<div class="row">
  <div class="name">${esc(f.file_name)}</div>
  <div class="actions">
    ${viewButton}
    <button class="btn danger" data-delete="1" data-id="${esc(f.id)}" data-name="${esc(f.file_name)}" data-path="${esc(f.storage_path)}">Delete</button>
  </div>
</div>`
    })
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Calibration Files</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; margin:16px;}
    h1{font-size:18px; margin:0 0 12px 0;}
    .muted{color:#64748b; font-size:12px; margin-bottom:12px;}
    .row{display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px;}
    .name{flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
    .actions{display:flex; gap:8px;}
    .btn{border:1px solid #94a3b8; background:white; padding:6px 10px; border-radius:8px; cursor:pointer; text-decoration:none; color:#0f172a; font-size:12px;}
    .btn:hover{background:#f8fafc;}
    .danger{border-color:#fecaca; color:#991b1b;}
    .danger:hover{background:#fef2f2;}
    .empty{padding:18px; border:1px dashed #cbd5e1; border-radius:8px; color:#64748b;}
  </style>
</head>
<body>
  <h1>Calibration Files</h1>
  <div class="muted">${esc(title)}</div>
  ${files.length ? items : '<div class="empty">No files.</div>'}

  <script>
    window.addEventListener('click', function(e){
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.getAttribute('data-delete') !== '1') return;
      var name = el.getAttribute('data-name') || '';
      var ok = window.confirm('Delete file ' + name + '?');
      if (!ok) return;
      var file = {
        id: el.getAttribute('data-id'),
        file_name: name,
        storage_path: el.getAttribute('data-path')
      };
      if (window.opener && window.opener.postMessage) {
        window.opener.postMessage({ type: 'calibration-files:delete', file: file }, '*');
      }
    });
  </script>
</body>
</html>`
}

export default function CalibrationMasterMasterPage() {
  const [searchParams] = useSearchParams()

  const importInputRef = useRef<HTMLInputElement | null>(null)
  const filesPopupRef = useRef<Window | null>(null)

  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [search, setSearch] = useState('')

  const [rows, setRows] = useState<CalibrationRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [equipmentOptions, setEquipmentOptions] = useState<Array<{ id: string; label: string }>>(() => [])
  const [agencyOptions, setAgencyOptions] = useState<Array<{ id: string; label: string }>>(() => [])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpTo, setJumpTo] = useState('')

  const [form, setForm] = useState<CalibrationForm>(() => emptyCalibrationForm())

  const equipmentIdFilter = searchParams.get('equipmentId')

  const loadEquipmentOptions = async () => {
    const { data, error } = await supabase
      .from('equipment_master')
      .select('id, equipment_name, range_of_instrument')
      .order('equipment_name', { ascending: true })

    if (error) throw error
    const list = Array.isArray(data) ? (data as EquipmentOptionRow[]) : []
    setEquipmentOptions(
      list.map((r) => ({
        id: r.id,
        label: `${r.equipment_name}${r.range_of_instrument ? ` (${r.range_of_instrument})` : ''}`,
      })),
    )
  }

  const loadAgencyOptions = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name')
      .order('company_name', { ascending: true })

    if (error) throw error
    const list = Array.isArray(data) ? (data as ClientRowLite[]) : []
    setAgencyOptions(
      list
        .map((r) => ({ id: r.id, label: (r.company_name ?? '').trim() }))
        .filter((x) => x.label.length > 0),
    )
  }

  const loadRows = async () => {
    setListError(null)
    setListLoading(true)
    try {
      const { data, error } = await supabase
        .from('calibration_master')
        .select('*, equipment_master(equipment_name, range_of_instrument)')
        .order('created_at', { ascending: false })

      if (error) throw error

      const list = (Array.isArray(data) ? (data as CalibrationDbRow[]) : []).map((r) => ({
        id: r.id,
        equipment_id: r.equipment_id,
        equipment_name: r.equipment_master?.equipment_name ?? null,
        equipment_range: r.equipment_master?.range_of_instrument ?? null,
        calibration_date: r.calibration_date,
        due_date: r.due_date,
        certificate_number: r.certificate_number,
        calibration_agency: r.calibration_agency,
        uncertainty: r.uncertainty,
        is_required: r.is_required,
        remarks: r.remarks,
        created_at: r.created_at,
      }))

      setRows(list)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unable to load calibration records')
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadEquipmentOptions()
        await loadAgencyOptions()
        await loadRows()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      }
    })()
  }, [])

  useEffect(() => {
    if (!equipmentIdFilter) return
    setSearch('')
  }, [equipmentIdFilter])

  useEffect(() => {
    setPage(1)
    setJumpTo('')
  }, [search, pageSize, equipmentIdFilter])

  const getStatus = (r: CalibrationRow) => {
    return computeCalibrationStatus({
      required: Boolean(r.is_required ?? true),
      dueDate: r.due_date,
      thresholdDays: DUE_THRESHOLD_DAYS,
    })
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    let base = rows
    if (equipmentIdFilter) base = base.filter((r) => r.equipment_id === equipmentIdFilter)

    if (!q) return base

    return base.filter((r) => {
      const blob = [
        r.equipment_name ?? '',
        r.equipment_range ?? '',
        r.calibration_date ?? '',
        r.due_date ?? '',
        r.certificate_number ?? '',
        r.calibration_agency ?? '',
        String(r.uncertainty ?? ''),
        r.remarks ?? '',
        getStatus(r),
      ]
        .join(' ')
        .toLowerCase()

      return blob.includes(q)
    })
  }, [rows, search, equipmentIdFilter])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))

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

  const handleNew = () => {
    setSaveMessage(null)
    setEditingId(null)
    setForm((prev) => ({ ...emptyCalibrationForm(), equipmentId: equipmentIdFilter || prev.equipmentId }))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleClear = () => {
    setSaveMessage(null)
    setForm(emptyCalibrationForm())
  }

  const handleEdit = (row: CalibrationRow) => {
    setSaveMessage(null)
    setEditingId(row.id)
    setForm({
      equipmentId: row.equipment_id,
      calibrationDate: row.calibration_date ?? '',
      dueDate: row.due_date ?? '',
      certificateNumber: row.certificate_number ?? '',
      calibrationAgency: row.calibration_agency ?? '',
      uncertainty: row.uncertainty == null ? '' : String(row.uncertainty),
      required: Boolean(row.is_required ?? true),
      remarks: row.remarks ?? '',
      files: [],
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCopy = (row: CalibrationRow) => {
    setSaveMessage(null)
    setEditingId(null)
    setForm({
      equipmentId: row.equipment_id,
      calibrationDate: row.calibration_date ?? '',
      dueDate: row.due_date ?? '',
      certificateNumber: row.certificate_number ?? '',
      calibrationAgency: row.calibration_agency ?? '',
      uncertainty: row.uncertainty == null ? '' : String(row.uncertainty),
      required: Boolean(row.is_required ?? true),
      remarks: row.remarks ?? '',
      files: [],
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePickFiles = (files: File[]) => {
    if (files.length === 0) return
    setForm((prev) => ({ ...prev, files: [...prev.files, ...files] }))
  }

  const uploadFiles = async (calibrationId: string, files: File[]) => {
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${calibrationId}/${crypto.randomUUID()}_${safeName}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (upErr) throw upErr

      const { error: metaErr } = await supabase.from('calibration_files').insert({
        calibration_id: calibrationId,
        file_name: file.name,
        storage_path: path,
      })
      if (metaErr) throw metaErr
    }
  }

  const getSignedUrl = async (storagePath: string): Promise<string | undefined> => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10)
      if (error) throw error
      return data.signedUrl
    } catch {
      return undefined
    }
  }

  const buildPopupFilesForCalibration = async (calibrationId: string): Promise<PopupFile[]> => {
    const { data, error } = await supabase
      .from('calibration_files')
      .select('*')
      .eq('calibration_id', calibrationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const dbList = Array.isArray(data) ? (data as CalibrationFileRow[]) : []
    const withUrls: PopupFile[] = []
    for (const f of dbList) {
      const url = await getSignedUrl(f.storage_path)
      withUrls.push({
        id: f.id,
        file_name: f.file_name,
        storage_path: f.storage_path,
        ...(url ? { url } : { error: 'Signed URL blocked by storage policy' }),
      })
    }
    return withUrls
  }

  const openFilesPopupForId = async (calibrationId: string, title: string) => {
    const win = window.open('', '_blank', 'width=900,height=600')
    if (!win) {
      setSaveMessage('Popup blocked. Please allow popups for this site.')
      return
    }
    filesPopupRef.current = win

    win.document.open()
    win.document.write(buildLoadingPopupHtml(title))
    win.document.close()

    void (async () => {
      try {
        const files = await buildPopupFilesForCalibration(calibrationId)
        win.document.open()
        win.document.write(buildFilesPopupHtml(title, files))
        win.document.close()
      } catch (err) {
        const msg = formatSupabaseError(err)
        win.document.open()
        win.document.write(buildFilesPopupHtml(title, [{ id: 'err', file_name: 'Unable to load files', storage_path: '', error: msg }]))
        win.document.close()
        setSaveMessage(msg)
      }
    })()
  }

  const handleOpenFiles = () => {
    const title = 'Calibration'
    if (!editingId) {
      setSaveMessage('Save the record first to view files.')
      return
    }
    void openFilesPopupForId(editingId, title)
  }

  const handleOpenFilesRow = (row: CalibrationRow) => {
    const title = row.equipment_name ? `${row.equipment_name}` : 'Calibration'
    void openFilesPopupForId(row.id, title)
  }

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; file?: PopupFile } | null
      if (!data || data.type !== 'calibration-files:delete' || !data.file) return

      const file = data.file
      void (async () => {
        try {
          if (!editingId) return
          if (file.id && !String(file.id).startsWith('storage:')) {
            const { error } = await supabase.from('calibration_files').delete().eq('id', file.id)
            if (error) throw error
          }
          const { error: stErr } = await supabase.storage.from(BUCKET).remove([file.storage_path])
          if (stErr) throw stErr

          const win = filesPopupRef.current
          if (win && !win.closed) {
            const list = await buildPopupFilesForCalibration(editingId)
            win.document.open()
            win.document.write(buildFilesPopupHtml('Calibration', list))
            win.document.close()
          }
        } catch (err) {
          setSaveMessage(formatSupabaseError(err))
        }
      })()
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [editingId])

  const canSave =
    !saveLoading &&
    form.equipmentId.trim().length > 0 &&
    (!form.required || (form.dueDate.trim().length > 0 && form.calibrationDate.trim().length > 0))

  const handleSave = () => {
    void (async () => {
      setSaveMessage(null)
      setSaveLoading(true)
      try {
        const payload = {
          equipment_id: form.equipmentId,
          calibration_date: form.calibrationDate.trim() ? form.calibrationDate : null,
          due_date: form.dueDate.trim() ? form.dueDate : null,
          certificate_number: normalizeText(form.certificateNumber) || null,
          calibration_agency: normalizeText(form.calibrationAgency) || null,
          uncertainty: form.uncertainty.trim() ? Number(form.uncertainty) : null,
          is_required: form.required,
          remarks: normalizeText(form.remarks) || null,
        }

        let id: string | null = editingId

        if (editingId) {
          const { error } = await supabase.from('calibration_master').update(payload).eq('id', editingId)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('calibration_master').insert(payload).select('id').single()
          if (error) throw error
          id = (data as { id: string } | null)?.id ?? null
        }
        if (!id) throw new Error('Unable to determine record id')

        if (form.files.length > 0) {
          try {
            await uploadFiles(id, form.files)
          } catch (err) {
            const msg = formatSupabaseError(err)
            const extra = msg.toLowerCase().includes('bucket') ? `\n\nCreate Supabase Storage bucket: ${BUCKET}` : ''
            setSaveMessage(`Saved record, but file upload failed: ${msg}${extra}`)
            setEditingId(id)
            setShowForm(true)
            await loadRows()
            return
          }
        }

        setSaveMessage('Saved successfully.')
        setForm(emptyCalibrationForm())
        setEditingId(null)
        setShowForm(false)
        await loadRows()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      } finally {
        setSaveLoading(false)
      }
    })()
  }

  const handleDeleteSelected = () => {
    void (async () => {
      if (selectedRows.length === 0) return
      const ok = window.confirm(`Delete ${selectedRows.length} selected record(s)?`)
      if (!ok) return
      setSaveMessage(null)
      setSaveLoading(true)
      try {
        const ids = selectedRows.map((r) => r.id)
        const { error } = await supabase.from('calibration_master').delete().in('id', ids)
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

  const handleExport = () => {
    const exportRows = selectedRows.length > 0 ? selectedRows : filteredRows

    const headers = [
      'id',
      'equipment_id',
      'equipment_name',
      'equipment_range',
      'calibration_date',
      'due_date',
      'certificate_number',
      'calibration_agency',
      'uncertainty',
      'is_required',
      'remarks',
      'created_at',
    ]

    const lines = exportRows.map((r) => ({
      id: r.id,
      equipment_id: r.equipment_id,
      equipment_name: r.equipment_name ?? '',
      equipment_range: r.equipment_range ?? '',
      calibration_date: r.calibration_date ?? '',
      due_date: r.due_date ?? '',
      certificate_number: r.certificate_number ?? '',
      calibration_agency: r.calibration_agency ?? '',
      uncertainty: String(r.uncertainty ?? ''),
      is_required: String(Boolean(r.is_required ?? true)),
      remarks: r.remarks ?? '',
      created_at: r.created_at ?? '',
    }))

    const csv = toCsv(headers, lines)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'calibration_master.csv'
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

        const equipmentByNameRange = new Map<string, string>()
        for (const opt of equipmentOptions) {
          equipmentByNameRange.set(opt.label.toLowerCase(), opt.id)
        }

        const payloads = rowsData.map((cells) => {
          const get = (name: string) => {
            const i = idx(name)
            return i >= 0 ? (cells[i] ?? '') : ''
          }

          const equipmentId = get('equipment_id')
          const name = normalizeText(get('equipment_name'))
          const range = normalizeText(get('equipment_range'))
          const label = `${name}${range ? ` (${range})` : ''}`

          const resolvedEquipmentId =
            normalizeText(equipmentId) || (label.trim() ? equipmentByNameRange.get(label.toLowerCase()) || '' : '')

          return {
            equipment_id: resolvedEquipmentId,
            calibration_date: get('calibration_date') || null,
            due_date: get('due_date') || null,
            certificate_number: normalizeText(get('certificate_number')) || null,
            calibration_agency: normalizeText(get('calibration_agency')) || null,
            uncertainty: get('uncertainty') ? Number(get('uncertainty')) : null,
            is_required: normalizeText(get('is_required')).toLowerCase() === 'false' ? false : true,
            remarks: normalizeText(get('remarks')) || null,
          }
        })

        const cleaned = payloads.filter((p) => normalizeText(p.equipment_id).length > 0)
        if (cleaned.length === 0) {
          setSaveMessage('No valid rows found in CSV (equipment_id missing / unable to resolve).')
          return
        }

        const { error } = await supabase.from('calibration_master').insert(cleaned)
        if (error) throw error

        setSaveMessage('Imported successfully.')
        await loadRows()
      } catch (err) {
        setSaveMessage(formatSupabaseError(err))
      } finally {
        setSaveLoading(false)
      }
    })()
  }

  const buildPrintHtml = (list: CalibrationRow[]) => {
    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const rowsHtml = list
      .map((r) =>
        `<tr>
<td>${esc(r.equipment_name ?? '')}</td>
<td>${esc(r.equipment_range ?? '')}</td>
<td>${esc(r.calibration_date ?? '')}</td>
<td>${esc(r.due_date ?? '')}</td>
<td>${esc(r.certificate_number ?? '')}</td>
<td>${esc(r.calibration_agency ?? '')}</td>
<td>${esc(String(r.uncertainty ?? ''))}</td>
<td>${esc(getStatus(r))}</td>
<td>${esc(r.remarks ?? '')}</td>
</tr>`,
      )
      .join('')

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Calibration Master</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; margin:16px;}
    h1{font-size:18px; margin:0 0 12px 0;}
    table{width:100%; border-collapse:collapse; font-size:12px;}
    th,td{border:1px solid #cbd5e1; padding:8px; text-align:left; vertical-align:top;}
    th{background:#f1f5f9;}
  </style>
</head>
<body>
  <h1>Calibration Master</h1>
  <table>
    <thead>
      <tr>
        <th>Equipment</th>
        <th>Range</th>
        <th>Calibration Date</th>
        <th>Due Date</th>
        <th>Certificate</th>
        <th>Agency</th>
        <th>MU</th>
        <th>Status</th>
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

  return (
    <div className="p-6 space-y-5">
      <CalibrationMasterHeaderBar
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
            <DialogTitle>Add New Calibration</DialogTitle>
            <DialogDescription>Calibration master entry.</DialogDescription>
          </DialogHeader>
          {saveMessage && <div className="text-sm text-destructive">{saveMessage}</div>}
          <CalibrationMasterForm
            form={form}
            onChange={setForm}
            canSave={canSave}
            saveLoading={saveLoading}
            onSave={handleSave}
            onClear={handleClear}
            equipmentOptions={equipmentOptions}
            calibrationAgencies={agencyOptions}
            onPickFiles={handlePickFiles}
            onOpenFiles={handleOpenFiles}
          />
        </DialogContent>
      </Dialog>

      <CalibrationMasterTable
        rows={pagedRows}
        loading={listLoading}
        error={listError}
        selectedIds={selectedIds}
        onToggle={toggleRow}
        onToggleAll={toggleAllOnPage}
        onEdit={handleEdit}
        onCopy={handleCopy}
        getStatus={getStatus}
        onOpenFiles={handleOpenFilesRow}
      />

      <CalibrationMasterTableFooterBar
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
