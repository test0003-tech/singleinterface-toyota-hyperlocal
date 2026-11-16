import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import type { RecordType } from '@/lib/types'

const DEFAULT_BASE = 8060
const DEFAULT_GST_RATE = 18

interface ImportRow {
  recordType: string
  recordCode: string
  month: string
  baseAmount: number
  gstRate: number
  isPaid: boolean
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
  const m = s.match(/^(\d{4})[-/](\d{1,2})$/)
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`
  const m2 = s.match(/^(\d{1,2})[-/](\d{4})$/)
  if (m2) return `${m2[2]}-${String(m2[1]).padStart(2, '0')}`
  // Handle Excel serial date numbers (e.g. 46327 = Nov 2026)
  const asNum = Number(s)
  if (!isNaN(asNum) && asNum > 30000 && asNum < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + asNum * 24 * 60 * 60 * 1000)
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    }
  }
  const d2 = new Date(s)
  if (!isNaN(d2.getTime())) {
    return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`
  }
  return s
}

function normalizeType(v: unknown): RecordType | null {
  const s = cleanStr(v)
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower === 'si' || lower.includes('si')) return 'SI'
  if (lower.includes('spot') || lower === 'spotlight') return 'Spotlight'
  return null
}

function normalizePaid(v: unknown): boolean {
  const s = cleanStr(v)
  if (!s) return false
  const lower = s.toLowerCase()
  return lower === 'paid' || lower === 'true' || lower === 'yes' || lower === '1'
}

function computeAmounts(baseAmount: number, gstRate: number) {
  const gstAmount = +(baseAmount * (gstRate / 100)).toFixed(2)
  const totalAmount = +(baseAmount + gstAmount).toFixed(2)
  return { gstAmount, totalAmount }
}

function rowsFromSheet(rows: Record<string, unknown>[]): ImportRow[] {
  const out: ImportRow[] = []
  for (const row of rows) {
    const recordType =
      normalizeType(row['Location Type'] ?? row['Type'] ?? row['Record Type']) ??
      (row['recordType'] ? normalizeType(row['recordType']) : null)
    const recordCode = cleanStr(
      row['Location Code'] ?? row['Code'] ?? row['Record Code'] ?? row['recordCode'] ?? row['SI Code'] ?? row['Client Code']
    )
    const month = normalizeMonth(row['Month'] ?? row['month'])
    const baseAmount =
      row['Base Amount'] !== undefined || row['Base'] !== undefined
        ? parseNum(row['Base Amount'] ?? row['Base'] ?? row['baseAmount'])
        : DEFAULT_BASE
    const gstRate =
      row['GST Rate'] !== undefined || row['GST'] !== undefined
        ? parseNum(row['GST Rate'] ?? row['GST'] ?? row['gstRate'])
        : DEFAULT_GST_RATE
    const isPaid = normalizePaid(row['Status'] ?? row['Is Paid'] ?? row['isPaid'] ?? row['Paid'])
    const notes = cleanStr(row['Notes'] ?? row['notes'])
    out.push({
      recordType: recordType ?? '',
      recordCode: recordCode ?? '',
      month: month ?? '',
      baseAmount: baseAmount || DEFAULT_BASE,
      gstRate: gstRate || DEFAULT_GST_RATE,
      isPaid,
      notes,
    })
  }
  return out
}

function rowsFromCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
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
      const text = await req.text()
      if (text.trim().startsWith('<')) {
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
      await db.platformFee.deleteMany({})
    }

    for (const row of rows) {
      const rt = row.recordType as RecordType
      if (rt !== 'SI' && rt !== 'Spotlight') {
        result.skipped++
        continue
      }
      if (!row.recordCode || !row.month) {
        result.skipped++
        continue
      }
      try {
        const { gstAmount, totalAmount } = computeAmounts(
          row.baseAmount,
          row.gstRate
        )
        const existing = await db.platformFee.findUnique({
          where: {
            recordType_recordCode_month: {
              recordType: rt,
              recordCode: row.recordCode,
              month: row.month,
            },
          },
        })
        const data = {
          recordType: rt,
          recordCode: row.recordCode,
          month: row.month,
          baseAmount: row.baseAmount,
          gstRate: row.gstRate,
          gstAmount,
          totalAmount,
          isPaid: row.isPaid,
          paidAt: row.isPaid ? new Date() : null,
          notes: row.notes,
        }
        if (existing && mode === 'upsert') {
          await db.platformFee.update({
            where: { id: existing.id },
            data,
          })
          result.updated++
        } else if (!existing) {
          await db.platformFee.create({ data })
          result.inserted++
        } else if (mode === 'replace') {
          await db.platformFee.create({ data })
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
    console.error('Platform fee import error', e)
    return NextResponse.json(
      {
        error:
          'Failed to import platform fee data. ' +
          (e instanceof Error ? e.message : String(e)),
      },
      { status: 500 }
    )
  }
}

export const _defaults = { DEFAULT_BASE, DEFAULT_GST_RATE }
