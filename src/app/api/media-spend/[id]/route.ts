import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { MediaSpendInput, RecordType } from '@/lib/types'
import { previousMonth, calculatePendingInWallet } from '@/lib/validation'

function parseNum(v: unknown, def = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : def
}

function buildInput(body: Partial<MediaSpendInput>): MediaSpendInput {
  return {
    recordType: 'Spotlight' as RecordType,
    recordCode: (body.recordCode ?? '').trim(),
    month: (body.month ?? '').trim(),
    metaAllocated: parseNum(body.metaAllocated, 0),
    metaUtilized: parseNum(body.metaUtilized, 0),
    googleAllocated: parseNum(body.googleAllocated, 0),
    googleUtilized: parseNum(body.googleUtilized, 0),
    notes: body.notes ? String(body.notes).trim() : null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await db.mediaSpend.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(record)
  } catch (e) {
    console.error('MediaSpend GET by id error', e)
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
    const input = buildInput(body)
    const existing = await db.mediaSpend.findUnique({ where: { id } })
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
      const conflict = await db.mediaSpend.findUnique({
        where: {
          recordType_recordCode_month: newKey,
        },
      })
      if (conflict) {
        return NextResponse.json(
          {
            error: `Media spend for ${input.recordCode} in ${input.month} already exists`,
          },
          { status: 409 }
        )
      }
    }
    // Auto-calculate pendingInWallet for both Meta and Google
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

    const allocated = metaAllocated + googleAllocated
    const utilized = metaUtilized + googleUtilized
    const pendingInWallet = metaPendingInWallet + googlePendingInWallet

    const updated = await db.mediaSpend.update({
      where: { id },
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
    return NextResponse.json(updated)
  } catch (e) {
    console.error('MediaSpend PUT error', e)
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.mediaSpend.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await db.mediaSpend.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('MediaSpend DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}
