import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Extract the dealer name from a business name.
 * e.g. "Toyota Car Showroom - Nandi Toyota, Ramanagara" -> "nandi toyota"
 * e.g. "Nucleus Toyota, Pune" -> "nucleus toyota"
 */
function extractDealerName(name: string): string {
  let s = name.toLowerCase().trim()
  // Remove "toyota car showroom - " prefix
  s = s.replace(/^toyota car showroom\s*[-–]\s*/, '')
  // Remove common suffixes
  s = s.replace(/\s*toyota.*$/, '').trim()
  // If empty after removing, try to get the first meaningful part
  if (!s) {
    s = name.toLowerCase().replace(/^toyota car showroom\s*[-–]\s*/, '').trim()
  }
  return s
}

/**
 * Calculate similarity score between two SI/Spotlight records.
 * Higher is better. Returns 0-100.
 */
function similarityScore(
  si: { businessName: string | null; city: string | null; state: string | null; clientCode: string },
  spot: { name: string | null; city: string | null; state: string | null; clientCode: string }
): number {
  let score = 0
  const siName = si.businessName ?? ''
  const spotName = spot.name ?? ''

  // Name matching (weight: 40%)
  if (siName && spotName) {
    const siDealer = extractDealerName(siName)
    const spotDealer = extractDealerName(spotName)
    if (siDealer && spotDealer) {
      if (siDealer === spotDealer) {
        score += 40
      } else if (siDealer.includes(spotDealer) || spotDealer.includes(siDealer)) {
        score += 30
      } else {
        // Check word overlap
        const siWords = new Set(siDealer.split(/\s+/))
        const spotWords = new Set(spotDealer.split(/\s+/))
        const common = [...siWords].filter((w) => spotWords.has(w) && w.length > 2)
        if (common.length > 0) score += 15
      }
    }
  }

  // City matching (weight: 30%)
  if (si.city && spot.city) {
    const siCity = si.city.toLowerCase().trim()
    const spotCity = spot.city.toLowerCase().trim()
    if (siCity === spotCity) {
      score += 30
    } else if (siCity.includes(spotCity) || spotCity.includes(siCity)) {
      score += 20
    }
  }

  // State matching (weight: 20%)
  if (si.state && spot.state) {
    if (si.state.toLowerCase().trim() === spot.state.toLowerCase().trim()) {
      score += 20
    }
  }

  // Client code matching (weight: 10%) - some may share similar codes
  if (si.clientCode && spot.clientCode) {
    const siCode = si.clientCode.toLowerCase()
    const spotCode = spot.clientCode.toLowerCase()
    if (siCode === spotCode) {
      score += 10
    } else if (siCode.substring(0, 2) === spotCode.substring(0, 2)) {
      score += 5
    }
  }

  return Math.min(100, score)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const minScore = parseInt(searchParams.get('minScore') ?? '50', 10) || 50

    // Fetch all SI and Spotlight records
    const [siRecords, spotlightRecords] = await Promise.all([
      db.sIRecord.findMany({
        select: {
          id: true,
          siCode: true,
          clientCode: true,
          businessName: true,
          city: true,
          state: true,
          circle: true,
          isLive: true,
          linkedSpotlightCode: true,
        },
      }),
      db.spotlightRecord.findMany({
        select: {
          id: true,
          clientCode: true,
          name: true,
          alternateName: true,
          city: true,
          state: true,
          region: true,
          isLive: true,
          domain: true,
        },
      }),
    ])

    // Build spotlight lookup by clientCode
    const spotByCode = new Map(spotlightRecords.map((s) => [s.clientCode, s]))

    // Build matched pairs
    interface MatchResult {
      si: (typeof siRecords)[0]
      spotlight: (typeof spotlightRecords)[0] | null
      matchType: 'manual' | 'auto' | 'none'
      matchScore: number
    }
    const results: MatchResult[] = []
    const matchedSpotCodes = new Set<string>()

    // First pass: existing manual links
    for (const si of siRecords) {
      if (si.linkedSpotlightCode) {
        const spot = spotByCode.get(si.linkedSpotlightCode)
        if (spot) {
          results.push({
            si,
            spotlight: spot,
            matchType: 'manual',
            matchScore: 100,
          })
          matchedSpotCodes.add(spot.clientCode)
        } else {
          results.push({ si, spotlight: null, matchType: 'none', matchScore: 0 })
        }
      } else {
        results.push({ si, spotlight: null, matchType: 'none', matchScore: 0 })
      }
    }

    // Second pass: auto-match unmatched SI records using similarity
    for (const result of results) {
      if (result.matchType !== 'none') continue

      let bestMatch: (typeof spotlightRecords)[0] | null = null
      let bestScore = 0

      for (const spot of spotlightRecords) {
        // Skip already matched spotlight records
        if (matchedSpotCodes.has(spot.clientCode)) continue

        const score = similarityScore(result.si, spot)
        if (score > bestScore) {
          bestScore = score
          bestMatch = spot
        }
      }

      if (bestMatch && bestScore >= minScore) {
        result.spotlight = bestMatch
        result.matchType = 'auto'
        result.matchScore = bestScore
        matchedSpotCodes.add(bestMatch.clientCode)
      }
    }

    // Unmatched spotlight records
    const unmatchedSpotlight = spotlightRecords.filter(
      (s) => !matchedSpotCodes.has(s.clientCode)
    )

    // Summary stats
    const matched = results.filter((r) => r.spotlight !== null)
    const manuallyLinked = results.filter((r) => r.matchType === 'manual')
    const autoMatched = results.filter((r) => r.matchType === 'auto')
    const unmatchedSI = results.filter((r) => r.spotlight === null)

    return NextResponse.json({
      mappings: results.map((r) => ({
        siId: r.si.id,
        siCode: r.si.siCode,
        siClientCode: r.si.clientCode,
        siName: r.si.businessName,
        siCity: r.si.city,
        siState: r.si.state,
        siCircle: r.si.circle,
        siIsLive: r.si.isLive,
        spotlightId: r.spotlight?.id ?? null,
        spotlightCode: r.spotlight?.clientCode ?? null,
        spotlightName: r.spotlight?.name ?? null,
        spotlightCity: r.spotlight?.city ?? null,
        spotlightState: r.spotlight?.state ?? null,
        spotlightRegion: r.spotlight?.region ?? null,
        spotlightIsLive: r.spotlight?.isLive ?? null,
        spotlightDomain: r.spotlight?.domain ?? null,
        matchType: r.matchType,
        matchScore: r.matchScore,
      })),
      unmatchedSpotlight: unmatchedSpotlight.map((s) => ({
        id: s.id,
        clientCode: s.clientCode,
        name: s.name,
        city: s.city,
        state: s.state,
        region: s.region,
        isLive: s.isLive,
        domain: s.domain,
      })),
      summary: {
        totalSI: siRecords.length,
        totalSpotlight: spotlightRecords.length,
        matched: matched.length,
        manuallyLinked: manuallyLinked.length,
        autoMatched: autoMatched.length,
        unmatchedSI: unmatchedSI.length,
        unmatchedSpotlight: unmatchedSpotlight.length,
        matchRate:
          siRecords.length > 0
            ? +((matched.length / siRecords.length) * 100).toFixed(1)
            : 0,
      },
    })
  } catch (e) {
    console.error('Location mapping error', e)
    return NextResponse.json({ error: 'Failed to fetch location mapping' }, { status: 500 })
  }
}
