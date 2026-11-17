import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog, diffChanges } from '@/lib/audit'

/**
 * VMN Data management.
 *
 * VMNs are stored as fields on the SI and Spotlight records:
 *   - SIRecord.vmnSi                 (the VMN used on the SingleInterface side)
 *   - SIRecord.salesLandingNumbers   (comma-separated 10-digit mobile numbers)
 *   - SIRecord.serviceLandingNumbers
 *   - SpotlightRecord.vmn           (the VMN used on the Spotlight side)
 *   - SpotlightRecord.spotlightLandingNumbers
 *
 * A VMN number is considered "live" when it is mapped on BOTH the SI side and
 * the Spotlight side (i.e. the same number appears in some SIRecord.vmnSi and
 * some SpotlightRecord.vmn). Otherwise it is "si_only" or "spotlight_only".
 *
 * Endpoints:
 *   GET    /api/vmn-data                 -> aggregated list of unique VMNs with status
 *   POST   /api/vmn-data                 -> assign a VMN to a location by store code + side
 *   DELETE /api/vmn-data?storeCode=&side= -> remove (clear) a VMN assignment
 */

type VmnStatus = 'live' | 'si_only' | 'spotlight_only'

interface VmnAssignment {
  vmn: string
  status: VmnStatus
  si?: {
    siCode: string
    clientCode: string
    businessName: string | null
    city: string | null
    state: string | null
    isLive: boolean
  } | null
  spotlight?: {
    clientCode: string
    name: string | null
    city: string | null
    state: string | null
    isLive: boolean
  } | null
}

function cleanVmn(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s.toLowerCase() === 'null') return null
  return s
}

export async function GET() {
  try {
    const [siRecords, spotlightRecords] = await Promise.all([
      db.sIRecord.findMany({
        select: {
          id: true,
          siCode: true,
          clientCode: true,
          businessName: true,
          city: true,
          state: true,
          vmnSi: true,
          salesLandingNumbers: true,
          serviceLandingNumbers: true,
          isLive: true,
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
          vmn: true,
          spotlightLandingNumbers: true,
          isLive: true,
        },
        orderBy: { clientCode: 'asc' },
      }),
    ])

    // Group records by their VMN number.
    const vmnMap = new Map<
      string,
      {
        si: VmnAssignment['si'] & { id: string } | null
        spotlight: VmnAssignment['spotlight'] & { id: string } | null
      }
    >()

    for (const si of siRecords) {
      const vmn = cleanVmn(si.vmnSi)
      if (!vmn) continue
      let entry = vmnMap.get(vmn)
      if (!entry) {
        entry = { si: null, spotlight: null }
        vmnMap.set(vmn, entry)
      }
      // Keep the first SI record that uses this VMN (VMNs are typically 1:1).
      if (!entry.si) {
        entry.si = {
          id: si.id,
          siCode: si.siCode,
          clientCode: si.clientCode,
          businessName: si.businessName,
          city: si.city,
          state: si.state,
          isLive: si.isLive,
        }
      }
    }

    for (const spot of spotlightRecords) {
      const vmn = cleanVmn(spot.vmn)
      if (!vmn) continue
      let entry = vmnMap.get(vmn)
      if (!entry) {
        entry = { si: null, spotlight: null }
        vmnMap.set(vmn, entry)
      }
      if (!entry.spotlight) {
        entry.spotlight = {
          id: spot.id,
          clientCode: spot.clientCode,
          name: spot.name,
          city: spot.city,
          state: spot.state,
          isLive: spot.isLive,
        }
      }
    }

    const assignments: VmnAssignment[] = Array.from(vmnMap.entries()).map(
      ([vmn, entry]) => {
        const status: VmnStatus =
          entry.si && entry.spotlight
            ? 'live'
            : entry.si
              ? 'si_only'
              : 'spotlight_only'
        return {
          vmn,
          status,
          si: entry.si
            ? {
                siCode: entry.si.siCode,
                clientCode: entry.si.clientCode,
                businessName: entry.si.businessName,
                city: entry.si.city,
                state: entry.si.state,
                isLive: entry.si.isLive,
              }
            : null,
          spotlight: entry.spotlight
            ? {
                clientCode: entry.spotlight.clientCode,
                name: entry.spotlight.name,
                city: entry.spotlight.city,
                state: entry.spotlight.state,
                isLive: entry.spotlight.isLive,
              }
            : null,
        }
      }
    )

    // Sort: live first, then si_only, then spotlight_only, then by VMN.
    const statusOrder: Record<VmnStatus, number> = {
      live: 0,
      si_only: 1,
      spotlight_only: 2,
    }
    assignments.sort((a, b) => {
      const so = statusOrder[a.status] - statusOrder[b.status]
      if (so !== 0) return so
      return a.vmn.localeCompare(b.vmn)
    })

    const summary = {
      totalVmns: assignments.length,
      live: assignments.filter((a) => a.status === 'live').length,
      siOnly: assignments.filter((a) => a.status === 'si_only').length,
      spotlightOnly: assignments.filter((a) => a.status === 'spotlight_only').length,
      siWithoutVmn: siRecords.filter((r) => !cleanVmn(r.vmnSi)).length,
      spotlightWithoutVmn: spotlightRecords.filter((r) => !cleanVmn(r.vmn)).length,
    }

    return NextResponse.json({ assignments, summary })
  } catch (e) {
    console.error('VMN data GET error', e)
    return NextResponse.json({ error: 'Failed to fetch VMN data' }, { status: 500 })
  }
}

