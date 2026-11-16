import { NextResponse } from 'next/server'
import { evaluateAllRules, seedDefaultRules } from '@/lib/rule-engine'

export async function GET() {
  try {
    // Seed default rules if none exist
    await seedDefaultRules()
    const { results, alerts } = await evaluateAllRules()
    return NextResponse.json({
      results,
      alerts,
      totalRules: results.length,
      totalMatches: results.reduce((s, r) => s + r.matchedCount, 0),
    })
  } catch (e) {
    console.error('Rules evaluate error', e)
    return NextResponse.json({ error: 'Failed to evaluate rules' }, { status: 500 })
  }
}
