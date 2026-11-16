import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { readFile } from 'fs/promises'

const DEFAULT_FILE = '/home/z/my-project/upload/Toyota Location data  (5).xlsx'

function cleanCell(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' || s === 'null' || s === 'NULL' ? null : s
}

interface ImportResult {
  si: { inserted: number; updated: number; skipped: number; errors: string[] }
  spotlight: { inserted: number; updated: number; skipped: number; errors: string[] }
}

export async function POST(req: NextRequest) {
  try {
    let filePath = DEFAULT_FILE
    let mode: 'replace' | 'upsert' = 'upsert'

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const buf = Buffer.from(bytes)
        return processWorkbook(buf, mode)
      }
    } else {
      try {
        const body = await req.json()
        if (body?.filePath) filePath = body.filePath
        if (body?.mode === 'replace' || body?.mode === 'upsert') {
          mode = body.mode
        }
      } catch {
        // no body
      }
    }

    const buf = await readFile(filePath)
    return processWorkbook(buf, mode)
  } catch (e) {
    console.error('Import error', e)
    return NextResponse.json(
      {
        error:
          'Failed to import Excel file. ' +
          (e instanceof Error ? e.message : String(e)),
      },
      { status: 500 }
    )
  }
}

async function processWorkbook(
  buf: Buffer,
  mode: 'replace' | 'upsert'
): Promise<NextResponse> {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const result: ImportResult = {
    si: { inserted: 0, updated: 0, skipped: 0, errors: [] },
    spotlight: { inserted: 0, updated: 0, skipped: 0, errors: [] },
  }

  // Process SI sheet (look for "SI data" sheet name)
  const siSheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes('si')) ??
    wb.SheetNames[0]
  if (siSheetName) {
    const ws = wb.Sheets[siSheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
    })
    if (mode === 'replace') {
      await db.sIRecord.deleteMany({})
    }
    for (const row of rows) {
      const siCode = cleanCell(row['SI Code'])
      const clientCode = cleanCell(row['Client Code'])
      if (!siCode || !clientCode) {
        result.si.skipped++
        continue
      }
      try {
        const data = {
          siCode,
          clientCode,
          businessProfileId: cleanCell(row['BUSINESS PROFILE ID']),
          businessName: cleanCell(row['BUSINESS / BRAND NAME']),
          alternativeName: cleanCell(row['ALTERNATIVE NAME']),
          circle: cleanCell(row['CIRCLE']),
          address1: cleanCell(row['ADDRESS 1']),
          address2: cleanCell(row['ADDRESS 2']),
          locality: cleanCell(row['LOCALITY']),
          landmark: cleanCell(row['LANDMARK']),
          city: cleanCell(row['CITY']),
          state: cleanCell(row['STATE']),
          postcode: cleanCell(row['POSTCODE']),
          latitude: cleanCell(row['LATITUDE']),
          longitude: cleanCell(row['LONGITUDE']),
          googlePlusPage: cleanCell(row['GOOGLE PLUS PAGE']),
          vmnSi: cleanCell(row['VMN SI']),
          weeklyOff: cleanCell(row['WEEKLY OFF']),
          businessHours: cleanCell(row['BUSINESS HOURS']),
          website: cleanCell(row['WEBSITE']),
          placeId: cleanCell(row['Place ID']),
          locationGroup: cleanCell(row['LOCATION GROUP']),
          gmbListingStatus: cleanCell(row['GMB LISTING STATUS']),
        }
        if (mode === 'replace') {
          await db.sIRecord.create({ data })
          result.si.inserted++
        } else {
          const existing = await db.sIRecord.findUnique({
            where: { siCode },
          })
          if (existing) {
            await db.sIRecord.update({ where: { siCode }, data })
            result.si.updated++
          } else {
            await db.sIRecord.create({ data })
            result.si.inserted++
          }
        }
      } catch (e) {
        result.si.errors.push(
          `SI ${siCode}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
  }

  // Process Spotlight sheet
  const spotSheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes('spotlight')) ??
    wb.SheetNames[1]
  if (spotSheetName) {
    const ws = wb.Sheets[spotSheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
    })
    if (mode === 'replace') {
      await db.spotlightRecord.deleteMany({})
    }
    for (const row of rows) {
      const clientCode = cleanCell(row['Client Code'])
      if (!clientCode) {
        result.spotlight.skipped++
        continue
      }
      try {
        const data = {
          clientCode,
          name: cleanCell(row['Name']),
          alternateName: cleanCell(row['Alternate Name']),
          internalCode: cleanCell(row['Internal Code']),
          region: cleanCell(row['Region']),
          state: cleanCell(row['State']),
          city: cleanCell(row['City']),
          country: cleanCell(row['Country']),
          pincode: cleanCell(row['Pincode']),
          locality: cleanCell(row['Locality']),
          addressLine1: cleanCell(row['Address Line 1']),
          latitude: cleanCell(row['Latitude']),
          longitude: cleanCell(row['Longitude']),
          vmn: cleanCell(row['VMN']),
          domain: cleanCell(row['Domain']),
          adAccountCid: cleanCell(row['AdAccount (CID)']),
          facebookPageId: cleanCell(row['Facebook Page ID/url']),
        }
        if (mode === 'replace') {
          await db.spotlightRecord.create({ data })
          result.spotlight.inserted++
        } else {
          const existing = await db.spotlightRecord.findUnique({
            where: { clientCode },
          })
          if (existing) {
            await db.spotlightRecord.update({
              where: { clientCode },
              data,
            })
            result.spotlight.updated++
          } else {
            await db.spotlightRecord.create({ data })
            result.spotlight.inserted++
          }
        }
      } catch (e) {
        result.spotlight.errors.push(
          `Spotlight ${clientCode}: ${
            e instanceof Error ? e.message : String(e)
          }`
        )
      }
    }
  }

  return NextResponse.json(result)
}
