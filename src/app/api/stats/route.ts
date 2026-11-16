import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { DashboardStats } from '@/lib/types'

export async function GET() {
  try {
    const [siRecords, spotlightRecords, mediaSpends, platformFees] =
      await Promise.all([
        db.sIRecord.findMany({
          select: { state: true, circle: true, gmbListingStatus: true, isLive: true },
        }),
        db.spotlightRecord.findMany({
          select: { state: true, region: true, country: true, isLive: true },
        }),
        db.mediaSpend.findMany({
          select: {
            month: true,
            allocated: true,
            utilized: true,
            pendingInWallet: true,
            metaAllocated: true,
            metaUtilized: true,
            metaPendingInWallet: true,
            googleAllocated: true,
            googleUtilized: true,
            googlePendingInWallet: true,
          },
        }),
        db.platformFee.findMany({
          select: { month: true, totalAmount: true, paymentStatus: true, amountPaid: true },
        }),
      ])

    const stateMapSi = new Map<string, number>()
    const circleMap = new Map<string, number>()
    const gmbMap = new Map<string, number>()
    let siLive = 0
    for (const r of siRecords) {
      const st = r.state ?? 'Unknown'
      stateMapSi.set(st, (stateMapSi.get(st) ?? 0) + 1)
      const ci = r.circle ?? 'Unknown'
      circleMap.set(ci, (circleMap.get(ci) ?? 0) + 1)
      const gm = r.gmbListingStatus ?? 'Unknown'
      gmbMap.set(gm, (gmbMap.get(gm) ?? 0) + 1)
      if (r.isLive) siLive++
    }

    const stateMapSpot = new Map<string, number>()
    const regionMap = new Map<string, number>()
    const countryMap = new Map<string, number>()
    let spotLive = 0
    for (const r of spotlightRecords) {
      const st = r.state ?? 'Unknown'
      stateMapSpot.set(st, (stateMapSpot.get(st) ?? 0) + 1)
      const rg = r.region ?? 'Unknown'
      regionMap.set(rg, (regionMap.get(rg) ?? 0) + 1)
      const co = r.country ?? 'Unknown'
      countryMap.set(co, (countryMap.get(co) ?? 0) + 1)
      if (r.isLive) spotLive++
    }

    // Media spend aggregation
    const msByMonth = new Map<
      string,
      { allocated: number; utilized: number; pending: number }
    >()
    let msTotalAllocated = 0
    let msTotalUtilized = 0
    let msTotalPending = 0
    let msMetaAllocated = 0
    let msMetaUtilized = 0
    let msMetaPending = 0
    let msGoogleAllocated = 0
    let msGoogleUtilized = 0
    let msGooglePending = 0
    for (const m of mediaSpends) {
      msTotalAllocated += m.allocated
      msTotalUtilized += m.utilized
      msTotalPending += m.pendingInWallet
      msMetaAllocated += m.metaAllocated
      msMetaUtilized += m.metaUtilized
      msMetaPending += m.metaPendingInWallet
      msGoogleAllocated += m.googleAllocated
      msGoogleUtilized += m.googleUtilized
      msGooglePending += m.googlePendingInWallet
      const cur = msByMonth.get(m.month) ?? { allocated: 0, utilized: 0, pending: 0 }
      cur.allocated += m.allocated
      cur.utilized += m.utilized
      cur.pending += m.pendingInWallet
      msByMonth.set(m.month, cur)
    }
    const msByMonthArr = [...msByMonth.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12)

    // Platform fees aggregation
    const pfByMonth = new Map<string, { billed: number; paid: number }>()
    let pfTotalBilled = 0
    let pfTotalPaid = 0
    let pfPaidCount = 0
    let pfPendingCount = 0
    for (const p of platformFees) {
      pfTotalBilled += p.totalAmount
      const cur = pfByMonth.get(p.month) ?? { billed: 0, paid: 0 }
      cur.billed += p.totalAmount
      if (p.paymentStatus === 'paid') {
        pfTotalPaid += p.totalAmount
        cur.paid += p.totalAmount
        pfPaidCount++
      } else {
        pfPendingCount++
      }
      pfByMonth.set(p.month, cur)
    }
    const pfByMonthArr = [...pfByMonth.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12)

    const stats: DashboardStats = {
      si: {
        total: siRecords.length,
        live: siLive,
        byState: [...stateMapSi.entries()]
          .map(([state, count]) => ({ state, count }))
          .sort((a, b) => b.count - a.count),
        byCircle: [...circleMap.entries()]
          .map(([circle, count]) => ({ circle, count }))
          .sort((a, b) => b.count - a.count),
        byGmbStatus: [...gmbMap.entries()]
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
      },
      spotlight: {
        total: spotlightRecords.length,
        live: spotLive,
        byState: [...stateMapSpot.entries()]
          .map(([state, count]) => ({ state, count }))
          .sort((a, b) => b.count - a.count),
        byRegion: [...regionMap.entries()]
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count),
        byCountry: [...countryMap.entries()]
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count),
      },
      mediaSpend: {
        totalAllocated: msTotalAllocated,
        totalUtilized: msTotalUtilized,
        totalPending: msTotalPending,
        metaAllocated: msMetaAllocated,
        metaUtilized: msMetaUtilized,
        metaPending: msMetaPending,
        googleAllocated: msGoogleAllocated,
        googleUtilized: msGoogleUtilized,
        googlePending: msGooglePending,
        byMonth: msByMonthArr,
      },
      platformFees: {
        totalBilled: pfTotalBilled,
        totalPaid: pfTotalPaid,
        totalPending: pfTotalBilled - pfTotalPaid,
        paidCount: pfPaidCount,
        pendingCount: pfPendingCount,
        byMonth: pfByMonthArr,
      },
    }
    return NextResponse.json(stats)
  } catch (e) {
    console.error('Stats error', e)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
