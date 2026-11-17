'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Download,
  MoreHorizontal,
  Loader2,
  Receipt,
  CheckCircle2,
  Clock,
  Sparkles,
  Upload,
  Wallet,
  History,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  listPlatformFees,
  createPlatformFee,
  updatePlatformFee,
  deletePlatformFee,
  exportPlatformFees,
  generatePlatformFees,
  importPlatformFeesFile,
  getStats,
} from '@/lib/api'
import type { PlatformFee, PlatformFeeInput, RecordType } from '@/lib/types'
import {
  currentMonth,
  formatMonth,
  recentMonths,
  formatCurrency,
} from '@/lib/validation'
import { FinanceImportDialog } from './finance-import-dialog'
import { RecordPaymentModal } from './record-payment-modal'
import { PaymentHistoryDrawer } from './payment-history-drawer'
import { LocationPicker } from './location-picker'

type PaymentStatusFilter = '' | 'unpaid' | 'partial' | 'paid'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const DEFAULT_BASE = 8060
const DEFAULT_GST_RATE = 18

export function PlatformFeesTab({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [monthFilter, setMonthFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | RecordType>('')
  const [paymentStatusFilter, setPaymentStatusFilter] =
    useState<PaymentStatusFilter>('')
  const [overdueFilter, setOverdueFilter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ data: PlatformFee[]; total: number; totalPages: number } | null>(null)
  const [summary, setSummary] = useState<{
    totalBilled: number
    totalPaid: number
    totalPending: number
    paidCount: number
    pendingCount: number
  } | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PlatformFee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlatformFee | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [recordPaymentFee, setRecordPaymentFee] = useState<PlatformFee | null>(
    null
  )
  const [historyFeeId, setHistoryFeeId] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listPlatformFees({
        page,
        pageSize,
        search: debouncedSearch,
        month: monthFilter,
        recordType: typeFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        overdue: overdueFilter || undefined,
      })
      setData({ data: res.data, total: res.total, totalPages: res.totalPages })
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load data',
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    monthFilter,
    typeFilter,
    paymentStatusFilter,
    overdueFilter,
    toast,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const [statsLoadedKey, setStatsLoadedKey] = useState<number | null>(null)
  const [localRefresh, setLocalRefresh] = useState(0)
  const statsKey = `${refreshKey}-${localRefresh}`
  const statsLoading = statsLoadedKey !== statsKey
  useEffect(() => {
    let cancelled = false
    getStats()
      .then((s) => {
        if (!cancelled) {
          setSummary({
            totalBilled: s.platformFees.totalBilled,
            totalPaid: s.platformFees.totalPaid,
            totalPending: s.platformFees.totalPending,
            paidCount: s.platformFees.paidCount,
            pendingCount: s.platformFees.pendingCount,
          })
          setStatsLoadedKey(statsKey)
        }
      })
      .catch(() => {
        if (!cancelled) setStatsLoadedKey(statsKey)
      })
    return () => {
      cancelled = true
    }
  }, [statsKey])

  const triggerStatsRefresh = useCallback(() => {
    setLocalRefresh((n) => n + 1)
  }, [])

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row: PlatformFee) {
    setEditing(row)
    setFormOpen(true)
  }

  async function handleSubmit(values: Record<string, string | null>) {
    const payload: PlatformFeeInput = {
      recordType: (values.recordType as RecordType) || 'SI',
      recordCode: values.recordCode ?? '',
      month: values.month ?? currentMonth(),
      invoiceNumber: values.invoiceNumber ?? null,
      baseAmount: values.baseAmount ? parseFloat(values.baseAmount) : DEFAULT_BASE,
      gstRate: values.gstRate ? parseFloat(values.gstRate) : DEFAULT_GST_RATE,
      lateFee: values.lateFee ? parseFloat(values.lateFee) : 0,
      dueDate: values.dueDate ?? null,
      notes: values.notes ?? null,
    }
    if (!payload.recordCode || !payload.month) {
      throw new Error('Location Code and Month are required')
    }
    if (editing) {
      await updatePlatformFee(editing.id, payload)
      toast({ title: 'Updated', description: 'Platform fee updated' })
    } else {
      await createPlatformFee(payload)
      toast({ title: 'Created', description: 'Platform fee created' })
    }
    await fetchData()
    triggerStatsRefresh()
  }

  function openRecordPayment(row: PlatformFee) {
    setRecordPaymentFee(row)
  }

  function openPaymentHistory(row: PlatformFee) {
    setHistoryFeeId(row.id)
  }

  async function handlePaymentRecorded() {
    await fetchData()
    triggerStatsRefresh()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePlatformFee(deleteTarget.id)
      toast({ title: 'Deleted', description: 'Record deleted' })
      setDeleteTarget(null)
      await fetchData()
      triggerStatsRefresh()
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

  async function handleExport() {
    setExporting(true)
    try {
      const res = await exportPlatformFees({
        search: debouncedSearch,
        month: monthFilter,
        recordType: typeFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        overdue: overdueFilter || undefined,
      })
      downloadCSV(res.data, 'platform-fees.csv')
      toast({ title: 'Exported', description: 'CSV downloaded' })
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }


  const monthOptions = recentMonths(12)
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Platform Fees</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fixed monthly platform fee of {formatCurrency(DEFAULT_BASE)} +{' '}
            {DEFAULT_GST_RATE}% GST = {formatCurrency(9510.8)} per live location.
            Fees start when a location is marked live in SI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-Generate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            disabled={loading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Billed"
          value={summary?.totalBilled ?? 0}
          icon={<Receipt className="h-5 w-5" />}
          accent="bg-primary/10 text-primary"
          loading={statsLoading}
        />
        <SummaryCard
          title="Total Paid"
          value={summary?.totalPaid ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="bg-emerald-500/10 text-emerald-600"
          loading={statsLoading}
        />
        <SummaryCard
          title="Pending Amount"
          value={summary?.totalPending ?? 0}
          icon={<Clock className="h-5 w-5" />}
          accent="bg-amber-500/10 text-amber-600"
          loading={statsLoading}
        />
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Payment Status
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-28 mt-1.5" />
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      {summary?.paidCount ?? 0} paid
                    </Badge>
                    <Badge variant="outline">
                      {summary?.pendingCount ?? 0} pending
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={monthFilter || '__all__'} onValueChange={(v) => { setMonthFilter(v === '__all__' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Months</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter || '__all__'} onValueChange={(v) => { setTypeFilter((v === '__all__' ? '' : v) as RecordType | ''); setPage(1) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Types</SelectItem>
            <SelectItem value="SI">SI</SelectItem>
            <SelectItem value="Spotlight">Spotlight</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={paymentStatusFilter || '__all__'}
          onValueChange={(v) => {
            setPaymentStatusFilter(
              v === '__all__' ? '' : (v as PaymentStatusFilter)
            )
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Payment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={overdueFilter ? 'default' : 'outline'}
          size="sm"
          className="h-9"
          onClick={() => {
            setOverdueFilter((v) => !v)
            setPage(1)
          }}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Overdue Only
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Location</TableHead>
                <TableHead className="whitespace-nowrap">Month</TableHead>
                <TableHead className="text-right whitespace-nowrap">Base</TableHead>
                <TableHead className="text-right whitespace-nowrap">GST ({DEFAULT_GST_RATE}%)</TableHead>
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Amount Paid</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data && data.data.length > 0 ? (
                data.data.map((row) => {
                  const totalDue = row.totalAmount + (row.lateFee || 0)
                  const remaining = Math.max(0, totalDue - row.amountPaid)
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-medium">
                            {row.recordCode}
                          </span>
                          <Badge variant="outline" className="text-[10px] w-fit mt-0.5">
                            {row.recordType}
                          </Badge>
                          {row.invoiceNumber && (
                            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {row.invoiceNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatMonth(row.month)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(row.baseAmount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                        {formatCurrency(row.gstAmount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-semibold">
                        {formatCurrency(row.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium">
                            {formatCurrency(row.amountPaid)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            of {formatCurrency(totalDue)}
                          </span>
                          {remaining > 0 && (
                            <span className="text-[10px] text-amber-600">
                              {formatCurrency(remaining)} left
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.paymentStatus === 'paid' ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Paid
                          </Badge>
                        ) : row.paymentStatus === 'partial' ? (
                          <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            Partial
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-red-600 border-red-300"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Unpaid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openRecordPayment(row)}>
                              <Wallet className="mr-2 h-4 w-4" />
                              Record Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPaymentHistory(row)}>
                              <History className="mr-2 h-4 w-4" />
                              Payment History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(row)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(row)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No platform fee records found. Use &quot;Auto-Generate&quot; to
                    create entries for all live SI locations.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {data && data.data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {startIdx}-{endIdx} of {total} entries
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {totalPages > 1 && (
            <Pagination className="sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                <PaginationItem className="px-3 text-sm">
                  Page {page} of {totalPages}
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      <PlatformFeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={async () => {
          await fetchData()
      triggerStatsRefresh()
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this platform fee entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FinanceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Platform Fees"
        description="Upload an Excel/CSV file with per-location per-month platform fees. Each row matches a location + month and will be upserted."
        expectedColumns={[
          'Location Type',
          'Location Code',
          'Month',
          'Base Amount',
          'GST Rate',
          'Status',
          'Notes',
        ]}
        onImportFile={importPlatformFeesFile}
        onImported={async () => {
          await fetchData()
          triggerStatsRefresh()
        }}
        downloadTemplate={downloadPlatformFeesTemplate}
      />

      <RecordPaymentModal
        open={!!recordPaymentFee}
        onOpenChange={(v) => !v && setRecordPaymentFee(null)}
        platformFeeId={recordPaymentFee?.id ?? ''}
        fee={recordPaymentFee}
        onRecorded={handlePaymentRecorded}
      />

      <PaymentHistoryDrawer
        open={!!historyFeeId}
        onOpenChange={(v) => !v && setHistoryFeeId(null)}
        platformFeeId={historyFeeId}
        onRecordPayment={() => {
          if (historyFeeId) {
            const fee = data?.data.find((r) => r.id === historyFeeId) ?? null
            setHistoryFeeId(null)
            if (fee) setRecordPaymentFee(fee)
          }
        }}
      />
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon,
  accent,
  loading,
}: {
  title: string
  value: number
  icon: React.ReactNode
  accent: string
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-7 w-28 mt-1.5" />
            ) : (
              <p className="text-xl font-bold mt-1">{formatCurrency(value)}</p>
            )}
          </div>
          <div className={`rounded-lg p-2 ${accent}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function PlatformFeeForm({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: PlatformFee | null
  onSubmit: (values: Record<string, string | null>) => Promise<void>
}) {
  const [recordType, setRecordType] = useState<RecordType>('SI')
  const [recordCode, setRecordCode] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [baseAmount, setBaseAmount] = useState(String(DEFAULT_BASE))
  const [gstRate, setGstRate] = useState(String(DEFAULT_GST_RATE))
  const [lateFee, setLateFee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setRecordType(editing?.recordType ?? 'SI')
      setRecordCode(editing?.recordCode ?? '')
      setMonth(editing?.month ?? currentMonth())
      setInvoiceNumber(editing?.invoiceNumber ?? '')
      setBaseAmount(editing ? String(editing.baseAmount) : String(DEFAULT_BASE))
      setGstRate(editing ? String(editing.gstRate) : String(DEFAULT_GST_RATE))
      setLateFee(editing?.lateFee ? String(editing.lateFee) : '')
      setDueDate(editing?.dueDate ? editing.dueDate.slice(0, 10) : '')
      setNotes(editing?.notes ?? '')
      setError(null)
    }
  }, [open, editing])

  const baseNum = parseFloat(baseAmount) || 0
  const gstNum = parseFloat(gstRate) || 0
  const lateFeeNum = parseFloat(lateFee) || 0
  const gstAmount = +(baseNum * (gstNum / 100)).toFixed(2)
  const totalAmount = +(baseNum + gstAmount).toFixed(2)
  const totalDue = +(totalAmount + lateFeeNum).toFixed(2)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recordCode.trim() || !month.trim()) {
      setError('Location Code and Month are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        recordType,
        recordCode,
        month,
        invoiceNumber: invoiceNumber.trim() || null,
        baseAmount: baseAmount || null,
        gstRate: gstRate || null,
        lateFee: lateFee || null,
        dueDate: dueDate || null,
        notes: notes || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Platform Fee' : 'Add Platform Fee'}
          </DialogTitle>
          <DialogDescription>
            Monthly platform fee per location. Default: {formatCurrency(DEFAULT_BASE)} +{' '}
            {DEFAULT_GST_RATE}% GST.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Location Type *</Label>
              <Select value={recordType} onValueChange={(v) => setRecordType(v as RecordType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SI">SI</SelectItem>
                  <SelectItem value="Spotlight">Spotlight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Month *</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recentMonths(12).map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonth(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recordCode" className="text-xs font-medium">
              {recordType} Location *{' '}
              <span className="text-muted-foreground">
                (search &amp; select from {recordType} locations)
              </span>
            </Label>
            <LocationPicker
              value={recordCode}
              onChange={setRecordCode}
              type={recordType}
              allowManualEntry
              placeholder={`Select ${recordType} location...`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoiceNumber" className="text-xs font-medium">
              Invoice Number{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-2025-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="baseAmount" className="text-xs font-medium">
                Base Amount (INR)
              </Label>
              <Input
                id="baseAmount"
                type="number"
                step="any"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstRate" className="text-xs font-medium">
                GST Rate (%)
              </Label>
              <Input
                id="gstRate"
                type="number"
                step="any"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lateFee" className="text-xs font-medium">
                Late Fee (INR)
              </Label>
              <Input
                id="lateFee"
                type="number"
                step="any"
                value={lateFee}
                onChange={(e) => setLateFee(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="text-xs font-medium">
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">GST Amount</p>
              <p className="font-medium">{formatCurrency(gstAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold text-primary">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Due</p>
              <p className="font-semibold">
                {formatCurrency(totalDue)}
                {lateFeeNum > 0 && (
                  <span className="ml-1 text-[10px] text-amber-600">
                    (incl. late fee)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">Notes</Label>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Update Entry' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GenerateDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onGenerated: () => Promise<void>
}) {
  const { toast } = useToast()
  const [month, setMonth] = useState(currentMonth())
  const [recordType, setRecordType] = useState<RecordType>('SI')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    liveCount: number
    created: number
    skipped: number
    errors: string[]
  } | null>(null)

  useEffect(() => {
    if (open) {
      setMonth(currentMonth())
      setRecordType('SI')
      setResult(null)
    }
  }, [open])

  async function handleGenerate() {
    setLoading(true)
    setResult(null)
    try {
      const r = await generatePlatformFees(month, recordType)
      setResult({
        liveCount: r.liveCount,
        created: r.created,
        skipped: r.skipped,
        errors: r.errors,
      })
      toast({
        title: 'Generation complete',
        description: `Created ${r.created}, skipped ${r.skipped} (already existed)`,
      })
      await onGenerated()
    } catch (e) {
      toast({
        title: 'Generation failed',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auto-Generate Platform Fees
          </DialogTitle>
          <DialogDescription>
            Create platform fee entries for all live {recordType} locations for the
            selected month. Existing entries for that month are skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Location Type</Label>
              <Select value={recordType} onValueChange={(v) => setRecordType(v as RecordType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SI">SI (recommended)</SelectItem>
                  <SelectItem value="Spotlight">Spotlight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recentMonths(12).map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonth(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Each generated entry: Base {formatCurrency(DEFAULT_BASE)} +{' '}
            {DEFAULT_GST_RATE}% GST = {formatCurrency(9510.8)} (per live location).
          </div>
          {result && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
              <p className="font-medium">Generation summary</p>
              <p className="text-xs">
                Live locations: <b>{result.liveCount}</b> | Created:{' '}
                <b>{result.created}</b> | Skipped: <b>{result.skipped}</b>
              </p>
              {result.errors.length > 0 && (
                <p className="text-xs text-destructive">
                  {result.errors.length} error(s) occurred
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Close
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function downloadCSV(rows: PlatformFee[], filename: string) {
  const headers = [
    'Location Type',
    'Location Code',
    'Month',
    'Invoice Number',
    'Base Amount',
    'GST Rate',
    'GST Amount',
    'Total Amount',
    'Late Fee',
    'Amount Paid',
    'Payment Status',
    'Due Date',
    'Paid At',
    'Notes',
  ]
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const fmtDate = (v: string | null) => (v ? v.slice(0, 10) : '')
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.recordType,
        r.recordCode,
        r.month,
        r.invoiceNumber,
        r.baseAmount,
        r.gstRate,
        r.gstAmount,
        r.totalAmount,
        r.lateFee,
        r.amountPaid,
        r.paymentStatus,
        fmtDate(r.dueDate),
        fmtDate(r.paidAt),
        r.notes,
      ]
        .map(escape)
        .join(',')
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadPlatformFeesTemplate() {
  const headers = [
    'Location Type',
    'Location Code',
    'Month',
    'Base Amount',
    'GST Rate',
    'Status',
    'Notes',
  ]
  const sample = [
    'SI,10001,2025-01,8060,18,unpaid,',
    'SI,10002,2025-01,8060,18,paid,',
    'Spotlight,PU09A,2025-01,8060,18,unpaid,',
  ]
  const csv = [headers.join(','), ...sample].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'platform-fees-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
