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
  Wallet,
  TrendingDown,
  PiggyBank,
  Upload,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  listMediaSpend,
  createMediaSpend,
  updateMediaSpend,
  deleteMediaSpend,
  exportMediaSpend,
  getStats,
  importMediaSpendFile,
} from '@/lib/api'
import type { MediaSpend, RecordType } from '@/lib/types'
import { currentMonth, formatMonth, recentMonths, formatCurrency } from '@/lib/validation'
import { FinanceImportDialog } from './finance-import-dialog'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function MediaSpendTab({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [monthFilter, setMonthFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | RecordType>('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ data: MediaSpend[]; total: number; totalPages: number } | null>(null)
  const [summary, setSummary] = useState<{
    totalAllocated: number
    totalUtilized: number
    totalPending: number
  } | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MediaSpend | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MediaSpend | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

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
      const res = await listMediaSpend({
        page,
        pageSize,
        search: debouncedSearch,
        month: monthFilter,
        recordType: typeFilter || undefined,
      })
      setData({
        data: res.data,
        total: res.total,
        totalPages: res.totalPages,
      })
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
  }, [page, pageSize, debouncedSearch, monthFilter, typeFilter, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch summary
  const [statsLoadedKey, setStatsLoadedKey] = useState<number | null>(null)
  const [localRefresh, setLocalRefresh] = useState(0)
  const statsKey = `${refreshKey}-${localRefresh}`
  const statsLoading = statsLoadedKey !== statsKey
  const triggerStatsRefresh = useCallback(() => {
    setLocalRefresh((n) => n + 1)
  }, [])
  useEffect(() => {
    let cancelled = false
    getStats()
      .then((s) => {
        if (!cancelled) {
          setSummary({
            totalAllocated: s.mediaSpend.totalAllocated,
            totalUtilized: s.mediaSpend.totalUtilized,
            totalPending: s.mediaSpend.totalPending,
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

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row: MediaSpend) {
    setEditing(row)
    setFormOpen(true)
  }

  async function handleSubmit(values: Record<string, string | null>) {
    const payload = {
      recordType: (values.recordType as RecordType) || 'SI',
      recordCode: values.recordCode ?? '',
      month: values.month ?? currentMonth(),
      allocated: values.allocated ? parseFloat(values.allocated) : 0,
      utilized: values.utilized ? parseFloat(values.utilized) : 0,
      pendingInWallet: values.pendingInWallet
        ? parseFloat(values.pendingInWallet)
        : 0,
      notes: values.notes ?? null,
    }
    if (!payload.recordCode || !payload.month) {
      throw new Error('Location Code and Month are required')
    }
    if (editing) {
      await updateMediaSpend(editing.id, payload)
      toast({ title: 'Updated', description: 'Media spend record updated' })
    } else {
      await createMediaSpend(payload)
      toast({ title: 'Created', description: 'Media spend record created' })
    }
    await fetchData()
    triggerStatsRefresh()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteMediaSpend(deleteTarget.id)
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
      const res = await exportMediaSpend({
        search: debouncedSearch,
        month: monthFilter,
        recordType: typeFilter || undefined,
      })
      downloadCSV(res.data, 'media-spend.csv')
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
          <h2 className="text-xl font-semibold tracking-tight">Media Spend</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track monthly media spend per location - allocated budget, utilized
            amount, and wallet balance carried forward.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Allocated"
          value={summary?.totalAllocated ?? 0}
          icon={<Wallet className="h-5 w-5" />}
          accent="bg-emerald-500/10 text-emerald-600"
          loading={statsLoading}
        />
        <SummaryCard
          title="Total Utilized"
          value={summary?.totalUtilized ?? 0}
          icon={<TrendingDown className="h-5 w-5" />}
          accent="bg-amber-500/10 text-amber-600"
          loading={statsLoading}
        />
        <SummaryCard
          title="Pending in Wallet"
          value={summary?.totalPending ?? 0}
          icon={<PiggyBank className="h-5 w-5" />}
          accent="bg-violet-500/10 text-violet-600"
          loading={statsLoading}
        />
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
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Location</TableHead>
                <TableHead className="whitespace-nowrap">Month</TableHead>
                <TableHead className="text-right whitespace-nowrap">Allocated</TableHead>
                <TableHead className="text-right whitespace-nowrap">Utilized</TableHead>
                <TableHead className="text-right whitespace-nowrap">Pending in Wallet</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data && data.data.length > 0 ? (
                data.data.map((row) => {
                  const balance = row.allocated - row.utilized
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-medium">
                            {row.recordCode}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] w-fit mt-0.5"
                          >
                            {row.recordType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatMonth(row.month)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium text-emerald-600">
                        {formatCurrency(row.allocated)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-amber-600">
                        {formatCurrency(row.utilized)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold">
                            {formatCurrency(row.pendingInWallet)}
                          </span>
                          <span
                            className={`text-[10px] ${
                              balance >= 0 ? 'text-emerald-600' : 'text-destructive'
                            }`}
                          >
                            {balance >= 0 ? 'surplus' : 'deficit'}{' '}
                            {formatCurrency(Math.abs(balance))}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {row.notes ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No media spend records found. Add a new entry to get started.
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

      <MediaSpendForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this media spend entry?</AlertDialogTitle>
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
        title="Import Media Spend"
        description="Upload an Excel/CSV file with per-location per-month media budget. Each row matches a location + month and will be upserted."
        expectedColumns={[
          'Location Type',
          'Location Code',
          'Month',
          'Allocated',
          'Utilized',
          'Pending in Wallet',
          'Notes',
        ]}
        onImportFile={importMediaSpendFile}
        onImported={async () => {
          await fetchData()
          triggerStatsRefresh()
        }}
        downloadTemplate={downloadMediaSpendTemplate}
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

function MediaSpendForm({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: MediaSpend | null
  onSubmit: (values: Record<string, string | null>) => Promise<void>
}) {
  const [recordType, setRecordType] = useState<RecordType>('SI')
  const [recordCode, setRecordCode] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [allocated, setAllocated] = useState('')
  const [utilized, setUtilized] = useState('')
  const [pendingInWallet, setPendingInWallet] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setRecordType(editing?.recordType ?? 'SI')
      setRecordCode(editing?.recordCode ?? '')
      setMonth(editing?.month ?? currentMonth())
      setAllocated(editing ? String(editing.allocated) : '')
      setUtilized(editing ? String(editing.utilized) : '')
      setPendingInWallet(editing ? String(editing.pendingInWallet) : '')
      setNotes(editing?.notes ?? '')
      setError(null)
    }
  }, [open, editing])

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
        allocated: allocated || null,
        utilized: utilized || null,
        pendingInWallet: pendingInWallet || null,
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
            {editing ? 'Edit Media Spend Entry' : 'Add Media Spend Entry'}
          </DialogTitle>
          <DialogDescription>
            Track allocated budget, utilized amount, and wallet balance for a
            location in a specific month.
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
              Location Code * <span className="text-muted-foreground">(SI Code or Spotlight Client Code)</span>
            </Label>
            <Input
              id="recordCode"
              value={recordCode}
              onChange={(e) => setRecordCode(e.target.value)}
              placeholder={recordType === 'SI' ? '10001' : 'PU09A'}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="allocated" className="text-xs font-medium">Allocated (INR)</Label>
              <Input
                id="allocated"
                type="number"
                step="any"
                value={allocated}
                onChange={(e) => setAllocated(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utilized" className="text-xs font-medium">Utilized (INR)</Label>
              <Input
                id="utilized"
                type="number"
                step="any"
                value={utilized}
                onChange={(e) => setUtilized(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pending" className="text-xs font-medium">Pending in Wallet</Label>
              <Input
                id="pending"
                type="number"
                step="any"
                value={pendingInWallet}
                onChange={(e) => setPendingInWallet(e.target.value)}
                placeholder="0"
              />
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

function downloadCSV(rows: MediaSpend[], filename: string) {
  const headers = [
    'Location Type',
    'Location Code',
    'Month',
    'Allocated',
    'Utilized',
    'Pending in Wallet',
    'Notes',
  ]
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.recordType,
        r.recordCode,
        r.month,
        r.allocated,
        r.utilized,
        r.pendingInWallet,
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

function downloadMediaSpendTemplate() {
  const headers = [
    'Location Type',
    'Location Code',
    'Month',
    'Allocated',
    'Utilized',
    'Pending in Wallet',
    'Notes',
  ]
  const sample = [
    'SI,10001,2025-01,50000,32000,18000,Jan campaign',
    'Spotlight,PU09A,2025-01,30000,28000,2000,',
  ]
  const csv = [headers.join(','), ...sample].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'media-spend-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
