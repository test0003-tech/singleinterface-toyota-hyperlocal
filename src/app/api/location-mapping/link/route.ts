import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/audit'

// Link (or unlink) an SI record to a Spotlight record
// Body: { siId: string, spotlightCode: string | null }
// If spotlightCode is null/empty, unlinks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const siId = (body?.siId ?? '').trim()
    const spotlightCode = (body?.spotlightCode ?? '').trim() || null

    if (!siId) {
      return NextResponse.json({ error: 'siId is required' }, { status: 400 })
    }

    const si = await db.sIRecord.findUnique({ where: { id: siId } })
    if (!si) {
      return NextResponse.json({ error: 'SI record not found' }, { status: 404 })
    }

    // If linking, verify the spotlight record exists
    if (spotlightCode) {
      const spot = await db.spotlightRecord.findUnique({
        where: { clientCode: spotlightCode },
      })
      if (!spot) {
        return NextResponse.json(
          { error: `Spotlight record "${spotlightCode}" not found` },
          { status: 404 }
        )
      }
    }

    const updated = await db.sIRecord.update({
      where: { id: siId },
      data: { linkedSpotlightCode: spotlightCode },
    })

    await auditLog({
      action: 'update',
      entityType: 'SI',
      entityId: si.id,
      entityCode: si.siCode,
      summary: spotlightCode
        ? `SI ${si.siCode} linked to Spotlight ${spotlightCode}`
        : `SI ${si.siCode} unlinked from Spotlight`,
    })

    return NextResponse.json({
      success: true,
      siCode: si.siCode,
      linkedSpotlightCode: spotlightCode,
    })
  } catch (e) {
    console.error('Location link error', e)
    return NextResponse.json({ error: 'Failed to link records' }, { status: 500 })
  }
}
