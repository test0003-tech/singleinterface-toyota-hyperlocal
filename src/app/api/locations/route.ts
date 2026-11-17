import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Returns all SI and Spotlight locations for use in dropdown selectors.
 *
 * SI locations include the linkedSpotlightCode so the Media Spend form can
 * map an SI selection to its Spotlight counterpart.
 */
export async function GET() {
  try {
    const [siRecords, spotlightRecords] = await Promise.all([
      db.sIRecord.findMany({
        select: {
          siCode: true,
          clientCode: true,
          businessName: true,
          city: true,
          state: true,
          circle: true,
          isLive: true,
          linkedSpotlightCode: true,
        },
        orderBy: { siCode: 'asc' },
      }),
      db.spotlightRecord.findMany({
        select: {
          clientCode: true,
          name: true,
          city: true,
          state: true,
          region: true,
          isLive: true,
        },
        orderBy: { clientCode: 'asc' },
      }),
    ])

    return NextResponse.json({
      si: siRecords.map((r) => ({
        siCode: r.siCode,
        clientCode: r.clientCode,
        businessName: r.businessName,
        city: r.city,
        state: r.state,
        circle: r.circle,
        isLive: r.isLive,
        linkedSpotlightCode: r.linkedSpotlightCode,
      })),
      spotlight: spotlightRecords.map((r) => ({
        clientCode: r.clientCode,
        name: r.name,
        city: r.city,
        state: r.state,
        region: r.region,
        isLive: r.isLive,
      })),
    })
  } catch (e) {
    console.error('Locations GET error', e)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}
