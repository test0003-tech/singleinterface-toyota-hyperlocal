import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PaymentInput, PaymentMethod, PaginatedResponse, Payment } from '@/lib/types'

const VALID_METHODS: PaymentMethod[] = ['bank_transfer', 'cheque', 'upi', 'cash', 'card', 'other']

function parseNum(v: unknown, def = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : def
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Recalculate amountPaid and paymentStatus for a PlatformFee based on all its payments.
 * Called after any payment create/update/delete.
 */
async function recalcFeePayment(feeId: string) {
  const payments = await db.payment.findMany({
    where: { platformFeeId: feeId },
    select: { amount: true },
  })
  const amountPaid = payments.reduce((s, p) => s + p.amount, 0)
  const fee = await db.platformFee.findUnique({
    where: { id: feeId },
    select: { totalAmount: true, lateFee: true },
  })
  if (!fee) return
  const totalDue = fee.totalAmount + (fee.lateFee || 0)
  let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid'
  let paidAt: Date | null = null
  if (amountPaid >= totalDue && totalDue > 0) {
    paymentStatus = 'paid'
    paidAt = new Date()
  } else if (amountPaid > 0) {
    paymentStatus = 'partial'
  }
  await db.platformFee.update({
    where: { id: feeId },
    data: { amountPaid, paymentStatus, paidAt },
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))
    const platformFeeId = (searchParams.get('platformFeeId') ?? '').trim()
    const method = (searchParams.get('method') ?? '').trim()
    const startDate = (searchParams.get('startDate') ?? '').trim()
    const endDate = (searchParams.get('endDate') ?? '').trim()
    const exportCsv = searchParams.get('export') === '1'

    const where: Record<string, unknown> = {}
    if (platformFeeId) where.platformFeeId = platformFeeId
    if (method && VALID_METHODS.includes(method as PaymentMethod)) where.method = method
    if (startDate || endDate) {
      const paidDate: Record<string, Date> = {}
      if (startDate) paidDate.gte = new Date(startDate)
      if (endDate) paidDate.lte = new Date(endDate + 'T23:59:59')
      where.paidDate = paidDate
    }

    if (exportCsv) {
      const all = await db.payment.findMany({
        where,
        orderBy: { paidDate: 'desc' },
        include: {
          platformFee: {
            select: { recordType: true, recordCode: true, month: true, invoiceNumber: true, totalAmount: true },
          },
        },
      })
      return NextResponse.json({ data: all })
    }

    const [total, data] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        orderBy: { paidDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          platformFee: {
            select: { recordType: true, recordCode: true, month: true, invoiceNumber: true, totalAmount: true },
          },
        },
      }),
    ])

    const res: PaginatedResponse<Payment & { platformFee?: { recordType: string; recordCode: string; month: string; invoiceNumber: string | null; totalAmount: number } }> = {
      data: data as never,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
    return NextResponse.json(res)
  } catch (e) {
    console.error('Payments GET error', e)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const platformFeeId = (body?.platformFeeId ?? '').trim()
    const amount = parseNum(body?.amount, 0)
    if (!platformFeeId) {
      return NextResponse.json({ error: 'platformFeeId is required' }, { status: 400 })
    }
    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
    }
    const method = (body?.method as PaymentMethod) ?? 'bank_transfer'
    if (!VALID_METHODS.includes(method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    // Verify the fee exists
    const fee = await db.platformFee.findUnique({ where: { id: platformFeeId } })
    if (!fee) {
      return NextResponse.json({ error: 'Platform fee not found' }, { status: 404 })
    }

    const paidDate = body?.paidDate ? new Date(body.paidDate) : new Date()
    const created = await db.payment.create({
      data: {
        platformFeeId,
        amount,
        method,
        reference: cleanStr(body?.reference),
        paidDate,
        notes: cleanStr(body?.notes),
      },
    })

    // Recalculate the fee's payment status
    await recalcFeePayment(platformFeeId)

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('Payments POST error', e)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}

export { recalcFeePayment }
