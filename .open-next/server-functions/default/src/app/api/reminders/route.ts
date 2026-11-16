import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  currentMonth,
  nextMonth,
  isRenewalReminderDay,
  currentDayOfMonth,
} from '@/lib/validation'
import { evaluateAllRules, seedDefaultRules } from '@/lib/rule-engine'

export interface ReminderAlert {
  severity: 'critical' | 'warning' | 'info'
  category:
    | 'missing_platform_fee'
    | 'missing_media_spend'
    | 'pending_payment'
    | 'media_deficit'
    | 'live_campaign'
    | 'media_renewal'
    | 'custom_rule'
  title: string
  message: string
  count?: number
  amount?: number
  locations?: { code: string; type: string; name?: string | null }[]
}

export interface RemindersData {
  month: string
  liveCampaigns: {
    si: { total: number; live: number }
    spotlight: { total: number; live: number }
  }
  platformFees: {
    required: number // count of live SI locations that should have a fee this month
    present: number // count of platform fee entries this month
    missing: number // required - present
    totalBilled: number
    totalPaid: number
    totalPending: number
    pendingCount: number
    missingLocations: { code: string; type: string; name?: string | null }[]
    pendingLocations: { code: string; type: string; amount: number; name?: string | null }[]
  }
  mediaSpend: {
    liveLocations: number
    withEntry: number
    withoutEntry: number
    totalAllocated: number
    totalUtilized: number
    totalPendingWallet: number
    deficitCount: number // utilized > allocated
    missingLocations: { code: string; type: string; name?: string | null }[]
    deficitLocations: {
      code: string
      type: string
      allocated: number
      utilized: number
      deficit: number
      name?: string | null
    }[]
  }
  mediaRenewal: {
    isReminderDay: boolean // true if today is on/after the 25th
    dayOfMonth: number
    nextMonth: string
    liveLocationsNeedingRenewal: number // live locations without next month's budget
    locationsNeedingRenewal: { code: string; type: string; name?: string | null }[]
  }
  alerts: ReminderAlert[]
}

