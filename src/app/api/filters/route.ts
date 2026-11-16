import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [siStates, siCircles, siCities, siGmbStatus, spotStates, spotRegions, spotCities, spotCountries] =
      await Promise.all([
        db.sIRecord.findMany({
          where: { state: { not: null } },
          distinct: ['state'],
          select: { state: true },
        }),
        db.sIRecord.findMany({
          where: { circle: { not: null } },
          distinct: ['circle'],
          select: { circle: true },
        }),
        db.sIRecord.findMany({
          where: { city: { not: null } },
          distinct: ['city'],
          select: { city: true },
        }),
        db.sIRecord.findMany({
          where: { gmbListingStatus: { not: null } },
          distinct: ['gmbListingStatus'],
          select: { gmbListingStatus: true },
        }),
        db.spotlightRecord.findMany({
          where: { state: { not: null } },
          distinct: ['state'],
          select: { state: true },
        }),
        db.spotlightRecord.findMany({
          where: { region: { not: null } },
          distinct: ['region'],
          select: { region: true },
        }),
        db.spotlightRecord.findMany({
          where: { city: { not: null } },
          distinct: ['city'],
          select: { city: true },
        }),
        db.spotlightRecord.findMany({
          where: { country: { not: null } },
          distinct: ['country'],
          select: { country: true },
        }),
      ])

    return NextResponse.json({
      si: {
        states: siStates
          .map((r) => r.state!)
          .filter((s): s is string => !!s)
          .sort(),
        circles: siCircles
          .map((r) => r.circle!)
          .filter((s): s is string => !!s)
          .sort(),
        cities: siCities
          .map((r) => r.city!)
          .filter((s): s is string => !!s)
          .sort(),
        gmbStatuses: siGmbStatus
          .map((r) => r.gmbListingStatus!)
          .filter((s): s is string => !!s)
          .sort(),
      },
      spotlight: {
        states: spotStates
          .map((r) => r.state!)
          .filter((s): s is string => !!s)
          .sort(),
        regions: spotRegions
          .map((r) => r.region!)
          .filter((s): s is string => !!s)
          .sort(),
        cities: spotCities
          .map((r) => r.city!)
          .filter((s): s is string => !!s)
          .sort(),
        countries: spotCountries
          .map((r) => r.country!)
          .filter((s): s is string => !!s)
          .sort(),
      },
    })
  } catch (e) {
    console.error('Filters error', e)
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 })
  }
}
