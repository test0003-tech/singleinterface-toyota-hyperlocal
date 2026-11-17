import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * VMN & Mapping endpoint.
 *
 * Joins SI ↔ Spotlight locations by store code (clientCode) and exposes the
 * Virtual Mobile Number (VMN) + landing number + business hours + IVR-live
 * fields needed by the VMN Mapping page.
 *
 * - `mappings`: one row per matched location pair (SI is the source of truth
 *   for the location name / nomenclature). Includes SI VMN, Spotlight VMN,
 *   SI sales/service landing numbers, Spotlight landing number, parsed
 *   business hours per day, and the IVR-live status of each side.
 * - `extraSpotlightStores`: Spotlight records that have no matching SI store
 *   code — the SI store code is reported as "missing".
 * - `extraVmns`: records that carry a VMN but are not part of a matched
 *   SI↔Spotlight pair — VMNs still available to map to a location.
 */

// Days of week indexed by the leading number in the business-hours string.
// 1 = Monday ... 7 = Sunday (ISO weekday order).
const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface ParsedBusinessHours {
  day: number
  dayName: string
  dayFull: string
  open: string // "HH:MM"
  close: string // "HH:MM"
  raw: string
}

function parseTime(h: string, m: string): string {
  const hh = h.padStart(2, '0')
  const mm = m.padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Parse the business-hours string.
 * Expected format: "1:09:00:19:00, 2:09:00:19:00, ..."
 *   <dayNum>:<openH>:<openM>:<closeH>:<closeM>
 * Falls back gracefully to raw text if the format is unexpected.
 */
function parseBusinessHours(raw: string | null): ParsedBusinessHours[] | null {
  if (!raw || !raw.trim()) return null
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  const out: ParsedBusinessHours[] = []
  for (const part of parts) {
    const segs = part.split(':')
    if (segs.length >= 5) {
      const day = parseInt(segs[0], 10)
      if (day >= 1 && day <= 7) {
        out.push({
          day,
          dayName: DAY_NAMES[day],
          dayFull: DAY_FULL[day],
          open: parseTime(segs[1], segs[2]),
          close: parseTime(segs[3], segs[4]),
          raw: part,
        })
      }
    }
  }
  return out.length > 0 ? out : null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()
    const onlyLive = searchParams.get('live') === 'true'

    const [siRecords, spotlightRecords] = await Promise.all([
      db.sIRecord.findMany({
        select: {
          id: true,
          siCode: true,
          clientCode: true,
          businessName: true,
          city: true,
          state: true,
          circle: true,
          vmnSi: true,
          weeklyOff: true,
          businessHours: true,
          isLive: true,
          salesLandingNumbers: true,
          serviceLandingNumbers: true,
          linkedSpotlightCode: true,
        },
        orderBy: { siCode: 'asc' },
      }),
      db.spotlightRecord.findMany({
        select: {
          id: true,
          clientCode: true,
          name: true,
          city: true,
          state: true,
          region: true,
          vmn: true,
          isLive: true,
          spotlightLandingNumbers: true,
          domain: true,
        },
        orderBy: { clientCode: 'asc' },
      }),
    ])

    // Build Spotlight lookup by clientCode (the common store code).
    const spotByCode = new Map(spotlightRecords.map((s) => [s.clientCode, s]))

    interface MappingRow {
      siId: string
      siCode: string
      clientCode: string
      locationName: string | null
      city: string | null
      state: string | null
      circle: string | null
      siVmn: string | null
      spotlightVmn: string | null
      siSalesLandingNumbers: string | null
      siServiceLandingNumbers: string | null
      spotlightLandingNumbers: string | null
      businessHours: string | null
      businessHoursParsed: ParsedBusinessHours[] | null
      weeklyOff: string | null
      siIvrLive: boolean
      spotlightIvrLive: boolean | null
      spotlightId: string | null
      spotlightCode: string | null
      spotlightDomain: string | null
      matchType: 'manual' | 'auto' | 'none'
    }

    const mappings: MappingRow[] = []
    const matchedSpotCodes = new Set<string>()

    // First pass: SI records with an existing manual link to Spotlight.
    for (const si of siRecords) {
      if (si.linkedSpotlightCode) {
        const spot = spotByCode.get(si.linkedSpotlightCode)
        if (spot) {
          mappings.push({
            siId: si.id,
            siCode: si.siCode,
            clientCode: si.clientCode,
            locationName: si.businessName,
            city: si.city,
            state: si.state,
            circle: si.circle,
            siVmn: si.vmnSi,
            spotlightVmn: spot.vmn,
            siSalesLandingNumbers: si.salesLandingNumbers,
            siServiceLandingNumbers: si.serviceLandingNumbers,
            spotlightLandingNumbers: spot.spotlightLandingNumbers,
            businessHours: si.businessHours,
            businessHoursParsed: parseBusinessHours(si.businessHours),
            weeklyOff: si.weeklyOff,
            siIvrLive: si.isLive,
            spotlightIvrLive: spot.isLive,
            spotlightId: spot.id,
            spotlightCode: spot.clientCode,
            spotlightDomain: spot.domain,
            matchType: 'manual',
          })
          matchedSpotCodes.add(spot.clientCode)
          continue
        }
      }
      // No manual link — try matching by the shared store code (clientCode).
      const spot = si.clientCode ? spotByCode.get(si.clientCode) : undefined
      if (spot && !matchedSpotCodes.has(spot.clientCode)) {
        mappings.push({
          siId: si.id,
          siCode: si.siCode,
          clientCode: si.clientCode,
          locationName: si.businessName,
          city: si.city,
          state: si.state,
          circle: si.circle,
          siVmn: si.vmnSi,
          spotlightVmn: spot.vmn,
          siSalesLandingNumbers: si.salesLandingNumbers,
          siServiceLandingNumbers: si.serviceLandingNumbers,
          spotlightLandingNumbers: spot.spotlightLandingNumbers,
          businessHours: si.businessHours,
          businessHoursParsed: parseBusinessHours(si.businessHours),
          weeklyOff: si.weeklyOff,
          siIvrLive: si.isLive,
          spotlightIvrLive: spot.isLive,
          spotlightId: spot.id,
          spotlightCode: spot.clientCode,
          spotlightDomain: spot.domain,
          matchType: 'auto',
        })
        matchedSpotCodes.add(spot.clientCode)
      } else {
        // Unmatched SI record (no Spotlight counterpart).
        mappings.push({
          siId: si.id,
          siCode: si.siCode,
          clientCode: si.clientCode,
          locationName: si.businessName,
          city: si.city,
          state: si.state,
          circle: si.circle,
          siVmn: si.vmnSi,
          spotlightVmn: null,
          siSalesLandingNumbers: si.salesLandingNumbers,
          siServiceLandingNumbers: si.serviceLandingNumbers,
          spotlightLandingNumbers: null,
          businessHours: si.businessHours,
          businessHoursParsed: parseBusinessHours(si.businessHours),
          weeklyOff: si.weeklyOff,
          siIvrLive: si.isLive,
          spotlightIvrLive: null,
          spotlightId: null,
          spotlightCode: null,
          spotlightDomain: null,
          matchType: 'none',
        })
      }
    }

    // Extra stores in Spotlight: Spotlight records with no matching SI store code.
    const extraSpotlightStores = spotlightRecords
      .filter((s) => !matchedSpotCodes.has(s.clientCode))
      .map((s) => ({
        id: s.id,
        spotlightCode: s.clientCode,
        storeCodeMissing: true, // SI store code is missing
        locationName: s.name,
        city: s.city,
        state: s.state,
        region: s.region,
        spotlightVmn: s.vmn,
        spotlightLandingNumbers: s.spotlightLandingNumbers,
        spotlightIvrLive: s.isLive,
        spotlightDomain: s.domain,
      }))

    // Extra VMNs available to map: records that carry a VMN but are NOT part of
    // a matched SI↔Spotlight pair. These are VMNs whose "rest of the data"
    // (the counterpart location) is not mapped yet.
    const extraVmns: {
      vmn: string
      source: 'SI' | 'Spotlight'
      storeCode: string
      locationName: string | null
      city: string | null
      state: string | null
      ivrLive: boolean
    }[] = []

    // SI records with a VMN but no Spotlight counterpart.
    for (const m of mappings) {
      if (m.matchType === 'none' && m.siVmn) {
        extraVmns.push({
          vmn: m.siVmn,
          source: 'SI',
          storeCode: m.clientCode || m.siCode,
          locationName: m.locationName,
          city: m.city,
          state: m.state,
          ivrLive: m.siIvrLive,
        })
      }
    }
    // Spotlight records with a VMN but no SI counterpart (extra stores).
    for (const s of extraSpotlightStores) {
      if (s.spotlightVmn) {
        extraVmns.push({
          vmn: s.spotlightVmn,
          source: 'Spotlight',
          storeCode: s.spotlightCode,
          locationName: s.locationName,
          city: s.city,
          state: s.state,
          ivrLive: s.spotlightIvrLive,
        })
      }
    }

    // Apply search filter to mappings.
    let filteredMappings = mappings
    if (search) {
      filteredMappings = mappings.filter(
        (m) =>
          m.locationName?.toLowerCase().includes(search) ||
          m.siCode.toLowerCase().includes(search) ||
          m.clientCode.toLowerCase().includes(search) ||
          m.city?.toLowerCase().includes(search) ||
          m.state?.toLowerCase().includes(search) ||
          m.siVmn?.toLowerCase().includes(search) ||
          m.spotlightVmn?.toLowerCase().includes(search) ||
          m.spotlightCode?.toLowerCase().includes(search)
      )
    }
    if (onlyLive) {
      filteredMappings = filteredMappings.filter((m) => m.siIvrLive || m.spotlightIvrLive === true)
    }

    const summary = {
      totalSI: siRecords.length,
      totalSpotlight: spotlightRecords.length,
      matchedPairs: mappings.filter((m) => m.matchType !== 'none').length,
      manuallyLinked: mappings.filter((m) => m.matchType === 'manual').length,
      autoMatched: mappings.filter((m) => m.matchType === 'auto').length,
      unmatchedSI: mappings.filter((m) => m.matchType === 'none').length,
      extraSpotlightStores: extraSpotlightStores.length,
      extraVmns: extraVmns.length,
      siWithVmn: siRecords.filter((r) => r.vmnSi).length,
      spotlightWithVmn: spotlightRecords.filter((r) => r.vmn).length,
      siIvrLive: siRecords.filter((r) => r.isLive).length,
      spotlightIvrLive: spotlightRecords.filter((r) => r.isLive).length,
    }

    return NextResponse.json({
      mappings: filteredMappings,
      extraSpotlightStores,
      extraVmns,
      summary,
    })
  } catch (e) {
    console.error('VMN mapping error', e)
    return NextResponse.json({ error: 'Failed to fetch VMN mapping' }, { status: 500 })
  }
}
