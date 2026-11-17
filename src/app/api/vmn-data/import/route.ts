import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { normalizeLandingNumbers } from '@/lib/validation'
import { auditLog, diffChanges } from '@/lib/audit'

/**
 * VMN Data Excel import.
 *
 * Expected columns (case-insensitive header matching):
 *   STORE CODE / CLIENT CODE / SI CODE   -> the common store code
 *   SI VMN / VMN SI                       -> SIRecord.vmnSi
 *   SPOTLIGHT VMN / VMN SPOTLIGHT         -> SpotlightRecord.vmn
 *   SI SALES LANDING / SALES LANDING NUMBERS -> SIRecord.salesLandingNumbers
 *   SI SERVICE LANDING / SERVICE LANDING NUMBERS -> SIRecord.serviceLandingNumbers
 *   SPOTLIGHT LANDING / SPOTLIGHT LANDING NUMBERS -> SpotlightRecord.spotlightLandingNumbers
 *
 * Only the columns present in the sheet are updated. A row with no store code
 * is skipped. If a VMN cell is empty, the existing VMN on that side is cleared.
 */

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

function cleanCell(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s.toLowerCase() === 'null') return null
  return s
}

// Normalize a VMN value (keep leading + if present, strip other formatting).
function normalizeVmn(v: string | null): string | null {
  if (!v) return null
  return v.replace(/\s+/g, '')
}

