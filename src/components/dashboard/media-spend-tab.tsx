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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
  Facebook,
  Chrome,
  Store,
  CheckCircle2,
  AlertTriangle,
  ChevronsUpDown,
  Check,
  Keyboard,
  Receipt,
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
  getLocations,
} from '@/lib/api'
import type { MediaSpend, RecordType, LiveSpotlightStore, LiveSpotlightSummary } from '@/lib/types'
import { currentMonth, formatMonth, recentMonths, formatCurrency, calculateMediaPayment } from '@/lib/validation'
import { FinanceImportDialog } from './finance-import-dialog'
import { LocationPicker } from './location-picker'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Meta = Facebook blue, Google = Google red, Total = neutral emerald
const META_ACCENT = 'bg-blue-500/10 text-blue-600'
const GOOGLE_ACCENT = 'bg-red-500/10 text-red-600'
const TOTAL_ACCENT = 'bg-emerald-500/10 text-emerald-600'

export function MediaSpendTab({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [monthFilter, setMonthFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ data: MediaSpend[]; total: number; totalPages: number } | null>(null)
  const [summary, setSummary] = useState<{
    metaAllocated: number
    metaUtilized: number
    metaPending: number
    googleAllocated: number
    googleUtilized: number
    googlePending: number
    totalAllocated: number
    totalUtilized: number
    totalPending: number
  } | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MediaSpend | null>(null)
  const [presetCode, setPresetCode] = useState<string | null>(null)
  const [presetMonth, setPresetMonth] = useState<string | null>(null)
  const [liveStores, setLiveStores] = useState<LiveSpotlightStore[]>([])
  const [liveSummary, setLiveSummary] = useState<LiveSpotlightSummary | null>(null)
  const [showMissing, setShowMissing] = useState(false)
  const [missingSearch, setMissingSearch] = useState('')
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
      })
      setData({
        data: res.data,
        total: res.total,
        totalPages: res.totalPages,
      })
      setLiveStores(res.liveSpotlightStores ?? [])
      setLiveSummary(res.liveSpotlightSummary ?? null)
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
  }, [page, pageSize, debouncedSearch, monthFilter, toast])

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
          const ms = s.mediaSpend
          setSummary({
            metaAllocated: ms.metaAllocated ?? 0,
            metaUtilized: ms.metaUtilized ?? 0,
            metaPending: ms.metaPending ?? 0,
            googleAllocated: ms.googleAllocated ?? 0,
            googleUtilized: ms.googleUtilized ?? 0,
            googlePending: ms.googlePending ?? 0,
            totalAllocated: ms.totalAllocated ?? 0,
            totalUtilized: ms.totalUtilized ?? 0,
            totalPending: ms.totalPending ?? 0,
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
    setPresetCode(null)
    setPresetMonth(null)
    setFormOpen(true)
  }

  function openAddFor(code: string, month?: string) {
    setEditing(null)
    setPresetCode(code)
    setPresetMonth(month ?? null)
    setFormOpen(true)
  }

  function openEdit(row: MediaSpend) {
    setEditing(row)
    setFormOpen(true)
  }

  async function handleSubmit(values: Record<string, string | null>) {
    const payload = {
      recordType: (values.recordType as RecordType) || 'Spotlight',
      recordCode: values.recordCode ?? '',
      month: values.month ?? currentMonth(),
      metaAllocated: values.metaAllocated ? parseFloat(values.metaAllocated) : 0,
      metaUtilized: values.metaUtilized ? parseFloat(values.metaUtilized) : 0,
      googleAllocated: values.googleAllocated ? parseFloat(values.googleAllocated) : 0,
      googleUtilized: values.googleUtilized ? parseFloat(values.googleUtilized) : 0,
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

  const missingStores = liveStores
    .filter((s) => !s.hasBudget)
    .filter((s) => {
      if (!missingSearch.trim()) return true
      const q = missingSearch.trim().toLowerCase()
      return (
        s.code.toLowerCase().includes(q) ||
        (s.name ?? '').toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q) ||
        (s.state ?? '').toLowerCase().includes(q)
      )
    })

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
            Track monthly Meta and Google ad spend per location - allocated
            budget, utilized amount, and wallet balance carried forward.
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

      {/* Summary cards: Meta / Google / Total */}
      <div className="space-y-4">
        {/* Meta row */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <Facebook className="h-3.5 w-3.5" />
            <span>META</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              title="Meta Allocated"
              value={summary?.metaAllocated ?? 0}
              icon={<Wallet className="h-5 w-5" />}
              accent={META_ACCENT}
              loading={statsLoading}
            />
            <SummaryCard
              title="Meta Utilized"
              value={summary?.metaUtilized ?? 0}
              icon={<TrendingDown className="h-5 w-5" />}
              accent={META_ACCENT}
              loading={statsLoading}
            />
            <SummaryCard
              title="Meta Pending Wallet"
              value={summary?.metaPending ?? 0}
              icon={<PiggyBank className="h-5 w-5" />}
              accent={META_ACCENT}
              loading={statsLoading}
            />
          </div>
        </div>

        {/* Google row */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <Chrome className="h-3.5 w-3.5" />
            <span>GOOGLE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              title="Google Allocated"
              value={summary?.googleAllocated ?? 0}
              icon={<Wallet className="h-5 w-5" />}
              accent={GOOGLE_ACCENT}
              loading={statsLoading}
            />
            <SummaryCard
              title="Google Utilized"
              value={summary?.googleUtilized ?? 0}
              icon={<TrendingDown className="h-5 w-5" />}
              accent={GOOGLE_ACCENT}
              loading={statsLoading}
            />
            <SummaryCard
              title="Google Pending Wallet"
              value={summary?.googlePending ?? 0}
              icon={<PiggyBank className="h-5 w-5" />}
              accent={GOOGLE_ACCENT}
              loading={statsLoading}
            />
          </div>
        </div>

        {/* Total row */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Wallet className="h-3.5 w-3.5" />
            <span>TOTAL</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              title="Total Allocated"
              value={summary?.totalAllocated ?? 0}
              icon={<Wallet className="h-5 w-5" />}
              accent={TOTAL_ACCENT}
              loading={statsLoading}
            />
            <SummaryCard
              title="Total Utilized"
              value={summary?.totalUtilized ?? 0}
              icon={<TrendingDown className="h-5 w-5" />}
              accent={TOTAL_ACCENT}
              loading={statsLoading}
            />
            <SummaryCard
              title="Total Pending Wallet"
              value={summary?.totalPending ?? 0}
              icon={<PiggyBank className="h-5 w-5" />}
              accent={TOTAL_ACCENT}
              loading={statsLoading}
            />
          </div>
        </div>
      </div>

      {/* Live Spotlight stores coverage */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg p-1.5 bg-emerald-500/10 text-emerald-600">
                  <Store className="h-4 w-4" />
                </div>
                <div className="text-sm">
                  <span className="font-bold">{liveSummary?.total ?? liveStores.length}</span>{' '}
                  <span className="text-muted-foreground">live Spotlight stores</span>
                </div>
              </div>
              <Separator orientation="vertical" className="h-6 hidden sm:block" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-emerald-700">{liveSummary?.withBudget ?? 0}</span>{' '}
                  <span className="text-muted-foreground">
                    with budget{liveSummary ? ` for ${formatMonth(liveSummary.month)}` : ''}
                  </span>
                </div>
              </div>
              <Separator orientation="vertical" className="h-6 hidden sm:block" />
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-amber-700">{liveSummary?.withoutBudget ?? 0}</span>{' '}
                  <span className="text-muted-foreground">missing budget</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMissing((s) => !s)}
            >
              {showMissing ? 'Hide' : 'View'} stores without budget
            </Button>
          </div>

          {showMissing && (
            <div className="mt-4 border-t pt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  All live Spotlight store codes without a media budget
                  {liveSummary ? ` for ${formatMonth(liveSummary.month)}` : ''}. Click{' '}
                  <Plus className="inline h-3 w-3" /> to add their budget.
                </p>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter stores..."
                    value={missingSearch}
                    onChange={(e) => setMissingSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {missingStores.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    All live Spotlight stores have a budget entry
                    {liveSummary ? ` for ${formatMonth(liveSummary.month)}` : ''}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {missingStores.map((s) => (
                      <div
                        key={s.code}
                        className="group flex items-center gap-2 rounded-full border bg-muted/30 pl-3 pr-1 py-1 hover:border-primary/40 hover:bg-muted/60"
                      >
                        <div className="flex flex-col leading-tight">
                          <span className="font-mono text-[11px] font-semibold">{s.code}</span>
                          {s.name && (
                            <span className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                              {s.name}
                            </span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-full"
                          title={`Add media budget for ${s.code}`}
                          onClick={() => openAddFor(s.code, liveSummary?.month)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by location code or notes..."
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
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="whitespace-nowrap align-bottom">Location</TableHead>
                <TableHead rowSpan={2} className="whitespace-nowrap align-bottom">Month</TableHead>
                <TableHead colSpan={3} className="text-center border-l border-r border-blue-200 bg-blue-500/5 text-blue-700">
                  <div className="flex items-center justify-center gap-1.5">
                    <Facebook className="h-3.5 w-3.5" />
                    <span>Meta</span>
                  </div>
                </TableHead>
                <TableHead colSpan={3} className="text-center border-l border-r border-red-200 bg-red-500/5 text-red-700">
                  <div className="flex items-center justify-center gap-1.5">
                    <Chrome className="h-3.5 w-3.5" />
                    <span>Google</span>
                  </div>
                </TableHead>
                <TableHead colSpan={3} className="text-center border-l border-r bg-muted/60">
                  <div className="flex items-center justify-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Total</span>
                  </div>
                </TableHead>
                <TableHead rowSpan={2} className="whitespace-nowrap align-bottom">Notes</TableHead>
                <TableHead rowSpan={2} className="w-[60px] text-right align-bottom">Actions</TableHead>
              </TableRow>
              <TableRow>
                {/* Meta sub-columns */}
                <TableHead className="text-right whitespace-nowrap bg-blue-500/5 text-blue-700 border-l border-blue-200">Allocated</TableHead>
                <TableHead className="text-right whitespace-nowrap bg-blue-500/5 text-blue-700">Utilized</TableHead>
                <TableHead className="text-right whitespace-nowrap bg-blue-500/5 text-blue-700 border-r border-blue-200">Pending</TableHead>
                {/* Google sub-columns */}
                <TableHead className="text-right whitespace-nowrap bg-red-500/5 text-red-700 border-l border-red-200">Allocated</TableHead>
                <TableHead className="text-right whitespace-nowrap bg-red-500/5 text-red-700">Utilized</TableHead>
                <TableHead className="text-right whitespace-nowrap bg-red-500/5 text-red-700 border-r border-red-200">Pending</TableHead>
                {/* Total sub-columns */}
                <TableHead className="text-right whitespace-nowrap bg-muted/60 border-l">Allocated</TableHead>
                <TableHead className="text-right whitespace-nowrap bg-muted/60">Utilized</TableHead>
                <TableHead className="text-right whitespace-nowrap bg-muted/60 border-r">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: 13 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full max-w-[100px]" />
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
                      {/* Meta */}
                      <TableCell className="text-right whitespace-nowrap text-blue-700 border-l border-blue-200/60">
                        {formatCurrency(row.metaAllocated)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-blue-700">
                        {formatCurrency(row.metaUtilized)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium text-blue-700 border-r border-blue-200/60">
                        {formatCurrency(row.metaPendingInWallet)}
                      </TableCell>
                      {/* Google */}
                      <TableCell className="text-right whitespace-nowrap text-red-700 border-l border-red-200/60">
                        {formatCurrency(row.googleAllocated)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-red-700">
                        {formatCurrency(row.googleUtilized)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium text-red-700 border-r border-red-200/60">
                        {formatCurrency(row.googlePendingInWallet)}
                      </TableCell>
                      {/* Total */}
                      <TableCell className="text-right whitespace-nowrap font-medium text-emerald-700 border-l">
                        {formatCurrency(row.allocated)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-amber-700">
                        {formatCurrency(row.utilized)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap border-r">
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
                    colSpan={13}
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
        liveStores={liveStores}
        presetCode={presetCode}
        presetMonth={presetMonth}
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
        description="Upload an Excel/CSV file with per-location per-month Meta + Google ad budget. Each row matches a location + month and will be upserted."
        expectedColumns={[
          'Location Code',
          'Month',
          'Meta Allocated',
          'Meta Utilized',
          'Google Allocated',
          'Google Utilized',
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
  liveStores,
  presetCode,
  presetMonth,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: MediaSpend | null
  liveStores: LiveSpotlightStore[]
  presetCode: string | null
  presetMonth: string | null
  onSubmit: (values: Record<string, string | null>) => Promise<void>
}) {
  const [recordCode, setRecordCode] = useState('')
  const [siCode, setSiCode] = useState('')
  const [siLocations, setSiLocations] = useState<{ siCode: string; businessName: string | null; city: string | null; state: string | null; linkedSpotlightCode: string | null }[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [metaAllocated, setMetaAllocated] = useState('')
  const [metaUtilized, setMetaUtilized] = useState('')
  const [googleAllocated, setGoogleAllocated] = useState('')
  const [googleUtilized, setGoogleUtilized] = useState('')
  const [gstRate, setGstRate] = useState('18')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storePickerOpen, setStorePickerOpen] = useState(false)
  const [manualEntry, setManualEntry] = useState(false)

  useEffect(() => {
    if (open) {
      setRecordCode(editing?.recordCode ?? presetCode ?? '')
      setSiCode(editing?.recordCode ?? presetCode ?? '')
      setMonth(editing?.month ?? presetMonth ?? currentMonth())
      setMetaAllocated(editing ? String(editing.metaAllocated) : '')
      setMetaUtilized(editing ? String(editing.metaUtilized) : '')
      setGoogleAllocated(editing ? String(editing.googleAllocated) : '')
      setGoogleUtilized(editing ? String(editing.googleUtilized) : '')
      setGstRate(editing ? String(editing.gstRate) : '18')
      setReceivedAmount(editing ? String(editing.receivedAmount) : '')
      setNotes(editing?.notes ?? '')
      setError(null)
      setStorePickerOpen(false)
      // Fall back to manual entry when the code is not among live stores
      setManualEntry(
        !editing && !presetCode
          ? false
          : !liveStores.some((s) => s.code === (editing?.recordCode ?? presetCode))
      )
    }
  }, [open, editing, presetCode, presetMonth, liveStores])

  // Fetch all SI locations for the SI dropdown
  useEffect(() => {
    getLocations().then((res) => {
      setSiLocations(res.si.map((s) => ({
        siCode: s.siCode,
        businessName: s.businessName,
        city: s.city,
        state: s.state,
        linkedSpotlightCode: s.linkedSpotlightCode,
      })))
    }).catch(() => {
      // silent — the Spotlight picker still works
    })
  }, [])

  // When an SI location is selected, auto-map it to the Spotlight code
  // via linkedSpotlightCode.
  const handleSiSelect = (code: string) => {
    setSiCode(code)
    const si = siLocations.find((s) => s.siCode === code)
    if (si?.linkedSpotlightCode) {
      setRecordCode(si.linkedSpotlightCode)
      setManualEntry(false)
    } else {
      // No linked Spotlight code — fall back to manual entry of the code
      setRecordCode(code)
      setManualEntry(true)
    }
  }

  // Store options: all live Spotlight stores. When editing a record whose
  // code is no longer live, include it so the current value stays visible.
  const storeOptions: LiveSpotlightStore[] = (() => {
    const base = [...liveStores]
    if (recordCode && !base.some((s) => s.code === recordCode)) {
      base.unshift({ code: recordCode, name: null, city: null, state: null, hasBudget: true })
    }
    return base.sort((a, b) => a.code.localeCompare(b.code))
  })()
  const selectedStore = storeOptions.find((s) => s.code === recordCode)

  // Live preview of pending = allocated - utilized (excludes prev. month balance
  // which is added by the backend automatically)
  const metaPreview = (parseFloat(metaAllocated) || 0) - (parseFloat(metaUtilized) || 0)
  const googlePreview = (parseFloat(googleAllocated) || 0) - (parseFloat(googleUtilized) || 0)

  // Media payment preview: GST + invoiced + TDS (auto-calculated)
  const totalUtilized = (parseFloat(metaUtilized) || 0) + (parseFloat(googleUtilized) || 0)
  const gstRateNum = parseFloat(gstRate) || 0
  const receivedNum = parseFloat(receivedAmount) || 0
  const paymentPreview = calculateMediaPayment(totalUtilized, gstRateNum, receivedNum)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recordCode.trim() || !month.trim()) {
      setError('Store Code and Month are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        recordType: 'Spotlight',
        recordCode,
        month,
        metaAllocated: metaAllocated || null,
        metaUtilized: metaUtilized || null,
        googleAllocated: googleAllocated || null,
        googleUtilized: googleUtilized || null,
        gstRate: gstRate || null,
        receivedAmount: receivedAmount || null,
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Media Spend Entry' : 'Add Media Spend Entry'}
          </DialogTitle>
          <DialogDescription>
            Track Meta and Google ad spend for a location in a specific month.
            Wallet balances are auto-calculated from the previous month&apos;s
            record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SI Location selector — the source of truth for nomenclature.
              Selecting an SI auto-maps to its linked Spotlight code. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              SI Location <span className="text-muted-foreground">(select to auto-map Spotlight code)</span>
            </Label>
            <LocationPicker
              value={siCode}
              onChange={handleSiSelect}
              type="SI"
              placeholder="Search SI location by code, name, city..."
            />
            {siCode && recordCode && siCode !== recordCode && (
              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Auto-mapped to Spotlight code: <span className="font-mono font-semibold">{recordCode}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">
                  Spotlight Store <span className="text-muted-foreground">(live/active)</span> *
                </Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => setManualEntry((m) => !m)}
                >
                  <Keyboard className="h-3 w-3" />
                  {manualEntry ? 'Pick from list' : 'Enter code manually'}
                </button>
              </div>
              {manualEntry ? (
                <Input
                  value={recordCode}
                  onChange={(e) => setRecordCode(e.target.value)}
                  placeholder="Spotlight Client Code, e.g. PU09A"
                  className="font-mono"
                />
              ) : (
                <Popover open={storePickerOpen} onOpenChange={setStorePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={storePickerOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {selectedStore ? (
                          <>
                            <span className="font-mono text-xs font-semibold">{selectedStore.code}</span>
                            <span className="text-muted-foreground truncate text-xs">
                              {selectedStore.name ?? selectedStore.city ?? ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Select a live Spotlight store ({liveStores.length} active)...
                          </span>
                        )}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search store code, name, city..." />
                      <CommandList>
                        <CommandEmpty>No live Spotlight store found.</CommandEmpty>
                        <CommandGroup>
                          {storeOptions.map((s) => (
                            <CommandItem
                              key={s.code}
                              value={`${s.code} ${s.name ?? ''} ${s.city ?? ''} ${s.state ?? ''}`}
                              onSelect={() => {
                                setRecordCode(s.code)
                                setStorePickerOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4 shrink-0',
                                  recordCode === s.code ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div className="flex min-w-0 flex-col">
                                <span className="font-mono text-xs font-semibold">{s.code}</span>
                                <span className="truncate text-[11px] text-muted-foreground">
                                  {[s.name, s.city, s.state].filter(Boolean).join(' · ') || '—'}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                                  s.hasBudget
                                    ? 'bg-emerald-500/10 text-emerald-700'
                                    : 'bg-amber-500/10 text-amber-700'
                                )}
                              >
                                {s.hasBudget ? 'budgeted' : 'no budget'}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              <p className="text-[10px] text-muted-foreground">
                Only stores that are active (live) in Spotlight are listed. Media
                spend is tracked per Spotlight location.
              </p>
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

          {/* Meta section */}
          <div className="rounded-lg border border-blue-200 bg-blue-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-blue-700">
              <Facebook className="h-4 w-4" />
              <span className="text-sm font-semibold">Meta (Facebook Ads)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="metaAllocated" className="text-xs font-medium">
                  Meta Allocated (INR)
                </Label>
                <Input
                  id="metaAllocated"
                  type="number"
                  step="any"
                  min="0"
                  value={metaAllocated}
                  onChange={(e) => setMetaAllocated(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="metaUtilized" className="text-xs font-medium">
                  Meta Utilized (INR)
                </Label>
                <Input
                  id="metaUtilized"
                  type="number"
                  step="any"
                  min="0"
                  value={metaUtilized}
                  onChange={(e) => setMetaUtilized(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-blue-500/10 px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-blue-700">
                Meta Pending Wallet (auto)
              </span>
              <span className="text-xs text-blue-700">
                <span className="font-semibold">{formatCurrency(metaPreview)}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  = alloc + prev − util
                </span>
              </span>
            </div>
          </div>

          {/* Google section */}
          <div className="rounded-lg border border-red-200 bg-red-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-red-700">
              <Chrome className="h-4 w-4" />
              <span className="text-sm font-semibold">Google Ads</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="googleAllocated" className="text-xs font-medium">
                  Google Allocated (INR)
                </Label>
                <Input
                  id="googleAllocated"
                  type="number"
                  step="any"
                  min="0"
                  value={googleAllocated}
                  onChange={(e) => setGoogleAllocated(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="googleUtilized" className="text-xs font-medium">
                  Google Utilized (INR)
                </Label>
                <Input
                  id="googleUtilized"
                  type="number"
                  step="any"
                  min="0"
                  value={googleUtilized}
                  onChange={(e) => setGoogleUtilized(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-red-500/10 px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-red-700">
                Google Pending Wallet (auto)
              </span>
              <span className="text-xs text-red-700">
                <span className="font-semibold">{formatCurrency(googlePreview)}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  = alloc + prev − util
                </span>
              </span>
            </div>
          </div>

          {/* Media Payment / Billing — GST, invoiced, received, TDS */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <Receipt className="h-4 w-4" />
              <span className="text-sm font-semibold">Media Payment &amp; Billing</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                auto-calculated from total utilized
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gstRate" className="text-xs font-medium">
                  GST Rate (%)
                </Label>
                <Input
                  id="gstRate"
                  type="number"
                  step="any"
                  min="0"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  placeholder="18"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receivedAmount" className="text-xs font-medium">
                  Received Amount (INR)
                </Label>
                <Input
                  id="receivedAmount"
                  type="number"
                  step="any"
                  min="0"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1 col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Total Utilized (Meta + Google)
                </Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm font-semibold tabular-nums">
                  {formatCurrency(totalUtilized)}
                </div>
              </div>
            </div>
            {/* Auto-calculated summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md bg-emerald-500/10 p-2.5">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase">GST Amount</p>
                <p className="text-sm font-bold text-emerald-700 tabular-nums">
                  {formatCurrency(paymentPreview.gstAmount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Invoiced</p>
                <p className="text-sm font-bold tabular-nums">
                  {formatCurrency(paymentPreview.invoicedAmount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase">TDS Cut</p>
                <p className="text-sm font-bold text-amber-600 tabular-nums">
                  {formatCurrency(paymentPreview.tdsAmount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase">TDS %</p>
                <p className="text-sm font-bold text-amber-600 tabular-nums">
                  {paymentPreview.tdsPercentage}%
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Invoiced = Utilized + GST. TDS = Invoiced − Received. TDS % = (TDS / Invoiced) × 100.
            </p>
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
    'Meta Allocated',
    'Meta Utilized',
    'Meta Pending in Wallet',
    'Google Allocated',
    'Google Utilized',
    'Google Pending in Wallet',
    'Total Allocated',
    'Total Utilized',
    'Total Pending in Wallet',
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
        r.metaAllocated,
        r.metaUtilized,
        r.metaPendingInWallet,
        r.googleAllocated,
        r.googleUtilized,
        r.googlePendingInWallet,
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
    'Location Code',
    'Month',
    'Meta Allocated',
    'Meta Utilized',
    'Google Allocated',
    'Google Utilized',
    'Notes',
  ]
  const sample = [
    'PU09A,2025-01,25000,18000,15000,12000,Jan campaigns',
    'PU10B,2025-01,30000,22000,10000,8000,',
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
