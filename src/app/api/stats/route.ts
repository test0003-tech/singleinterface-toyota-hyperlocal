import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { DashboardStats } from '@/lib/types'

export async function GET() {
  try {
    const [siRecords, spotlightRecords] = await Promise.all([
      db.sIRecord.findMany({
        select: { state: true, circle: true, gmbListingStatus: true },
      }),
      db.spotlightRecord.findMany({
        select: { state: true, region: true, country: true },
      }),
    ])

    const stateMapSi = new Map<string, number>()
    const circleMap = new Map<string, number>()
    const gmbMap = new Map<string, number>()
    for (const r of siRecords) {
      const st = r.state ?? 'Unknown'
      stateMapSi.set(st, (stateMapSi.get(st) ?? 0) + 1)
      const ci = r.circle ?? 'Unknown'
      circleMap.set(ci, (circleMap.get(ci) ?? 0) + 1)
      const gm = r.gmbListingStatus ?? 'Unknown'
      gmbMap.set(gm, (gmbMap.get(gm) ?? 0) + 1)
    }

    const stateMapSpot = new Map<string, number>()
    const regionMap = new Map<string, number>()
    const countryMap = new Map<string, number>()
    for (const r of spotlightRecords) {
      const st = r.state ?? 'Unknown'
      stateMapSpot.set(st, (stateMapSpot.get(st) ?? 0) + 1)
      const rg = r.region ?? 'Unknown'
      regionMap.set(rg, (regionMap.get(rg) ?? 0) + 1)
      const co = r.country ?? 'Unknown'
      countryMap.set(co, (countryMap.get(co) ?? 0) + 1)
    }

    const stats: DashboardStats = {
      si: {
        total: siRecords.length,
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
    }
    return NextResponse.json(stats)
  } catch (e) {
    console.error('Stats error', e)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
