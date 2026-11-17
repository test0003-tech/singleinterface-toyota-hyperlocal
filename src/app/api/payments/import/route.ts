import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { auditLog } from '@/lib/audit'
import type { PaymentMethod } from '@/lib/types'
import { recalcFeePayment } from '../route'

/**
 * Payments Excel/CSV import.
 *
 * Expected columns (case-insensitive header matching):
 *   INVOICE NUMBER / INVOICE #      -> matches PlatformFee.invoiceNumber
 *   STORE CODE / RECORD CODE / CODE -> matches PlatformFee.recordCode
 *   MONTH (YYYY-MM)                 -> matches PlatformFee.month
 *   AMOUNT                          -> payment amount (required)
 *   METHOD                          -> bank_transfer|cheque|upi|cash|card|other
 *   REFERENCE / TRANSACTION ID       -> payment reference
 *   PAID DATE / DATE (YYYY-MM-DD)   -> paidDate
 *   NOTES                           -> optional notes
 *
 * The fee is located by (recordType, recordCode, month) OR by invoiceNumber.
 * recordType is auto-detected: "Spotlight" if the code matches a Spotlight
 * client code, otherwise "SI". If both invoice and store code+month are
 * provided, invoice number takes precedence.
 */

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

const VALID_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'cheque',
  'upi',
  'cash',
  'card',
  'other',
]

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s.toLowerCase() === 'null') return null
  return s
}

function parseNum(v: unknown, def = 0): number {
  const n =
    typeof v === 'string'
      ? parseFloat(v.replace(/[,₹\s]/g, ''))
      : typeof v === 'number'
        ? v
        : NaN
  return Number.isFinite(n) ? n : def
}

function pickColumn(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const k = keys.find((key) => key.trim().toLowerCase() === alias.toLowerCase())
    if (k !== undefined && row[k] !== null && row[k] !== undefined) return row[k]
  }
  return undefined
}

function parseDate(v: unknown): Date | null {
  const s = cleanStr(v)
  if (!s) return null
  // ISO date YYYY-MM-DD
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}T00:00:00`)
    if (!isNaN(d.getTime())) return d
  }
  // Excel serial date
  const asNum = Number(s)
  if (!isNaN(asNum) && asNum > 30000 && asNum < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + asNum * 24 * 60 * 60 * 1000)
    if (!isNaN(d.getTime())) return d
  }
  const d2 = new Date(s)
  if (!isNaN(d2.getTime())) return d2
  return null
}

function normalizeMethod(v: unknown): PaymentMethod {
  const s = cleanStr(v)?.toLowerCase().replace(/[\s-]/g, '_')
  if (!s) return 'bank_transfer'
  if (VALID_METHODS.includes(s as PaymentMethod)) return s as PaymentMethod
  // Common aliases
  if (s.includes('bank') || s.includes('transfer') || s.includes('rtgs') || s.includes('neft')) return 'bank_transfer'
  if (s.includes('cheque') || s.includes('check')) return 'cheque'
  if (s.includes('upi')) return 'upi'
  if (s.includes('cash')) return 'cash'
  if (s.includes('card') || s.includes('credit') || s.includes('debit')) return 'card'
  return 'other'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const mode = (formData.get('mode') as string) === 'replace' ? 'replace' : 'upsert'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const buf = Buffer.from(bytes)
    const wb = XLSX.read(buf, { type: 'buffer' })

    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheet found in workbook' }, { status: 400 })
    }
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

    if (mode === 'replace') {
      await db.payment.deleteMany({})
    }

    // Cache all platform fees for lookup
    const allFees = await db.platformFee.findMany({
      select: {
        id: true,
        recordType: true,
        recordCode: true,
        month: true,
        invoiceNumber: true,
        totalAmount: true,
      },
    })
    const feeByInvoice = new Map<string, (typeof allFees)[0]>()
    const feeByCodeMonth = new Map<string, (typeof allFees)[0]>()
    for (const f of allFees) {
      if (f.invoiceNumber) feeByInvoice.set(f.invoiceNumber.toLowerCase(), f)
      feeByCodeMonth.set(`${f.recordType}:${f.recordCode}:${f.month}`, f)
      // Also index by code+month without type for fallback
      feeByCodeMonth.set(`${f.recordCode}:${f.month}`, f)
    }
    // Spotlight codes for type detection
    const spotlightCodes = new Set(
      (await db.spotlightRecord.findMany({ select: { clientCode: true } })).map(
        (s) => s.clientCode.toLowerCase()
      )
    )

    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    }

    for (const [idx, row] of rows.entries()) {
      const rowNum = idx + 2
      const amount = parseNum(
        pickColumn(row, ['Amount', 'AMOUNT', 'Payment Amount', 'Paid Amount'])
      )
      if (amount <= 0) {
        result.skipped++
        result.errors.push(`Row ${rowNum}: missing or invalid amount`)
        continue
      }

      // Find the platform fee
      let fee: (typeof allFees)[0] | undefined
      const invoiceNumber = cleanStr(
        pickColumn(row, ['Invoice Number', 'INVOICE #', 'Invoice #', 'Invoice', 'INV #'])
      )
      if (invoiceNumber) {
        fee = feeByInvoice.get(invoiceNumber.toLowerCase())
      }
      if (!fee) {
        const storeCode = cleanStr(
          pickColumn(row, ['Store Code', 'STORE CODE', 'Record Code', 'Code', 'Client Code'])
        )
        const month = cleanStr(pickColumn(row, ['Month', 'MONTH', 'Period']))
        if (storeCode && month) {
          // Try with type detection
          const recordType = spotlightCodes.has(storeCode.toLowerCase())
            ? 'Spotlight'
            : 'SI'
          fee =
            feeByCodeMonth.get(`${recordType}:${storeCode}:${month}`) ??
            feeByCodeMonth.get(`${storeCode}:${month}`)
        }
      }

      if (!fee) {
        result.skipped++
        result.errors.push(
          `Row ${rowNum}: no platform fee found for invoice "${invoiceNumber ?? '—'}" — payment skipped`
        )
        continue
      }

      const method = normalizeMethod(pickColumn(row, ['Method', 'Payment Method', 'Mode']))
      const reference = cleanStr(
        pickColumn(row, ['Reference', 'Transaction ID', 'Ref', 'Cheque No', 'UTR'])
      )
      const paidDate = parseDate(pickColumn(row, ['Paid Date', 'Date', 'Payment Date'])) ?? new Date()
      const notes = cleanStr(pickColumn(row, ['Notes', 'Remarks']))

      // In replace mode or upsert mode, we create new payment records.
      // (Payments don't have a natural unique key, so each row creates a new payment.)
      const created = await db.payment.create({
        data: {
          platformFeeId: fee.id,
          amount,
          method,
          reference,
          paidDate,
          notes,
        },
      })

      await recalcFeePayment(fee.id)

      await auditLog({
        action: 'create',
        entityType: 'Payment',
        entityId: created.id,
        entityCode: reference ?? fee.invoiceNumber ?? fee.recordCode,
        summary: `Payment of ₹${amount} imported for ${fee.recordType} ${fee.recordCode} (${fee.month})`,
      })
      result.inserted++
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('Payments import error', e)
    return NextResponse.json(
      {
        error:
          'Failed to import payments. ' + (e instanceof Error ? e.message : String(e)),
      },
      { status: 500 }
    )
  }
}
