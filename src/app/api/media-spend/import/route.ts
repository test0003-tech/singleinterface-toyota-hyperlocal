import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { currentMonth, previousMonth, calculatePendingInWallet } from '@/lib/validation'
import type { RecordType } from '@/lib/types'

interface ImportRow {
  recordType: string
  recordCode: string
  month: string
  metaAllocated: number
  metaUtilized: number
  googleAllocated: number
  googleUtilized: number
  notes: string | null
}

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

function parseNum(v: unknown, def = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : def
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s.toLowerCase() === 'null') return null
  return s
}

function normalizeMonth(v: unknown): string | null {
  const s = cleanStr(v)
  if (!s) return null
  // Accept "2025-01", "2025/01"
  const m = s.match(/^(\d{4})[-/](\d{1,2})$/)
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`
  const m2 = s.match(/^(\d{1,2})[-/](\d{4})$/)
  if (m2) return `${m2[2]}-${String(m2[1]).padStart(2, '0')}`
  // Handle Excel serial date numbers (e.g. 46327 = Nov 2026)
  const asNum = Number(s)
  if (!isNaN(asNum) && asNum > 30000 && asNum < 80000) {
    // Excel epoch: Dec 30, 1899
    const d = new Date(Date.UTC(1899, 11, 30) + asNum * 24 * 60 * 60 * 1000)
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    }
  }
  // Try standard date parsing
  const d2 = new Date(s)
  if (!isNaN(d2.getTime())) {
    return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`
  }
  return s // pass through, may fail validation
}

function normalizeType(v: unknown): RecordType | null {
  const s = cleanStr(v)
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower === 'si' || lower.includes('si')) return 'SI'
  if (lower.includes('spot') || lower === 'spotlight') return 'Spotlight'
  return null
}

function rowsFromSheet(
  rows: Record<string, unknown>[]
): ImportRow[] {
  const out: ImportRow[] = []
  for (const row of rows) {
    const recordCode =
      cleanStr(row['Location Code'] ?? row['Code'] ?? row['Record Code'] ?? row['recordCode'] ?? row['Client Code'] ?? row['Spotlight Code'])
    const month = normalizeMonth(row['Month'] ?? row['month'])
    // Meta fields
    const metaAllocated = parseNum(
      row['Meta Allocated'] ?? row['Meta Budget'] ?? row['metaAllocated'] ?? row['Meta Allocated Budget']
    )
    const metaUtilized = parseNum(
      row['Meta Utilized'] ?? row['Meta Spent'] ?? row['metaUtilized'] ?? row['Meta Spend']
    )
    // Google fields
    const googleAllocated = parseNum(
      row['Google Allocated'] ?? row['Google Budget'] ?? row['googleAllocated'] ?? row['Google Allocated Budget']
    )
    const googleUtilized = parseNum(
      row['Google Utilized'] ?? row['Google Spent'] ?? row['googleUtilized'] ?? row['Google Spend']
    )
    const notes = cleanStr(row['Notes'] ?? row['notes'])
    out.push({
      recordType: 'Spotlight',
      recordCode: recordCode ?? '',
      month: month ?? '',
      metaAllocated,
      metaUtilized,
      googleAllocated,
      googleUtilized,
      notes,
    })
  }
  return out
}

function rowsFromCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  // Detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(delim).map((h) => h.trim().replace(/^"|"$/g, ''))
  const objs: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((c) => c.trim().replace(/^"|"$/g, ''))
    const obj: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ''
    })
    objs.push(obj)
  }
  return rowsFromSheet(objs)
}

