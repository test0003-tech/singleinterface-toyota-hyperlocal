import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type {
  SpotlightRecordInput,
  PaginatedResponse,
  SpotlightRecord,
} from '@/lib/types'

function cleanValue(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function buildInput(body: Partial<SpotlightRecordInput>): SpotlightRecordInput {
  return {
    clientCode: (body.clientCode ?? '').trim(),
    name: cleanValue(body.name),
    alternateName: cleanValue(body.alternateName),
    internalCode: cleanValue(body.internalCode),
    region: cleanValue(body.region),
    state: cleanValue(body.state),
    city: cleanValue(body.city),
    country: cleanValue(body.country),
    pincode: cleanValue(body.pincode),
    locality: cleanValue(body.locality),
    addressLine1: cleanValue(body.addressLine1),
    latitude: cleanValue(body.latitude),
    longitude: cleanValue(body.longitude),
    vmn: cleanValue(body.vmn),
    domain: cleanValue(body.domain),
    adAccountCid: cleanValue(body.adAccountCid),
    facebookPageId: cleanValue(body.facebookPageId),
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
    const state = (searchParams.get('state') ?? '').trim()
    const region = (searchParams.get('region') ?? '').trim()
    const city = (searchParams.get('city') ?? '').trim()
    const country = (searchParams.get('country') ?? '').trim()
    const exportCsv = searchParams.get('export') === '1'

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { clientCode: { contains: search } },
        { name: { contains: search } },
        { alternateName: { contains: search } },
        { internalCode: { contains: search } },
        { city: { contains: search } },
        { state: { contains: search } },
        { locality: { contains: search } },
        { pincode: { contains: search } },
        { domain: { contains: search } },
      ]
    }
    if (state) where.state = state
    if (region) where.region = region
    if (city) where.city = city
    if (country) where.country = country

    if (exportCsv) {
      const all = await db.spotlightRecord.findMany({
        where,
        orderBy: { clientCode: 'asc' },
      })
      return NextResponse.json({ data: all })
    }

    const [total, data] = await Promise.all([
      db.spotlightRecord.count({ where }),
      db.spotlightRecord.findMany({
        where,
        orderBy: { clientCode: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const res: PaginatedResponse<SpotlightRecord> = {
      data: data as unknown as SpotlightRecord[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
    return NextResponse.json(res)
  } catch (e) {
    console.error('Spotlight GET error', e)
    return NextResponse.json(
      { error: 'Failed to fetch Spotlight records' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      )
    }
    const input = buildInput(body)
    const existing = await db.spotlightRecord.findUnique({
      where: { clientCode: input.clientCode },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Client Code "${input.clientCode}" already exists` },
        { status: 409 }
      )
    }
    const created = await db.spotlightRecord.create({ data: input })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('Spotlight POST error', e)
    return NextResponse.json(
      { error: 'Failed to create Spotlight record' },
      { status: 500 }
    )
  }
}
