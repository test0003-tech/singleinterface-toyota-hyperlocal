'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Trash2, Receipt, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  getPlatformFeeWithPayments,
  deletePayment,
} from '@/lib/api'
import type {
  PlatformFeeWithPayments,
  Payment,
  PaymentMethod,
} from '@/lib/types'
import { PAYMENT_METHODS } from '@/lib/types'
import { formatCurrency, formatMonth } from '@/lib/validation'

export interface PaymentHistoryDrawerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  platformFeeId: string | null
  onRecordPayment?: () => void
}

function methodLabel(m: PaymentMethod): string {
  return PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function statusBadgeClass(status: PlatformFeeWithPayments['paymentStatus']): string {
  if (status === 'paid') return 'bg-emerald-600 hover:bg-emerald-600'
  if (status === 'partial')
    return 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15'
  return 'text-red-600 border-red-300'
}

export function PaymentHistoryDrawer({
  open,
  onOpenChange,
  platformFeeId,
  onRecordPayment,
}: PaymentHistoryDrawerProps) {
  const { toast } = useToast()
  const [fee, setFee] = useState<PlatformFeeWithPayments | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchFee = useCallback(async () => {
    if (!platformFeeId) {
      setFee(null)
      return
    }
    setLoading(true)
    try {
      const data = await getPlatformFeeWithPayments(platformFeeId)
      setFee(data)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load payment history',
        variant: 'destructive',
      })
      setFee(null)
    } finally {
      setLoading(false)
    }
  }, [platformFeeId, toast])

  useEffect(() => {
    if (open && platformFeeId) {
      fetchFee()
    } else if (!open) {
      setFee(null)
      setDeleteTarget(null)
    }
  }, [open, platformFeeId, fetchFee])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePayment(deleteTarget.id)
      toast({ title: 'Deleted', description: 'Payment removed' })
      setDeleteTarget(null)
      await fetchFee()
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const totalDue = fee ? fee.totalAmount + (fee.lateFee || 0) : 0
  const amountPaid = fee?.amountPaid ?? 0
  const remaining = Math.max(0, +(totalDue - amountPaid).toFixed(2))
  const payments = fee?.payments ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full sm:w-3/4 flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Payment History
          </SheetTitle>
          <SheetDescription>
            {fee
              ? `${fee.recordType} ${fee.recordCode} — ${formatMonth(fee.month)}`
              : 'Loading fee details...'}
          </SheetDescription>
        </SheetHeader>

        {/* Fee summary */}
        <div className="px-4 py-3 border-b bg-muted/30">
          {loading || !fee ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Invoice</p>
                  <p className="font-mono text-xs">
                    {fee.invoiceNumber || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Due</p>
                  <p className="font-semibold">{formatCurrency(totalDue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount Paid</p>
                  <p className="font-medium text-emerald-600">
                    {formatCurrency(amountPaid)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="font-semibold text-primary">
                    {formatCurrency(remaining)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusBadgeClass(fee.paymentStatus)}>
                  {fee.paymentStatus}
                </Badge>
                {fee.dueDate && (
                  <span className="text-xs text-muted-foreground">
                    Due: {formatDate(fee.dueDate)}
                  </span>
                )}
                {fee.lateFee > 0 && (
                  <span className="text-xs text-amber-600">
                    Late fee: {formatCurrency(fee.lateFee)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payments table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
              No payments recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    Amount
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Method</TableHead>
                  <TableHead className="whitespace-nowrap">Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(p.paidDate)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {methodLabel(p.method)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                      {p.reference || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                      {p.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(p)}
                        title="Delete payment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t p-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {payments.length} payment{payments.length === 1 ? '' : 's'} recorded
          </span>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false)
              onRecordPayment?.()
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </SheetContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will remove the payment of ${formatCurrency(
                    deleteTarget.amount
                  )} recorded on ${formatDate(deleteTarget.paidDate)}. The fee's payment status will be recalculated.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