/**
 * Assign a VMN (and optional landing numbers) to a location by store code.
 * Body: {
 *   storeCode: string,
 *   side?: 'SI' | 'Spotlight' | 'both',  // default 'both'
 *   siVmn?: string | null,
 *   spotlightVmn?: string | null,
 *   siSalesLandingNumbers?: string | null,
 *   siServiceLandingNumbers?: string | null,
 *   spotlightLandingNumbers?: string | null,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const storeCode = cleanVmn(body?.storeCode)
    if (!storeCode) {
      return NextResponse.json(
        { error: 'storeCode is required' },
        { status: 400 }
      )
    }
    const side: 'SI' | 'Spotlight' | 'both' =
      body?.side === 'SI' || body?.side === 'Spotlight' ? body.side : 'both'

    const siVmn = cleanVmn(body?.siVmn)
    const spotlightVmn = cleanVmn(body?.spotlightVmn)
    const siSalesLanding = cleanVmn(body?.siSalesLandingNumbers)
    const siServiceLanding = cleanVmn(body?.siServiceLandingNumbers)
    const spotlightLanding = cleanVmn(body?.spotlightLandingNumbers)

    const updated: { si?: string; spotlight?: string } = {}

    // Update SI side.
    if (side === 'SI' || side === 'both') {
      const si = await db.sIRecord.findFirst({
        where: {
          OR: [{ siCode: storeCode }, { clientCode: storeCode }],
        },
        select: {
          id: true,
          siCode: true,
          vmnSi: true,
          salesLandingNumbers: true,
          serviceLandingNumbers: true,
        },
      })
      if (!si) {
        if (side === 'SI') {
          return NextResponse.json(
            { error: `No SI record found for store code "${storeCode}"` },
            { status: 404 }
          )
        }
      } else {
        const patch: Record<string, string | null> = {}
        if (body?.siVmn !== undefined) patch.vmnSi = siVmn
        if (body?.siSalesLandingNumbers !== undefined)
          patch.salesLandingNumbers = siSalesLanding
        if (body?.siServiceLandingNumbers !== undefined)
          patch.serviceLandingNumbers = siServiceLanding
        if (Object.keys(patch).length > 0) {
          const before = {
            vmnSi: si.vmnSi,
            salesLandingNumbers: si.salesLandingNumbers,
            serviceLandingNumbers: si.serviceLandingNumbers,
          }
          await db.sIRecord.update({
            where: { id: si.id },
            data: patch,
          })
          await auditLog({
            action: 'update',
            entityType: 'SI',
            entityId: si.id,
            entityCode: si.siCode,
            changes: diffChanges(before, { ...before, ...patch }),
            summary: `VMN data updated for ${si.siCode}`,
          })
          updated.si = si.siCode
        }
      }
    }

    // Update Spotlight side.
    if (side === 'Spotlight' || side === 'both') {
      const spot = await db.spotlightRecord.findFirst({
        where: { clientCode: storeCode },
        select: {
          id: true,
          clientCode: true,
          vmn: true,
          spotlightLandingNumbers: true,
        },
      })
      if (!spot) {
        if (side === 'Spotlight') {
          return NextResponse.json(
            { error: `No Spotlight record found for store code "${storeCode}"` },
            { status: 404 }
          )
        }
      } else {
        const patch: Record<string, string | null> = {}
        if (body?.spotlightVmn !== undefined) patch.vmn = spotlightVmn
        if (body?.spotlightLandingNumbers !== undefined)
          patch.spotlightLandingNumbers = spotlightLanding
        if (Object.keys(patch).length > 0) {
          const before = {
            vmn: spot.vmn,
            spotlightLandingNumbers: spot.spotlightLandingNumbers,
          }
          await db.spotlightRecord.update({
            where: { id: spot.id },
            data: patch,
          })
          await auditLog({
            action: 'update',
            entityType: 'Spotlight',
            entityId: spot.id,
            entityCode: spot.clientCode,
            changes: diffChanges(before, { ...before, ...patch }),
            summary: `VMN data updated for ${spot.clientCode}`,
          })
          updated.spotlight = spot.clientCode
        }
      }
    }

    if (!updated.si && !updated.spotlight) {
      return NextResponse.json(
        { error: 'No matching record found for the given store code' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `VMN data updated for ${[updated.si, updated.spotlight]
        .filter(Boolean)
        .join(', ')}`,
    })
  } catch (e) {
    console.error('VMN data POST error', e)
    return NextResponse.json({ error: 'Failed to assign VMN' }, { status: 500 })
  }
}

/**
 * Remove (clear) a VMN assignment from a record.
 * Query: ?storeCode=&side=SI|Spotlight|both
 *   - side=SI clears vmnSi (and optionally landing numbers if clearLanding=1)
 *   - side=Spotlight clears vmn
 *   - side=both clears both sides
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const storeCode = cleanVmn(searchParams.get('storeCode'))
    if (!storeCode) {
      return NextResponse.json(
        { error: 'storeCode query parameter is required' },
        { status: 400 }
      )
    }
    const side: 'SI' | 'Spotlight' | 'both' =
      searchParams.get('side') === 'SI' ||
      searchParams.get('side') === 'Spotlight'
        ? (searchParams.get('side') as 'SI' | 'Spotlight')
        : 'both'
    const clearLanding = searchParams.get('clearLanding') === '1'

    const cleared: { si?: string; spotlight?: string } = {}

    if (side === 'SI' || side === 'both') {
      const si = await db.sIRecord.findFirst({
        where: {
          OR: [{ siCode: storeCode }, { clientCode: storeCode }],
        },
        select: { id: true, siCode: true, vmnSi: true, salesLandingNumbers: true, serviceLandingNumbers: true },
      })
      if (si) {
        const patch: Record<string, null> = { vmnSi: null }
        if (clearLanding) {
          patch.salesLandingNumbers = null
          patch.serviceLandingNumbers = null
        }
        const before = {
          vmnSi: si.vmnSi,
          salesLandingNumbers: si.salesLandingNumbers,
          serviceLandingNumbers: si.serviceLandingNumbers,
        }
        await db.sIRecord.update({ where: { id: si.id }, data: patch })
        await auditLog({
          action: 'delete',
          entityType: 'SI',
          entityId: si.id,
          entityCode: si.siCode,
          changes: diffChanges(before, { ...before, ...patch }),
          summary: `VMN data deleted for ${si.siCode}`,
        })
        cleared.si = si.siCode
      }
    }

    if (side === 'Spotlight' || side === 'both') {
      const spot = await db.spotlightRecord.findFirst({
        where: { clientCode: storeCode },
        select: { id: true, clientCode: true, vmn: true, spotlightLandingNumbers: true },
      })
      if (spot) {
        const patch: Record<string, null> = { vmn: null }
        if (clearLanding) patch.spotlightLandingNumbers = null
        const before = { vmn: spot.vmn, spotlightLandingNumbers: spot.spotlightLandingNumbers }
        await db.spotlightRecord.update({ where: { id: spot.id }, data: patch })
        await auditLog({
          action: 'delete',
          entityType: 'Spotlight',
          entityId: spot.id,
          entityCode: spot.clientCode,
          changes: diffChanges(before, { ...before, ...patch }),
          summary: `VMN data deleted for ${spot.clientCode}`,
        })
        cleared.spotlight = spot.clientCode
      }
    }

    if (!cleared.si && !cleared.spotlight) {
      return NextResponse.json(
        { error: 'No matching record found for the given store code' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      cleared,
      message: `VMN data cleared for ${[cleared.si, cleared.spotlight]
        .filter(Boolean)
        .join(', ')}`,
    })
  } catch (e) {
    console.error('VMN data DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete VMN data' }, { status: 500 })
  }
}
