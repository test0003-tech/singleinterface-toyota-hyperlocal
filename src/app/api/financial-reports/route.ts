import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = (searchParams.get('month') ?? '').trim()

    // Fetch all platform fees with payments
    const fees = await db.platformFee.findMany({
      where: month ? { month } : {},
      select: {
        id: true,
        recordType: true,
        recordCode: true,
        month: true,
        invoiceNumber: true,
        totalAmount: true,
        lateFee: true,
        amountPaid: true,
        paymentStatus: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: { month: 'desc' },
    })

    const now = new Date()

    // --- Aging buckets ---
    // For unpaid/partial fees with a due date, compute days overdue
    const agingBuckets = {
      current: { count: 0, amount: 0 }, // not overdue yet (or paid)
      days0to30: { count: 0, amount: 0 },
      days31to60: { count: 0, amount: 0 },
      days61to90: { count: 0, amount: 0 },
      days90plus: { count: 0, amount: 0 },
    }

    for (const fee of fees) {
      const outstanding = fee.totalAmount + (fee.lateFee || 0) - fee.amountPaid
      if (outstanding <= 0) {
        agingBuckets.current.count++
        continue
      }
      if (!fee.dueDate) {
        agingBuckets.current.count++
        continue
      }
      const daysOverdue = Math.floor(
        (now.getTime() - fee.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysOverdue <= 0) {
        agingBuckets.current.count++
      } else if (daysOverdue <= 30) {
        agingBuckets.days0to30.count++
        agingBuckets.days0to30.amount += outstanding
      } else if (daysOverdue <= 60) {
        agingBuckets.days31to60.count++
        agingBuckets.days31to60.amount += outstanding
      } else if (daysOverdue <= 90) {
        agingBuckets.days61to90.count++
        agingBuckets.days61to90.amount += outstanding
      } else {
        agingBuckets.days90plus.count++
        agingBuckets.days90plus.amount += outstanding
      }
    }

    // --- Collection analytics ---
    const totalBilled = fees.reduce((s, f) => s + f.totalAmount + (f.lateFee || 0), 0)
    const totalCollected = fees.reduce((s, f) => s + f.amountPaid, 0)
    const totalOutstanding = totalBilled - totalCollected
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0

    // Paid fees: compute average days to pay
    const paidFees = fees.filter((f) => f.paymentStatus === 'paid' && f.paidAt && f.createdAt)
    const avgDaysToPay =
      paidFees.length > 0
        ? paidFees.reduce((s, f) => {
            const days = Math.floor(
              (f.paidAt!.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
            return s + days
          }, 0) / paidFees.length
        : 0

    // --- Payment status breakdown ---
    const statusBreakdown = {
      paid: fees.filter((f) => f.paymentStatus === 'paid').length,
      partial: fees.filter((f) => f.paymentStatus === 'partial').length,
      unpaid: fees.filter((f) => f.paymentStatus === 'unpaid').length,
    }

    // --- GST summary ---
    const gstSummary = fees.reduce(
      (acc, f) => {
        const ratio = f.totalAmount > 0 ? f.amountPaid / f.totalAmount : 0
        acc.totalBase += f.totalAmount / 1.18 // reverse-calculate base from total
        acc.totalGST += f.totalAmount - f.totalAmount / 1.18
        acc.collectedBase += (f.totalAmount / 1.18) * ratio
        acc.collectedGST += (f.totalAmount - f.totalAmount / 1.18) * ratio
        return acc
      },
      { totalBase: 0, totalGST: 0, collectedBase: 0, collectedGST: 0 }
    )

    // --- Monthly trends (last 6 months) ---
    const monthlyData = new Map<
      string,
      { billed: number; collected: number; outstanding: number }
    >()
    for (const fee of fees) {
      const m = fee.month
      const cur = monthlyData.get(m) ?? { billed: 0, collected: 0, outstanding: 0 }
      cur.billed += fee.totalAmount + (fee.lateFee || 0)
      cur.collected += fee.amountPaid
      cur.outstanding += fee.totalAmount + (fee.lateFee || 0) - fee.amountPaid
      monthlyData.set(m, cur)
    }
    const monthlyTrends = [...monthlyData.entries()]
      .map(([m, v]) => ({ month: m, ...v }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6)
      .reverse()

    // --- Top outstanding locations ---
    const outstanding = fees
      .filter((f) => f.paymentStatus !== 'paid')
      .map((f) => ({
        recordCode: f.recordCode,
        recordType: f.recordType,
        month: f.month,
        invoiceNumber: f.invoiceNumber,
        outstanding: f.totalAmount + (f.lateFee || 0) - f.amountPaid,
        daysOverdue: f.dueDate
          ? Math.max(0, Math.floor((now.getTime() - f.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0,
        paymentStatus: f.paymentStatus,
      }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 20)

    return NextResponse.json({
      agingBuckets,
      collectionAnalytics: {
        totalBilled: +totalBilled.toFixed(2),
        totalCollected: +totalCollected.toFixed(2),
        totalOutstanding: +totalOutstanding.toFixed(2),
        collectionRate: +collectionRate.toFixed(1),
        avgDaysToPay: +avgDaysToPay.toFixed(1),
        totalFees: fees.length,
        paidCount: statusBreakdown.paid,
        partialCount: statusBreakdown.partial,
        unpaidCount: statusBreakdown.unpaid,
      },
      gstSummary: {
        totalBase: +gstSummary.totalBase.toFixed(2),
        totalGST: +gstSummary.totalGST.toFixed(2),
        collectedBase: +gstSummary.collectedBase.toFixed(2),
        collectedGST: +gstSummary.collectedGST.toFixed(2),
        pendingGST: +(gstSummary.totalGST - gstSummary.collectedGST).toFixed(2),
      },
      monthlyTrends,
      topOutstanding: outstanding,
    })
  } catch (e) {
    console.error('Financial reports error', e)
    return NextResponse.json({ error: 'Failed to fetch financial reports' }, { status: 500 })
  }
}
