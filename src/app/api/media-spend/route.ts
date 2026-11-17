import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type {
  MediaSpendInput,
  MediaSpend,
  RecordType,
  LiveSpotlightStore,
  MediaSpendListResponse,
} from '@/lib/types'
import { currentMonth, previousMonth, calculatePendingInWallet } from '@/lib/validation'

function parseNum(v: unknown, def = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : def
}

function buildInput(body: Partial<MediaSpendInput>): MediaSpendInput {
  return {
    recordType: 'Spotlight' as RecordType, // Media spend is only for Spotlight
    recordCode: (body.recordCode ?? '').trim(),
    month: (body.month ?? currentMonth()).trim(),
    metaAllocated: parseNum(body.metaAllocated, 0),
    metaUtilized: parseNum(body.metaUtilized, 0),
    googleAllocated: parseNum(body.googleAllocated, 0),
    googleUtilized: parseNum(body.googleUtilized, 0),
    notes: body.notes ? String(body.notes).trim() : null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10) || 10)
    )
    const search = (searchParams.get('search') ?? '').trim()
    const month = (searchParams.get('month') ?? '').trim()
    const recordCode = (searchParams.get('recordCode') ?? '').trim()
    const exportCsv = searchParams.get('export') === '1'

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { recordCode: { contains: search } },
        { notes: { contains: search } },
      ]
    }
    if (month) where.month = month
    if (recordCode) where.recordCode = recordCode

    if (exportCsv) {
      const all = await db.mediaSpend.findMany({
        where,
        orderBy: [{ month: 'desc' }, { recordCode: 'asc' }],
      })
      return NextResponse.json({ data: all })
    }

    // All live Spotlight stores — media spend is tracked per live Spotlight
    // location, so expose every active store code alongside the entries.
    const effectiveMonth = month || currentMonth()
    const [total, data, liveStores, monthEntries] = await Promise.all([
      db.mediaSpend.count({ where }),
      db.mediaSpend.findMany({
        where,
        orderBy: [{ month: 'desc' }, { recordCode: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.spotlightRecord.findMany({
        where: { isLive: true },
        select: { clientCode: true, name: true, city: true, state: true },
        orderBy: { clientCode: 'asc' },
      }),
      db.mediaSpend.findMany({
        where: { month: effectiveMonth },
        select: { recordCode: true },
      }),
    ])

    const codesWithBudget = new Set(monthEntries.map((m) => m.recordCode))
    const liveSpotlightStores: LiveSpotlightStore[] = liveStores.map((s) => ({
      code: s.clientCode,
      name: s.name,
      city: s.city,
      state: s.state,
      hasBudget: codesWithBudget.has(s.clientCode),
    }))
    const withBudget = liveSpotlightStores.filter((s) => s.hasBudget).length
    const liveSpotlightSummary = {
      month: effectiveMonth,
      total: liveSpotlightStores.length,
      withBudget,
      withoutBudget: liveSpotlightStores.length - withBudget,
    }

    const res: MediaSpendListResponse = {
      data: data as unknown as MediaSpend[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      liveSpotlightStores,
      liveSpotlightSummary,
    }
    return NextResponse.json(res)
  } catch (e) {
    console.error('MediaSpend GET error', e)
    return NextResponse.json(
      { error: 'Failed to fetch media spend records' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.recordCode || !body?.month) {
      return NextResponse.json(
        { error: 'recordCode (Spotlight Client Code) and month are required' },
        { status: 400 }
      )
    }
    const input = buildInput(body)
    const existing = await db.mediaSpend.findUnique({
      where: {
        recordType_recordCode_month: {
          recordType: input.recordType,
          recordCode: input.recordCode,
          month: input.month,
        },
      },
    })
    if (existing) {
      return NextResponse.json(
        {
          error: `Media spend for ${input.recordCode} in ${input.month} already exists`,
        },
        { status: 409 }
      )
    }
    // Auto-calculate pendingInWallet for both Meta and Google separately
    const prevMonth = previousMonth(input.month)
    const prevEntry = await db.mediaSpend.findUnique({
      where: {
        recordType_recordCode_month: {
          recordType: input.recordType,
          recordCode: input.recordCode,
          month: prevMonth,
        },
      },
      select: { metaPendingInWallet: true, googlePendingInWallet: true },
    })
    const prevMetaPending = prevEntry?.metaPendingInWallet ?? 0
    const prevGooglePending = prevEntry?.googlePendingInWallet ?? 0

    const metaAllocated = input.metaAllocated ?? 0
    const metaUtilized = input.metaUtilized ?? 0
    const metaPendingInWallet = calculatePendingInWallet(metaAllocated, metaUtilized, prevMetaPending)

    const googleAllocated = input.googleAllocated ?? 0
    const googleUtilized = input.googleUtilized ?? 0
    const googlePendingInWallet = calculatePendingInWallet(googleAllocated, googleUtilized, prevGooglePending)

    // Totals
    const allocated = metaAllocated + googleAllocated
    const utilized = metaUtilized + googleUtilized
    const pendingInWallet = metaPendingInWallet + googlePendingInWallet

    const created = await db.mediaSpend.create({
      data: {
        recordType: input.recordType,
        recordCode: input.recordCode,
        month: input.month,
        metaAllocated,
        metaUtilized,
        metaPendingInWallet,
        googleAllocated,
        googleUtilized,
        googlePendingInWallet,
        allocated,
        utilized,
        pendingInWallet,
        notes: input.notes ?? null,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('MediaSpend POST error', e)
    return NextResponse.json(
      { error: 'Failed to create media spend record' },
      { status: 500 }
    )
  }
}
