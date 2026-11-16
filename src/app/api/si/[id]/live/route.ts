import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/validation'
import { auditLog } from '@/lib/audit'

/**
 * Mark an SI record as live (or toggle off).
 *
 * Platform fee rules:
 *   - First month: If the location goes live with LESS than 10 days remaining
 *     in the month, the first month's platform fee is waived (free).
 *     If >= 10 days remaining, a platform fee is created for the current month.
 *   - From the second month onwards: Platform fee must be paid to run campaigns.
 *     If unpaid, campaigns are blocked (shown in alerts/reminders).
 *
 * When marking live:
 *   - Sets isLive=true, liveSince (or provided date)
 *   - If linkedSpotlightCode is set, marks that Spotlight record live too
 *   - Creates a PlatformFee entry for the current month (if not exists AND
 *     >= 10 days remain in the month)
 */
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

    await auditLog({
      action: 'update',
      entityType: 'SI',
      entityId: record.id,
      entityCode: record.siCode,
      summary: `SI marked ${wantLive ? 'live' : 'inactive'}`,
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

    // --- Platform fee logic ---
    let platformFeeCreated = false
    let firstMonthFree = false
    let daysRemainingInMonth = 0
    let campaignBlocked = false

    if (wantLive && liveSince) {
      const now = new Date()
      // Use the actual live date for calculating days remaining in month
      // (even if it's in the future - that's when the campaign starts)
      const effectiveDate = liveSince

      // Calculate days remaining in the current month from the live date
      const year = effectiveDate.getFullYear()
      const month = effectiveDate.getMonth()
      const lastDay = new Date(year, month + 1, 0).getDate() // days in month
      daysRemainingInMonth = lastDay - effectiveDate.getDate() + 1

      const currentMon = currentMonth()
      const liveMonth = `${year}-${String(month + 1).padStart(2, '0')}`
      const isFirstMonth = liveMonth === currentMon || liveSince > now

      if (daysRemainingInMonth < 10 && (isFirstMonth || liveSince > now)) {
        // RULE: First month free if < 10 days remaining in the live month
        firstMonthFree = true
        // Check if there's already a fee for this month (maybe from a previous live cycle)
        const existing = await db.platformFee.findUnique({
          where: {
            recordType_recordCode_month: {
              recordType: 'SI',
              recordCode: record.siCode,
              month: liveMonth,
            },
          },
        })
        // If a fee already exists for the live month and it's the first month,
        // delete it (waive the fee)
        if (existing) {
          await db.platformFee.delete({ where: { id: existing.id } })
        }
      } else {
        // Create PlatformFee entry for current month (normal case)
        const existing = await db.platformFee.findUnique({
          where: {
            recordType_recordCode_month: {
              recordType: 'SI',
              recordCode: record.siCode,
              month: currentMon,
            },
          },
        })
        if (!existing) {
          const baseAmount = 8060
          const gstRate = 18
          const gstAmount = +(baseAmount * (gstRate / 100)).toFixed(2)
          const totalAmount = +(baseAmount + gstAmount).toFixed(2)
          // Due date: end of the month
          const dueDate = new Date(year, month + 1, 0)
          await db.platformFee.create({
            data: {
              recordType: 'SI',
              recordCode: record.siCode,
              month: currentMon,
              baseAmount,
              gstRate,
              gstAmount,
              totalAmount,
              paymentStatus: 'unpaid',
              dueDate,
            },
          })
          platformFeeCreated = true
        }
      }

      // Check if campaign should be blocked (2nd+ month with unpaid fee)
      if (!firstMonthFree) {
        const liveYear = liveSince.getFullYear()
        const liveMon = liveSince.getMonth()
        const nowYear = now.getFullYear()
        const nowMon = now.getMonth()
        const monthsSinceLive = (nowYear - liveYear) * 12 + (nowMon - liveMon)
        // monthsSinceLive === 0 means first month, >= 1 means second month onwards
        if (monthsSinceLive >= 1) {
          // Check if current month fee exists and is paid
          const currentFee = await db.platformFee.findUnique({
            where: {
              recordType_recordCode_month: {
                recordType: 'SI',
                recordCode: record.siCode,
                month: currentMon,
              },
            },
            select: { paymentStatus: true },
          })
          if (!currentFee || currentFee.paymentStatus !== 'paid') {
            campaignBlocked = true
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      record: updated,
      spotlightSync: syncResults.spotlight ?? null,
      platformFeeCreated,
      firstMonthFree,
      daysRemainingInMonth,
      campaignBlocked,
    })
  } catch (e) {
    console.error('SI mark live error', e)
    return NextResponse.json(
      { error: 'Failed to update live status' },
      { status: 500 }
    )
  }
}
