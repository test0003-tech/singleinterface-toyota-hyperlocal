import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { SpotlightRecordInput } from '@/lib/types'
import { normalizeLandingNumbers, validateLandingNumbers } from '@/lib/validation'

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
    spotlightLandingNumbers: normalizeLandingNumbers(body.spotlightLandingNumbers),
  }
}

function validateInput(input: SpotlightRecordInput): string | null {
  const e = validateLandingNumbers(input.spotlightLandingNumbers)
  if (e) return `Spotlight Landing Numbers: ${e}`
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await db.spotlightRecord.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(record)
  } catch (e) {
    console.error('Spotlight GET by id error', e)
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
    if (!body?.clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      )
    }
    const input = buildInput(body)
    const validationError = validateInput(input)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    const existing = await db.spotlightRecord.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (input.clientCode !== existing.clientCode) {
      const conflict = await db.spotlightRecord.findUnique({
        where: { clientCode: input.clientCode },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `Client Code "${input.clientCode}" already exists` },
          { status: 409 }
        )
      }
    }
    const updated = await db.spotlightRecord.update({
      where: { id },
      data: input,
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('Spotlight PUT error', e)
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.spotlightRecord.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await db.spotlightRecord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Spotlight DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}
