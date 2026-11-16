import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recalcFeePayment } from '../route'
import { auditLog } from '@/lib/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        platformFee: {
          select: { recordType: true, recordCode: true, month: true, invoiceNumber: true, totalAmount: true },
        },
      },
    })
    if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(payment)
  } catch (e) {
    console.error('Payment GET by id error', e)
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await db.payment.findUnique({
      where: { id },
      select: { platformFeeId: true, reference: true },
    })
    if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await auditLog({
      action: 'delete',
      entityType: 'Payment',
      entityId: id,
      entityCode: payment.reference ?? id,
      summary: `Payment deleted`,
    })

    await db.payment.delete({ where: { id } })

    // Recalculate the fee's payment status after deletion
    await recalcFeePayment(payment.platformFeeId)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Payment DELETE error', e)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}
