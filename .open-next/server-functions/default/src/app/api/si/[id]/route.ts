import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { SIRecordInput } from '@/lib/types'
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await db.sIRecord.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(record)
  } catch (e) {
    console.error('SI GET by id error', e)
    return NextResponse.json({ error: 'Failed to fetch record' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const existing = await db.sIRecord.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (input.siCode !== existing.siCode) {
      const conflict = await db.sIRecord.findUnique({
        where: { siCode: input.siCode },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `SI Code "${input.siCode}" already exists` },
          { status: 409 }
        )
      }
    }
    const updated = await db.sIRecord.update({ where: { id }, data: input })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('SI PUT error', e)
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.sIRecord.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await db.sIRecord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('SI DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}