export async function POST(req: NextRequest) {
  try {
    let rows: ImportRow[] = []
    let mode: 'upsert' | 'replace' = 'upsert'

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const modeVal = formData.get('mode') as string | null
      if (modeVal === 'replace') mode = 'replace'
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buf, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      rows = rowsFromSheet(raw)
    } else if (contentType.includes('application/json')) {
      const body = await req.json()
      if (body?.mode === 'replace') mode = 'replace'
      if (Array.isArray(body?.rows)) {
        rows = rowsFromSheet(body.rows as Record<string, unknown>[])
      } else if (Array.isArray(body?.data)) {
        rows = rowsFromSheet(body.data as Record<string, unknown>[])
      }
    } else {
      // Try raw CSV text
      const text = await req.text()
      if (text.trim().startsWith('<')) {
        // HTML - probably an error page
        return NextResponse.json(
          { error: 'Expected file upload, JSON, or CSV text' },
          { status: 400 }
        )
      }
      rows = rowsFromCsv(text)
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in the uploaded file' },
        { status: 400 }
      )
    }

    const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }

    if (mode === 'replace') {
      await db.mediaSpend.deleteMany({})
    }

    // Sort rows by month ascending so earlier months are processed first.
    // This ensures the previous month's pendingInWallet is available when
    // calculating the current month's pendingInWallet.
    const sortedRows = [...rows].sort((a, b) => a.month.localeCompare(b.month))

    // Track pendingInWallet per location+month+platform for in-batch lookups
    const metaPendingCache = new Map<string, number>()
    const googlePendingCache = new Map<string, number>()

    for (const row of sortedRows) {
      if (!row.recordCode || !row.month) {
        result.skipped++
        continue
      }
      try {
        const rt = 'Spotlight' as RecordType
        const cacheKey = `${rt}:${row.recordCode}:${row.month}`
        const prevMonthStr = previousMonth(row.month)
        const prevCacheKey = `${rt}:${row.recordCode}:${prevMonthStr}`

        // Meta pending lookup
        let prevMetaPending = metaPendingCache.get(prevCacheKey)
        if (prevMetaPending === undefined) {
          const prevEntry = await db.mediaSpend.findUnique({
            where: {
              recordType_recordCode_month: {
                recordType: rt,
                recordCode: row.recordCode,
                month: prevMonthStr,
              },
            },
            select: { metaPendingInWallet: true },
          })
          prevMetaPending = prevEntry?.metaPendingInWallet ?? 0
        }

        // Google pending lookup
        let prevGooglePending = googlePendingCache.get(prevCacheKey)
        if (prevGooglePending === undefined) {
          const prevEntry = await db.mediaSpend.findUnique({
            where: {
              recordType_recordCode_month: {
                recordType: rt,
                recordCode: row.recordCode,
                month: prevMonthStr,
              },
            },
            select: { googlePendingInWallet: true },
          })
          prevGooglePending = prevEntry?.googlePendingInWallet ?? 0
        }

        const metaAllocated = row.metaAllocated
        const metaUtilized = row.metaUtilized
        const metaPendingInWallet = calculatePendingInWallet(metaAllocated, metaUtilized, prevMetaPending)

        const googleAllocated = row.googleAllocated
        const googleUtilized = row.googleUtilized
        const googlePendingInWallet = calculatePendingInWallet(googleAllocated, googleUtilized, prevGooglePending)

        // Totals
        const allocated = metaAllocated + googleAllocated
        const utilized = metaUtilized + googleUtilized
        const pendingInWallet = metaPendingInWallet + googlePendingInWallet

        // Store in caches for subsequent months in this batch
        metaPendingCache.set(cacheKey, metaPendingInWallet)
        googlePendingCache.set(cacheKey, googlePendingInWallet)

        const data = {
          recordType: rt,
          recordCode: row.recordCode,
          month: row.month,
          metaAllocated,
          metaUtilized,
          metaPendingInWallet,
          googleAllocated,
          googleUtilized,
          googlePendingInWallet,
          allocated,
          utilized,
          pendingInWallet,
          notes: row.notes,
        }
        const existing = await db.mediaSpend.findUnique({
          where: {
            recordType_recordCode_month: {
              recordType: rt,
              recordCode: row.recordCode,
              month: row.month,
            },
          },
        })
        if (existing && mode === 'upsert') {
          await db.mediaSpend.update({
            where: { id: existing.id },
            data,
          })
          result.updated++
        } else if (!existing) {
          await db.mediaSpend.create({ data })
          result.inserted++
        } else if (mode === 'replace') {
          await db.mediaSpend.create({ data })
          result.inserted++
        }
      } catch (e) {
        result.errors.push(
          `${row.recordType} ${row.recordCode} ${row.month}: ${
            e instanceof Error ? e.message : String(e)
          }`
        )
      }
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('Media spend import error', e)
    return NextResponse.json(
      {
        error:
          'Failed to import media spend data. ' +
          (e instanceof Error ? e.message : String(e)),
      },
      { status: 500 }
    )
  }
}

// Helper export for testing current month
export const _currentMonth = currentMonth
