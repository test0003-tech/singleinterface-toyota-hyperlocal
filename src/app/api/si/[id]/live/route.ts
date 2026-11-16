import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/validation'

// Mark an SI record as live (or toggle off).
// When marking live:
//   - sets isLive=true, liveSince=now (or provided date)
//   - if linkedSpotlightCode is set, marks that Spotlight record live too
//   - creates a PlatformFee entry for the current month (if not exists)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { live?: boolean; liveSince?: string } = {}
    try {
      body = await req.json()
    } catch {
      // empty body -> default to live=true
    }
    const wantLive = body.live !== false // default true

    const record = await db.sIRecord.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const liveSince = wantLive
      ? body.liveSince
        ? new Date(body.liveSince)
        : record.liveSince ?? new Date()
      : null

    const updated = await db.sIRecord.update({
      where: { id },
      data: { isLive: wantLive, liveSince },
    })

    const syncResults: { spotlight?: { code: string; ok: boolean } } = {}

    // Sync linked Spotlight
    if (wantLive && record.linkedSpotlightCode) {
      const spot = await db.spotlightRecord.findUnique({
        where: { clientCode: record.linkedSpotlightCode },
      })
      if (spot) {
        await db.spotlightRecord.update({
          where: { id: spot.id },
          data: {
            isLive: true,
            liveSince: spot.liveSince ?? liveSince,
          },
        })
        syncResults.spotlight = { code: spot.clientCode, ok: true }
      } else {
        syncResults.spotlight = { code: record.linkedSpotlightCode, ok: false }
      }
    }

    // Create PlatformFee entry for current month if marking live
    let platformFeeCreated = false
    if (wantLive) {
      const month = currentMonth()
      const existing = await db.platformFee.findUnique({
        where: {
          recordType_recordCode_month: {
            recordType: 'SI',
            recordCode: record.siCode,
            month,
          },
        },
      })
      if (!existing) {
        const baseAmount = 8060
        const gstRate = 18
        const gstAmount = +(baseAmount * (gstRate / 100)).toFixed(2)
        const totalAmount = +(baseAmount + gstAmount).toFixed(2)
        await db.platformFee.create({
          data: {
            recordType: 'SI',
            recordCode: record.siCode,
            month,
            baseAmount,
            gstRate,
            gstAmount,
            totalAmount,
            paymentStatus: 'unpaid',
          },
        })
        platformFeeCreated = true
      }
    }

    return NextResponse.json({
      success: true,
      record: updated,
      spotlightSync: syncResults.spotlight ?? null,
      platformFeeCreated,
    })
  } catch (e) {
    console.error('SI mark live error', e)
    return NextResponse.json(
      { error: 'Failed to update live status' },
      { status: 500 }
    )
  }
}