export async function GET() {
  try {
    const month = currentMonth()

    // Fetch all live SI and Spotlight records
    const [siRecords, spotlightRecords] = await Promise.all([
      db.sIRecord.findMany({
        where: { isLive: true },
        select: { siCode: true, businessName: true, clientCode: true, linkedSpotlightCode: true },
      }),
      db.spotlightRecord.findMany({
        where: { isLive: true },
        select: { clientCode: true, name: true },
      }),
    ])

    const [siAll, spotlightAll] = await Promise.all([
      db.sIRecord.count(),
      db.spotlightRecord.count(),
    ])

    // Live SI codes and Spotlight codes
    const liveSICodes = siRecords.map((r) => r.siCode)
    const liveSpotlightCodes = spotlightRecords.map((r) => r.clientCode)

    // Fetch platform fees and media spend for current month + next month (for renewal)
    const nextMon = nextMonth(month)
    const [platformFeesMonth, mediaSpendMonth, mediaSpendNextMonth] = await Promise.all([
      db.platformFee.findMany({
        where: { month },
        select: {
          id: true,
          recordType: true,
          recordCode: true,
          totalAmount: true,
          paymentStatus: true,
          amountPaid: true,
          dueDate: true,
          paidAt: true,
        },
      }),
      db.mediaSpend.findMany({
        where: { month },
        select: {
          id: true,
          recordType: true,
          recordCode: true,
          allocated: true,
          utilized: true,
          pendingInWallet: true,
        },
      }),
      db.mediaSpend.findMany({
        where: { month: nextMon },
        select: {
          recordType: true,
          recordCode: true,
          allocated: true,
        },
      }),
    ])

    // Build name lookup
    const siNameMap = new Map(siRecords.map((r) => [r.siCode, r.businessName]))
    const spotNameMap = new Map(spotlightRecords.map((r) => [r.clientCode, r.name]))

    // --- Platform fees analysis ---
    // Required = number of live SI locations (platform fees start when SI goes live)
    const platformRequired = liveSICodes.length
    const platformFeeEntries = platformFeesMonth.filter(
      (f) => f.recordType === 'SI' && liveSICodes.includes(f.recordCode)
    )
    const platformPresent = platformFeeEntries.length
    const platformMissing = Math.max(0, platformRequired - platformPresent)

    const feeCodesPresent = new Set(platformFeeEntries.map((f) => f.recordCode))
    const platformMissingLocations = siRecords
      .filter((r) => !feeCodesPresent.has(r.siCode))
      .map((r) => ({ code: r.siCode, type: 'SI', name: r.businessName }))

    const platformTotalBilled = platformFeesMonth.reduce((s, f) => s + f.totalAmount, 0)
    const platformTotalPaid = platformFeesMonth
      .filter((f) => f.paymentStatus === 'paid')
      .reduce((s, f) => s + f.totalAmount, 0)
    const platformTotalPending = platformTotalBilled - platformTotalPaid
    const platformPendingCount = platformFeesMonth.filter((f) => f.paymentStatus !== 'paid').length

    const platformPendingLocations = platformFeesMonth
      .filter((f) => f.paymentStatus !== 'paid')
      .map((f) => ({
        code: f.recordCode,
        type: f.recordType,
        amount: f.totalAmount,
        name:
          f.recordType === 'SI'
            ? siNameMap.get(f.recordCode) ?? null
            : spotNameMap.get(f.recordCode) ?? null,
      }))
      .sort((a, b) => b.amount - a.amount)

    // --- Media spend analysis ---
    // Live locations that should have media spend (all live SI + live Spotlight)
    const allLiveLocations = [
      ...siRecords.map((r) => ({ code: r.siCode, type: 'SI' as const, name: r.businessName })),
      ...spotlightRecords.map((r) => ({ code: r.clientCode, type: 'Spotlight' as const, name: r.name })),
    ]
    const mediaLiveLocations = allLiveLocations.length

    const mediaEntries = mediaSpendMonth.filter((m) => {
      if (m.recordType === 'SI') return liveSICodes.includes(m.recordCode)
      if (m.recordType === 'Spotlight') return liveSpotlightCodes.includes(m.recordCode)
      return false
    })
    const mediaCodesWithEntry = new Set(
      mediaEntries.map((m) => `${m.recordType}:${m.recordCode}`)
    )
    const mediaWithEntry = mediaEntries.length
    const mediaWithoutEntry = Math.max(
      0,
      allLiveLocations.length - mediaCodesWithEntry.size
    )
    const mediaMissingLocations = allLiveLocations
      .filter((l) => !mediaCodesWithEntry.has(`${l.type}:${l.code}`))
      .map((l) => ({ code: l.code, type: l.type, name: l.name }))

    const mediaTotalAllocated = mediaSpendMonth.reduce((s, m) => s + m.allocated, 0)
    const mediaTotalUtilized = mediaSpendMonth.reduce((s, m) => s + m.utilized, 0)
    const mediaTotalPendingWallet = mediaSpendMonth.reduce(
      (s, m) => s + m.pendingInWallet,
      0
    )

    const mediaDeficitLocations = mediaEntries
      .filter((m) => m.utilized > m.allocated)
      .map((m) => ({
        code: m.recordCode,
        type: m.recordType,
        allocated: m.allocated,
        utilized: m.utilized,
        deficit: +(m.utilized - m.allocated).toFixed(2),
        name:
          m.recordType === 'SI'
            ? siNameMap.get(m.recordCode) ?? null
            : spotNameMap.get(m.recordCode) ?? null,
      }))
      .sort((a, b) => b.deficit - a.deficit)
    const mediaDeficitCount = mediaDeficitLocations.length

    // --- Build alerts ---
    const alerts: ReminderAlert[] = []

    // Critical: live campaigns count
    const totalLive = liveSICodes.length + liveSpotlightCodes.length
    if (totalLive > 0) {
      alerts.push({
        severity: 'info',
        category: 'live_campaign',
        title: 'Campaigns are Live',
        message: `${totalLive} location${totalLive > 1 ? 's are' : ' is'} currently live (${
          liveSICodes.length
        } SI, ${liveSpotlightCodes.length} Spotlight). Platform fees are being billed.`,
        count: totalLive,
      })
    }

    // Critical: missing platform fees
    if (platformMissing > 0) {
      alerts.push({
        severity: 'critical',
        category: 'missing_platform_fee',
        title: 'Platform Fees Missing',
        message: `${platformMissing} live location${platformMissing > 1 ? 's' : ''} ${
          platformMissing > 1 ? 'have' : 'has'
        } no platform fee entry for ${month}. Each live location should pay ₹9,510.80/month.`,
        count: platformMissing,
        amount: platformMissing * 9510.8,
        locations: platformMissingLocations.slice(0, 20),
      })
    }

    // Warning: pending platform fee payments
    if (platformPendingCount > 0) {
      alerts.push({
        severity: 'warning',
        category: 'pending_payment',
        title: 'Platform Fee Payments Pending',
        message: `${platformPendingCount} platform fee entr${
          platformPendingCount > 1 ? 'ies are' : 'y is'
        } unpaid for ${month}. Total pending: ₹${platformTotalPending.toFixed(2)}.`,
        count: platformPendingCount,
        amount: platformTotalPending,
        locations: platformPendingLocations.slice(0, 20),
      })
    }

    // Critical: missing media spend for live locations
    if (mediaWithoutEntry > 0) {
      alerts.push({
        severity: 'critical',
        category: 'missing_media_spend',
        title: 'Media Spend Not Tracked',
        message: `${mediaWithoutEntry} live location${
          mediaWithoutEntry > 1 ? 's have' : ' has'
        } no media spend entry for ${month}. Media budget varies per location per month.`,
        count: mediaWithoutEntry,
        locations: mediaMissingLocations.slice(0, 20),
      })
    }

    // Warning: media spend deficit (utilized > allocated)
    if (mediaDeficitCount > 0) {
      const totalDeficit = mediaDeficitLocations.reduce((s, d) => s + d.deficit, 0)
      alerts.push({
        severity: 'warning',
        category: 'media_deficit',
        title: 'Media Spend Exceeds Budget',
        message: `${mediaDeficitCount} location${
          mediaDeficitCount > 1 ? 's have' : ' has'
        } spent more than allocated for ${month}. Total over-budget: ₹${totalDeficit.toFixed(2)}.`,
        count: mediaDeficitCount,
        amount: totalDeficit,
        locations: mediaDeficitLocations.slice(0, 20),
      })
    }

    // --- Media budget renewal reminder ---
    // On/after the 25th of each month, remind to renew media budget for next month.
    // If a live location already has a media spend entry for next month, no reminder.
    const isReminderDay = isRenewalReminderDay()
    const dayOfMonth = currentDayOfMonth()

    // Build set of locations that HAVE next month's media budget
    const nextMonthHasBudget = new Set(
      mediaSpendNextMonth.map((m) => `${m.recordType}:${m.recordCode}`)
    )
    // Live locations missing next month's budget
    const locationsNeedingRenewal = allLiveLocations.filter(
      (l) => !nextMonthHasBudget.has(`${l.type}:${l.code}`)
    )
    const liveLocationsNeedingRenewal = locationsNeedingRenewal.length

    if (isReminderDay && liveLocationsNeedingRenewal > 0) {
      alerts.push({
        severity: 'warning',
        category: 'media_renewal',
        title: 'Media Budget Renewal Due',
        message: `${liveLocationsNeedingRenewal} live location${
          liveLocationsNeedingRenewal > 1 ? 's need' : ' needs'
        } a media budget for ${nextMon} (next month). Reminder triggered on the 25th — add the budget to avoid campaign interruption.`,
        count: liveLocationsNeedingRenewal,
        locations: locationsNeedingRenewal.slice(0, 20),
      })
    }

    // --- Custom rule alerts ---
    // Seed default rules if none exist, then evaluate all enabled rules.
    await seedDefaultRules()
    const { alerts: customAlerts } = await evaluateAllRules()
    alerts.push(...customAlerts)

    const data: RemindersData = {
      month,
      liveCampaigns: {
        si: { total: siAll, live: liveSICodes.length },
        spotlight: { total: spotlightAll, live: liveSpotlightCodes.length },
      },
      platformFees: {
        required: platformRequired,
        present: platformPresent,
        missing: platformMissing,
        totalBilled: platformTotalBilled,
        totalPaid: platformTotalPaid,
        totalPending: platformTotalPending,
        pendingCount: platformPendingCount,
        missingLocations: platformMissingLocations,
        pendingLocations: platformPendingLocations,
      },
      mediaSpend: {
        liveLocations: mediaLiveLocations,
        withEntry: mediaWithEntry,
        withoutEntry: mediaWithoutEntry,
        totalAllocated: mediaTotalAllocated,
        totalUtilized: mediaTotalUtilized,
        totalPendingWallet: mediaTotalPendingWallet,
        deficitCount: mediaDeficitCount,
        missingLocations: mediaMissingLocations,
        deficitLocations: mediaDeficitLocations,
      },
      mediaRenewal: {
        isReminderDay,
        dayOfMonth,
        nextMonth: nextMon,
        liveLocationsNeedingRenewal,
        locationsNeedingRenewal,
      },
      alerts,
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('Reminders error', e)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}
