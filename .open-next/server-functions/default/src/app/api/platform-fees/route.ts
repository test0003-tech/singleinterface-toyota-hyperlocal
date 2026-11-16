import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type {
  PlatformFeeInput,
  PaginatedResponse,
  PlatformFee,
  PlatformFeeWithPayments,
  RecordType,
} from '@/lib/types'
import { currentMonth } from '@/lib/validation'

function parseNum(v: unknown, def = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : def
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
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
    month: (body.month ?? currentMonth()).trim(),
    invoiceNumber: cleanStr(body.invoiceNumber),
    baseAmount,
    gstRate,
    lateFee,
    dueDate,
    notes: body.notes ? String(body.notes).trim() : null,
  }
}

function computeAmounts(baseAmount: number, gstRate: number) {
  const gstAmount = +(baseAmount * (gstRate / 100)).toFixed(2)
  const totalAmount = +(baseAmount + gstAmount).toFixed(2)
  return { gstAmount, totalAmount }
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
    const recordType = (searchParams.get('recordType') ?? '').trim()
    const recordCode = (searchParams.get('recordCode') ?? '').trim()
    const paymentStatus = (searchParams.get('paymentStatus') ?? '').trim()
    const overdue = searchParams.get('overdue') === '1'
    const withPayments = searchParams.get('withPayments') === '1'
    const exportCsv = searchParams.get('export') === '1'

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { recordCode: { contains: search } },
        { invoiceNumber: { contains: search } },
        { notes: { contains: search } },
      ]
    }
    if (month) where.month = month
    if (recordType === 'SI' || recordType === 'Spotlight')
      where.recordType = recordType
    if (recordCode) where.recordCode = recordCode
    if (paymentStatus === 'unpaid' || paymentStatus === 'partial' || paymentStatus === 'paid') {
      where.paymentStatus = paymentStatus
    }
    if (overdue) {
      where.AND = [
        { paymentStatus: { not: 'paid' } },
        { dueDate: { lt: new Date() } },
      ]
    }

    const include = withPayments
      ? { payments: { orderBy: { paidDate: 'desc' } as const } }
      : undefined

    if (exportCsv) {
      const all = await db.platformFee.findMany({
        where,
        orderBy: [{ month: 'desc' }, { recordType: 'asc' }, { recordCode: 'asc' }],
        include,
      })
      return NextResponse.json({ data: all })
    }

    const [total, data] = await Promise.all([
      db.platformFee.count({ where }),
      db.platformFee.findMany({
        where,
        orderBy: [{ month: 'desc' }, { recordType: 'asc' }, { recordCode: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
    ])

    const res: PaginatedResponse<PlatformFeeWithPayments | PlatformFee> = {
      data: data as never,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
    return NextResponse.json(res)
  } catch (e) {
    console.error('PlatformFee GET error', e)
    return NextResponse.json(
      { error: 'Failed to fetch platform fee records' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const { gstAmount, totalAmount } = computeAmounts(
      input.baseAmount,
      input.gstRate
    )
    const existing = await db.platformFee.findUnique({
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
          error: `Platform fee for ${input.recordType} ${input.recordCode} in ${input.month} already exists`,
        },
        { status: 409 }
      )
    }
    const created = await db.platformFee.create({
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
        // paymentStatus defaults to "unpaid", amountPaid to 0
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('PlatformFee POST error', e)
    return NextResponse.json(
      { error: 'Failed to create platform fee record' },
      { status: 500 }
    )
  }
}
