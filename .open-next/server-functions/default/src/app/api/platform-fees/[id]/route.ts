import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PlatformFeeInput, RecordType } from '@/lib/types'

function parseNum(v: unknown, def = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : def
}

function computeAmounts(baseAmount: number, gstRate: number) {
  const gstAmount = +(baseAmount * (gstRate / 100)).toFixed(2)
  const totalAmount = +(baseAmount + gstAmount).toFixed(2)
  return { gstAmount, totalAmount }
}

function buildInput(body: Partial<PlatformFeeInput>): {
  recordType: RecordType
  recordCode: string
  month: string
  baseAmount: number
  gstRate: number
  isPaid: boolean
  paidAt: Date | null
  notes: string | null
} {
  const baseAmount = body.baseAmount !== undefined ? parseNum(body.baseAmount, 8060) : 8060
  const gstRate = body.gstRate !== undefined ? parseNum(body.gstRate, 18) : 18
  const isPaid =
    body.isPaid === true ||
    (typeof body.isPaid === 'string' && body.isPaid === 'paid')
  return {
    recordType: (body.recordType as RecordType) ?? 'SI',
    recordCode: (body.recordCode ?? '').trim(),
    month: (body.month ?? '').trim(),
    baseAmount,
    gstRate,
    isPaid,
    paidAt: isPaid ? new Date() : null,
    notes: body.notes ? String(body.notes).trim() : null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await db.platformFee.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(record)
  } catch (e) {
    console.error('PlatformFee GET by id error', e)
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
    if (!body?.recordCode || !body?.month) {
      return NextResponse.json(
        { error: 'recordCode and month are required' },
        { status: 400 }
      )
    }
    if (body.recordType !== 'SI' && body.recordType !== 'Spotlight') {
      return NextResponse.json(
        { error: 'recordType must be SI or Spotlight' },
        { status: 400 }
      )
    }
    const input = buildInput(body)
    const existing = await db.platformFee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const newKey = {
      recordType: input.recordType,
      recordCode: input.recordCode,
      month: input.month,
    }
    if (
      newKey.recordType !== existing.recordType ||
      newKey.recordCode !== existing.recordCode ||
      newKey.month !== existing.month
    ) {
      const conflict = await db.platformFee.findUnique({
        where: {
          recordType_recordCode_month: newKey,
        },
      })
      if (conflict) {
        return NextResponse.json(
          {
            error: `Platform fee for ${input.recordType} ${input.recordCode} in ${input.month} already exists`,
          },
          { status: 409 }
        )
      }
    }
    const { gstAmount, totalAmount } = computeAmounts(
      input.baseAmount,
      input.gstRate
    )
    const updated = await db.platformFee.update({
      where: { id },
      data: {
        recordType: input.recordType,
        recordCode: input.recordCode,
        month: input.month,
        baseAmount: input.baseAmount,
        gstRate: input.gstRate,
        gstAmount,
        totalAmount,
        isPaid: input.isPaid,
        paidAt: input.paidAt,
        notes: input.notes,
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('PlatformFee PUT error', e)
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.platformFee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await db.platformFee.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('PlatformFee DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}
