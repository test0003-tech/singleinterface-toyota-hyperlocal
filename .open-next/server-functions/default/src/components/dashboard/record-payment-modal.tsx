'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertTriangle } from 'lucide-react'
import { recordPayment } from '@/lib/api'
import type { PlatformFee, PaymentMethod } from '@/lib/types'
import { PAYMENT_METHODS } from '@/lib/types'
import { formatCurrency, formatMonth } from '@/lib/validation'

export interface RecordPaymentModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  platformFeeId: string
  fee: PlatformFee | null
  onRecorded?: () => void
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  platformFeeId,
  fee,
  onRecorded,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [reference, setReference] = useState('')
  const [paidDate, setPaidDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount('')
      setMethod('bank_transfer')
      setReference('')
      setPaidDate(todayISO())
      setNotes('')
      setError(null)
    }
  }, [open, platformFeeId, fee])

  const totalDue = fee ? fee.totalAmount + (fee.lateFee || 0) : 0
  const amountPaid = fee?.amountPaid ?? 0
  const remaining = Math.max(0, +(totalDue - amountPaid).toFixed(2))

  const amountNum = parseFloat(amount) || 0
  const exceedsRemaining = amountNum > remaining && remaining > 0
  const invalidAmount = amount.trim() !== '' && amountNum <= 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fee) return
    if (!amount.trim() || amountNum <= 0) {
      setError('Amount must be greater than 0')
      return
    }
    if (!paidDate) {
      setError('Paid date is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await recordPayment({
        platformFeeId,
        amount: amountNum,
        method,
        reference: reference.trim() || null,
        paidDate,
        notes: notes.trim() || null,
      })
      onOpenChange(false)
      onRecorded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for{' '}
            <span className="font-medium text-foreground">
              {fee?.recordType} {fee?.recordCode}
            </span>
            {fee ? ` — ${formatMonth(fee.month)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Fee summary */}
        {fee && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Invoice</span>
              <span className="text-xs font-mono">
                {fee.invoiceNumber || '—'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total Due</p>
                <p className="font-semibold">{formatCurrency(totalDue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Already Paid</p>
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
            <div className="flex items-center gap-2 pt-1">
              <Badge
                variant={
                  fee.paymentStatus === 'paid'
                    ? 'default'
                    : fee.paymentStatus === 'partial'
                    ? 'secondary'
                    : 'outline'
                }
                className={
                  fee.paymentStatus === 'paid'
                    ? 'bg-emerald-600 hover:bg-emerald-600'
                    : fee.paymentStatus === 'partial'
                    ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15'
                    : 'text-red-600 border-red-300'
                }
              >
                {fee.paymentStatus}
              </Badge>
              {fee.dueDate && (
                <span className="text-xs text-muted-foreground">
                  Due: {new Date(fee.dueDate).toLocaleDateString('en-IN')}
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs font-medium">
                Amount (INR) *
              </Label>
              <Input
                id="amount"
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              {invalidAmount && (
                <p className="text-xs text-destructive">
                  Amount must be greater than 0
                </p>
              )}
              {exceedsRemaining && !invalidAmount && (
                <p className="text-xs flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Exceeds remaining balance ({formatCurrency(remaining)})
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paidDate" className="text-xs font-medium">
                Paid Date *
              </Label>
              <Input
                id="paidDate"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="method" className="text-xs font-medium">
                Method
              </Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethod)}
              >
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reference" className="text-xs font-medium">
                Reference{' '}
                <span className="text-muted-foreground">
                  (cheque no, txn id, etc.)
                </span>
              </Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !fee || amountNum <= 0}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
