import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PlatformFeeInput, RecordType } from '@/lib/types'
import { auditLog, diffChanges } from '@/lib/audit'

function parseNum(v: unknown, def = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : def
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
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
  invoiceNumber: string | null
  baseAmount: number
  gstRate: number
  lateFee: number
  dueDate: Date | null
  notes: string | null
} {
  const baseAmount = body.baseAmount !== undefined ? parseNum(body.baseAmount, 8060) : 8060
  const gstRate = body.gstRate !== undefined ? parseNum(body.gstRate, 18) : 18
  const lateFee = body.lateFee !== undefined ? parseNum(body.lateFee, 0) : 0
  const dueDateStr = cleanStr(body.dueDate)
  let dueDate: Date | null = null
  if (dueDateStr) {
    const d = new Date(dueDateStr)
    if (!isNaN(d.getTime())) dueDate = d
  }
  return {
    recordType: (body.recordType as RecordType) ?? 'SI',
    recordCode: (body.recordCode ?? '').trim(),
    month: (body.month ?? '').trim(),
    invoiceNumber: cleanStr(body.invoiceNumber),
    baseAmount,
    gstRate,
    lateFee,
    dueDate,
    notes: body.notes ? String(body.notes).trim() : null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await db.platformFee.findUnique({
      where: { id },
      include: { payments: { orderBy: { paidDate: 'desc' } } },
    })
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
    const changes = diffChanges(
      existing as unknown as Record<string, unknown>,
      input as unknown as Record<string, unknown>
    )
    const updated = await db.platformFee.update({
      where: { id },
      data: {
        recordType: input.recordType,
        recordCode: input.recordCode,
        month: input.month,
        invoiceNumber: input.invoiceNumber,
        baseAmount: input.baseAmount,
        gstRate: input.gstRate,
        gstAmount,
        totalAmount,
        lateFee: input.lateFee,
        dueDate: input.dueDate,
        notes: input.notes,
      },
    })
    await auditLog({
      action: 'update',
      entityType: 'PlatformFee',
      entityId: id,
      entityCode: `${existing.recordCode}-${existing.month}`,
      changes,
      summary: 'Platform fee updated',
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
    await auditLog({
      action: 'delete',
      entityType: 'PlatformFee',
      entityId: id,
      entityCode: `${existing.recordCode}-${existing.month}`,
      summary: 'Platform fee deleted',
    })
    await db.platformFee.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('PlatformFee DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}