// Case-insensitive header lookup with multiple aliases.
function pickColumn(
  row: Record<string, unknown>,
  aliases: string[]
): unknown {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const k = keys.find(
      (key) => key.trim().toLowerCase() === alias.toLowerCase()
    )
    if (k !== undefined && row[k] !== null && row[k] !== undefined) return row[k]
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const buf = Buffer.from(bytes)
    const wb = XLSX.read(buf, { type: 'buffer' })

    // Use the first sheet (or one named "VMN").
    const sheetName =
      wb.SheetNames.find((n) => n.toLowerCase().includes('vmn')) ??
      wb.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json(
        { error: 'No sheet found in workbook' },
        { status: 400 }
      )
    }
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
    })

    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    }

    // Cache records to avoid N queries; build lookup maps by store code.
    const [siRecords, spotlightRecords] = await Promise.all([
      db.sIRecord.findMany({
        select: {
          id: true,
          siCode: true,
          clientCode: true,
          vmnSi: true,
          salesLandingNumbers: true,
          serviceLandingNumbers: true,
        },
      }),
      db.spotlightRecord.findMany({
        select: {
          id: true,
          clientCode: true,
          vmn: true,
          spotlightLandingNumbers: true,
        },
      }),
    ])
    const siByCode = new Map<string, (typeof siRecords)[0]>()
    for (const si of siRecords) {
      siByCode.set(si.siCode.toLowerCase(), si)
      if (si.clientCode) siByCode.set(si.clientCode.toLowerCase(), si)
    }
    const spotByCode = new Map<string, (typeof spotlightRecords)[0]>()
    for (const spot of spotlightRecords) {
      spotByCode.set(spot.clientCode.toLowerCase(), spot)
    }

    for (const [idx, row] of rows.entries()) {
      const rowNum = idx + 2 // header is row 1
      const storeCode = cleanCell(
        pickColumn(row, [
          'Store Code',
          'STORE CODE',
          'Client Code',
          'CLIENT CODE',
          'SI Code',
          'SI CODE',
          'Code',
        ])
      )
      if (!storeCode) {
        result.skipped++
        result.errors.push(`Row ${rowNum}: missing store code`)
        continue
      }

      const siVmn = normalizeVmn(
        cleanCell(pickColumn(row, ['SI VMN', 'VMN SI', 'SI VMN SI']))
      )
      const spotlightVmn = normalizeVmn(
        cleanCell(
          pickColumn(row, ['Spotlight VMN', 'VMN Spotlight', 'Spotlight VMN Number'])
        )
      )
      const siSalesLanding = cleanCell(
        pickColumn(row, [
          'SI Sales Landing',
          'Sales Landing Numbers',
          'Sales Landing',
        ])
      )
      const siServiceLanding = cleanCell(
        pickColumn(row, [
          'SI Service Landing',
          'Service Landing Numbers',
          'Service Landing',
        ])
      )
      const spotlightLanding = cleanCell(
        pickColumn(row, [
          'Spotlight Landing',
          'Spotlight Landing Numbers',
        ])
      )

      // At least one field must be present in the row to count as an update.
      const hasAny =
        siVmn !== null ||
        spotlightVmn !== null ||
        siSalesLanding !== null ||
        siServiceLanding !== null ||
        spotlightLanding !== null
      if (!hasAny) {
        result.skipped++
        result.errors.push(`Row ${rowNum} (${storeCode}): no VMN data in row`)
        continue
      }

      let rowUpdated = false

      // --- SI side ---
      const si = siByCode.get(storeCode.toLowerCase())
      if (si) {
        const patch: Record<string, string | null> = {}
        // Note: a VMN column being null means "clear", so we only clear when
        // the column was actually present in the sheet. We detect presence
        // by checking whether pickColumn returned something other than undefined.
        const siVmnCell = pickColumn(row, ['SI VMN', 'VMN SI', 'SI VMN SI'])
        if (siVmnCell !== undefined) patch.vmnSi = siVmn
        const salesCell = pickColumn(row, [
          'SI Sales Landing',
          'Sales Landing Numbers',
          'Sales Landing',
        ])
        if (salesCell !== undefined)
          patch.salesLandingNumbers = normalizeLandingNumbers(siSalesLanding)
        const serviceCell = pickColumn(row, [
          'SI Service Landing',
          'Service Landing Numbers',
          'Service Landing',
        ])
        if (serviceCell !== undefined)
          patch.serviceLandingNumbers = normalizeLandingNumbers(siServiceLanding)

        if (Object.keys(patch).length > 0) {
          const before = {
            vmnSi: si.vmnSi,
            salesLandingNumbers: si.salesLandingNumbers,
            serviceLandingNumbers: si.serviceLandingNumbers,
          }
          await db.sIRecord.update({ where: { id: si.id }, data: patch })
          await auditLog({
            action: 'update',
            entityType: 'SI',
            entityId: si.id,
            entityCode: si.siCode,
            changes: diffChanges(before, { ...before, ...patch }),
            summary: `VMN data imported for ${si.siCode}`,
          })
          rowUpdated = true
        }
      } else {
        result.errors.push(
          `Row ${rowNum} (${storeCode}): no SI record with this store code — SI VMN skipped`
        )
      }

      // --- Spotlight side ---
      const spot = spotByCode.get(storeCode.toLowerCase())
      if (spot) {
        const patch: Record<string, string | null> = {}
        const spotVmnCell = pickColumn(row, [
          'Spotlight VMN',
          'VMN Spotlight',
          'Spotlight VMN Number',
        ])
        if (spotVmnCell !== undefined) patch.vmn = spotlightVmn
        const spotLandingCell = pickColumn(row, [
          'Spotlight Landing',
          'Spotlight Landing Numbers',
        ])
        if (spotLandingCell !== undefined)
          patch.spotlightLandingNumbers =
            normalizeLandingNumbers(spotlightLanding)

        if (Object.keys(patch).length > 0) {
          const before = {
            vmn: spot.vmn,
            spotlightLandingNumbers: spot.spotlightLandingNumbers,
          }
          await db.spotlightRecord.update({ where: { id: spot.id }, data: patch })
          await auditLog({
            action: 'update',
            entityType: 'Spotlight',
            entityId: spot.id,
            entityCode: spot.clientCode,
            changes: diffChanges(before, { ...before, ...patch }),
            summary: `VMN data imported for ${spot.clientCode}`,
          })
          rowUpdated = true
        }
      } else {
        result.errors.push(
          `Row ${rowNum} (${storeCode}): no Spotlight record with this store code — Spotlight VMN skipped`
        )
      }

      if (rowUpdated) {
        result.updated++
      } else {
        result.skipped++
      }
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('VMN import error', e)
    return NextResponse.json(
      {
        error:
          'Failed to import VMN Excel file. ' +
          (e instanceof Error ? e.message : String(e)),
      },
      { status: 500 }
    )
  }
}
