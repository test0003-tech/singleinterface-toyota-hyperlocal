import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [siRecords, spotlightRecords, platformFees, mediaSpends] = await Promise.all([
      db.sIRecord.findMany({
        select: {
          siCode: true,
          clientCode: true,
          businessName: true,
          city: true,
          state: true,
          circle: true,
          gmbListingStatus: true,
          salesLandingNumbers: true,
          serviceLandingNumbers: true,
          linkedSpotlightCode: true,
          isLive: true,
          postcode: true,
          latitude: true,
          longitude: true,
          website: true,
          vmnSi: true,
          placeId: true,
        },
      }),
      db.spotlightRecord.findMany({
        select: {
          clientCode: true,
          name: true,
          state: true,
          region: true,
          city: true,
          domain: true,
          vmn: true,
          spotlightLandingNumbers: true,
          isLive: true,
          adAccountCid: true,
          facebookPageId: true,
          pincode: true,
          latitude: true,
          longitude: true,
        },
      }),
      db.platformFee.findMany({
        select: { invoiceNumber: true, dueDate: true, paymentStatus: true, recordCode: true },
      }),
      db.mediaSpend.findMany({
        select: { recordCode: true, allocated: true, utilized: true, month: true },
      }),
    ])

    // --- SI data quality ---
    const siFields = [
      { key: 'businessName', label: 'Business Name' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'circle', label: 'Circle' },
      { key: 'gmbListingStatus', label: 'GMB Status' },
      { key: 'salesLandingNumbers', label: 'Sales Landing Numbers' },
      { key: 'serviceLandingNumbers', label: 'Service Landing Numbers' },
      { key: 'postcode', label: 'Postcode' },
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      { key: 'website', label: 'Website' },
      { key: 'vmnSi', label: 'VMN SI' },
      { key: 'placeId', label: 'Place ID' },
    ] as const

    const siFieldQuality = siFields.map((f) => {
      const filled = siRecords.filter((r) => {
        const val = r[f.key as keyof typeof r]
        return val !== null && val !== undefined && val !== ''
      }).length
      return {
        field: f.key,
        label: f.label,
        filled,
        total: siRecords.length,
        missing: siRecords.length - filled,
        completeness: siRecords.length > 0 ? +((filled / siRecords.length) * 100).toFixed(1) : 0,
      }
    })

    // --- Spotlight data quality ---
    const spotlightFields = [
      { key: 'name', label: 'Name' },
      { key: 'state', label: 'State' },
      { key: 'region', label: 'Region' },
      { key: 'city', label: 'City' },
      { key: 'domain', label: 'Domain' },
      { key: 'vmn', label: 'VMN' },
      { key: 'spotlightLandingNumbers', label: 'Spotlight Landing Numbers' },
      { key: 'adAccountCid', label: 'AdAccount CID' },
      { key: 'facebookPageId', label: 'Facebook Page ID' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
    ] as const

    const spotlightFieldQuality = spotlightFields.map((f) => {
      const filled = spotlightRecords.filter((r) => {
        const val = r[f.key as keyof typeof r]
        return val !== null && val !== undefined && val !== ''
      }).length
      return {
        field: f.key,
        label: f.label,
        filled,
        total: spotlightRecords.length,
        missing: spotlightRecords.length - filled,
        completeness:
          spotlightRecords.length > 0
            ? +((filled / spotlightRecords.length) * 100).toFixed(1)
            : 0,
      }
    })

    // --- Duplicates ---
    const siCodeCounts = new Map<string, number>()
    for (const r of siRecords) {
      siCodeCounts.set(r.siCode, (siCodeCounts.get(r.siCode) ?? 0) + 1)
    }
    const siDuplicates = [...siCodeCounts.entries()].filter(([, c]) => c > 1)

    const spotCodeCounts = new Map<string, number>()
    for (const r of spotlightRecords) {
      spotCodeCounts.set(r.clientCode, (spotCodeCounts.get(r.clientCode) ?? 0) + 1)
    }
    const spotlightDuplicates = [...spotCodeCounts.entries()].filter(([, c]) => c > 1)

    // --- Live coverage ---
    const siLive = siRecords.filter((r) => r.isLive).length
    const spotlightLive = spotlightRecords.filter((r) => r.isLive).length

    // --- Payment data quality ---
    const feesWithoutInvoice = platformFees.filter((f) => !f.invoiceNumber).length
    const feesWithoutDueDate = platformFees.filter((f) => !f.dueDate).length

    // --- Linkage: SI linked to Spotlight ---
    const siWithLinkedSpotlight = siRecords.filter((r) => r.linkedSpotlightCode).length
    const siLiveWithLinkedSpotlight = siRecords.filter(
      (r) => r.isLive && r.linkedSpotlightCode
    ).length

    // --- Overall scores ---
    const siOverallCompleteness =
      siFieldQuality.length > 0
        ? +(siFieldQuality.reduce((s, f) => s + f.completeness, 0) / siFieldQuality.length).toFixed(1)
        : 0
    const spotlightOverallCompleteness =
      spotlightFieldQuality.length > 0
        ? +(
            spotlightFieldQuality.reduce((s, f) => s + f.completeness, 0) /
            spotlightFieldQuality.length
          ).toFixed(1)
        : 0

    // --- Recommendations ---
    const recommendations: { severity: 'critical' | 'warning' | 'info'; message: string }[] = []
    const siMissingLanding = siFieldQuality.find((f) => f.field === 'salesLandingNumbers')
    if (siMissingLanding && siMissingLanding.missing > 0) {
      recommendations.push({
        severity: 'warning',
        message: `${siMissingLanding.missing} SI records are missing sales landing numbers — required for VMN call routing.`,
      })
    }
    if (feesWithoutInvoice > 0) {
      recommendations.push({
        severity: 'info',
        message: `${feesWithoutInvoice} platform fees have no invoice number — add for better tracking.`,
      })
    }
    if (feesWithoutDueDate > 0) {
      recommendations.push({
        severity: 'warning',
        message: `${feesWithoutDueDate} platform fees have no due date — set due dates for overdue tracking.`,
      })
    }
    if (siDuplicates.length > 0) {
      recommendations.push({
        severity: 'critical',
        message: `${siDuplicates.length} duplicate SI codes found — merge or fix to prevent data inconsistency.`,
      })
    }
    const siLiveMissingService = siRecords.filter(
      (r) => r.isLive && !r.serviceLandingNumbers
    ).length
    if (siLiveMissingService > 0) {
      recommendations.push({
        severity: 'warning',
        message: `${siLiveMissingService} live SI records are missing service landing numbers.`,
      })
    }

    return NextResponse.json({
      si: {
        total: siRecords.length,
        live: siLive,
        overallCompleteness: siOverallCompleteness,
        fieldQuality: siFieldQuality,
        duplicates: siDuplicates.map(([code, count]) => ({ code, count })),
        withLinkedSpotlight: siWithLinkedSpotlight,
        liveWithLinkedSpotlight: siLiveWithLinkedSpotlight,
      },
      spotlight: {
        total: spotlightRecords.length,
        live: spotlightLive,
        overallCompleteness: spotlightOverallCompleteness,
        fieldQuality: spotlightFieldQuality,
        duplicates: spotlightDuplicates.map(([code, count]) => ({ code, count })),
      },
      payments: {
        totalFees: platformFees.length,
        withoutInvoice: feesWithoutInvoice,
        withoutDueDate: feesWithoutDueDate,
      },
      mediaSpend: {
        totalEntries: mediaSpends.length,
      },
      recommendations,
    })
  } catch (e) {
    console.error('Data quality error', e)
    return NextResponse.json({ error: 'Failed to fetch data quality' }, { status: 500 })
  }
}
