import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/validation'

// Generate PlatformFee entries for a given month for all live SI records.
// Body: { month?: string, recordType?: 'SI' | 'Spotlight' }
// Default: current month, SI records that are live.
export async function POST(req: NextRequest) {
  try {
    let body: { month?: string; recordType?: 'SI' | 'Spotlight' } = {}
    try {
      body = await req.json()
    } catch {
      // empty
    }
    const month = body.month?.trim() || currentMonth()
    const recordType = body.recordType === 'Spotlight' ? 'Spotlight' : 'SI'

    const liveRecords =
      recordType === 'SI'
        ? await db.sIRecord.findMany({
            where: { isLive: true },
            select: { siCode: true },
          })
        : await db.spotlightRecord.findMany({
            where: { isLive: true },
            select: { clientCode: true },
          })

    const codes =
      recordType === 'SI'
        ? liveRecords.map((r) => r.siCode)
        : liveRecords.map((r) => r.clientCode)

    const baseAmount = 8060
    const gstRate = 18
    const gstAmount = +(baseAmount * (gstRate / 100)).toFixed(2)
    const totalAmount = +(baseAmount + gstAmount).toFixed(2)

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const code of codes) {
      try {
        const existing = await db.platformFee.findUnique({
          where: {
            recordType_recordCode_month: {
              recordType,
              recordCode: code,
              month,
            },
          },
        })
        if (existing) {
          skipped++
          continue
        }
        await db.platformFee.create({
          data: {
            recordType,
            recordCode: code,
            month,
            baseAmount,
            gstRate,
            gstAmount,
            totalAmount,
            paymentStatus: 'unpaid',
          },
        })
        created++
      } catch (e) {
        errors.push(
          `${code}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      month,
      recordType,
      liveCount: codes.length,
      created,
      skipped,
      errors,
    })
  } catch (e) {
    console.error('Generate platform fees error', e)
    return NextResponse.json(
      { error: 'Failed to generate platform fees' },
      { status: 500 }
    )
  }
}
