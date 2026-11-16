import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { SIRecordInput, PaginatedResponse, SIRecord } from '@/lib/types'
import { normalizeLandingNumbers, validateLandingNumbers } from '@/lib/validation'

function cleanValue(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function buildInput(body: Partial<SIRecordInput>): SIRecordInput {
  return {
    siCode: (body.siCode ?? '').trim(),
    clientCode: (body.clientCode ?? '').trim(),
    businessProfileId: cleanValue(body.businessProfileId),
    businessName: cleanValue(body.businessName),
    alternativeName: cleanValue(body.alternativeName),
    circle: cleanValue(body.circle),
    address1: cleanValue(body.address1),
    address2: cleanValue(body.address2),
    locality: cleanValue(body.locality),
    landmark: cleanValue(body.landmark),
    city: cleanValue(body.city),
    state: cleanValue(body.state),
    postcode: cleanValue(body.postcode),
    latitude: cleanValue(body.latitude),
    longitude: cleanValue(body.longitude),
    googlePlusPage: cleanValue(body.googlePlusPage),
    vmnSi: cleanValue(body.vmnSi),
    weeklyOff: cleanValue(body.weeklyOff),
    businessHours: cleanValue(body.businessHours),
    website: cleanValue(body.website),
    placeId: cleanValue(body.placeId),
    locationGroup: cleanValue(body.locationGroup),
    gmbListingStatus: cleanValue(body.gmbListingStatus),
    salesLandingNumbers: normalizeLandingNumbers(body.salesLandingNumbers),
    serviceLandingNumbers: normalizeLandingNumbers(body.serviceLandingNumbers),
    linkedSpotlightCode: cleanValue(body.linkedSpotlightCode),
  }
}

function validateInput(input: SIRecordInput): string | null {
  const e1 = validateLandingNumbers(input.salesLandingNumbers)
  if (e1) return `Sales Landing Numbers: ${e1}`
  const e2 = validateLandingNumbers(input.serviceLandingNumbers)
  if (e2) return `Service Landing Numbers: ${e2}`
  return null
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
    const state = (searchParams.get('state') ?? '').trim()
    const circle = (searchParams.get('circle') ?? '').trim()
    const city = (searchParams.get('city') ?? '').trim()
    const gmbStatus = (searchParams.get('gmbStatus') ?? '').trim()
    const isLiveParam = searchParams.get('isLive')
    const exportCsv = searchParams.get('export') === '1'

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { siCode: { contains: search } },
        { clientCode: { contains: search } },
        { businessName: { contains: search } },
        { alternativeName: { contains: search } },
        { city: { contains: search } },
        { state: { contains: search } },
        { locality: { contains: search } },
        { postcode: { contains: search } },
        { locationGroup: { contains: search } },
        { salesLandingNumbers: { contains: search } },
        { serviceLandingNumbers: { contains: search } },
        { linkedSpotlightCode: { contains: search } },
      ]
    }
    if (state) where.state = state
    if (circle) where.circle = circle
    if (city) where.city = city
    if (gmbStatus) where.gmbListingStatus = gmbStatus
    if (isLiveParam === 'true') where.isLive = true
    if (isLiveParam === 'false') where.isLive = false

    if (exportCsv) {
      const all = await db.sIRecord.findMany({
        where,
        orderBy: { siCode: 'asc' },
      })
      return NextResponse.json({ data: all })
    }

    const [total, data] = await Promise.all([
      db.sIRecord.count({ where }),
      db.sIRecord.findMany({
        where,
        orderBy: { siCode: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const res: PaginatedResponse<SIRecord> = {
      data: data as unknown as SIRecord[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
    return NextResponse.json(res)
  } catch (e) {
    console.error('SI GET error', e)
    return NextResponse.json(
      { error: 'Failed to fetch SI records' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.siCode || !body?.clientCode) {
      return NextResponse.json(
        { error: 'siCode and clientCode are required' },
        { status: 400 }
      )
    }
    const input = buildInput(body)
    const validationError = validateInput(input)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    const existing = await db.sIRecord.findUnique({
      where: { siCode: input.siCode },
    })
    if (existing) {
      return NextResponse.json(
        { error: `SI Code "${input.siCode}" already exists` },
        { status: 409 }
      )
    }
    const created = await db.sIRecord.create({ data: input })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('SI POST error', e)
    return NextResponse.json(
      { error: 'Failed to create SI record' },
      { status: 500 }
    )
  }
}
