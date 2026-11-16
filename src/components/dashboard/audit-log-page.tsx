'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  History,
  RefreshCw,
  AlertTriangle,
  Filter,
  PlusCircle,
  Pencil,
  Trash2,
  ChevronDown,
  Activity,
  Clock,
  XCircle,
} from 'lucide-react'

interface AuditChange {
  field: string
  from: unknown
  to: unknown
}

interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  entityCode: string
  changes: AuditChange[] | Record<string, { from: unknown; to: unknown }> | null
  summary: string
  createdAt: string
}

interface AuditLogResponse {
  data: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const ENTITY_TYPES = [
  { value: 'SI', label: 'SI Record' },
  { value: 'Spotlight', label: 'Spotlight Record' },
  { value: 'MediaSpend', label: 'Media Spend' },
  { value: 'PlatformFee', label: 'Platform Fee' },
  { value: 'Payment', label: 'Payment' },
  { value: 'Rule', label: 'Rule' },
] as const

const ACTIONS = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
] as const

const ACTION_CONFIG: Record<
  string,
  { icon: React.ReactNode; badge: string; dot: string }
> = {
  create: {
    icon: <PlusCircle className="h-3.5 w-3.5" />,
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  update: {
    icon: <Pencil className="h-3.5 w-3.5" />,
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  delete: {
    icon: <Trash2 className="h-3.5 w-3.5" />,
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
}

const ENTITY_BADGE: Record<string, string> = {
  SI: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Spotlight: 'bg-amber-100 text-amber-700 border-amber-200',
  MediaSpend: 'bg-violet-100 text-violet-700 border-violet-200',
  PlatformFee: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Payment: 'bg-rose-100 text-rose-700 border-rose-200',
  Rule: 'bg-indigo-100 text-indigo-700 border-indigo-200',
}

const PAGE_SIZE = 25

export function AuditLogPage() {
  const [entityType, setEntityType] = useState<string>('all')
  const [action, setAction] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditLogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summaryCounts, setSummaryCounts] = useState<{
    total: number
    creates: number
    updates: number
    deletes: number
  }>({ total: 0, creates: 0, updates: 0, deletes: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      if (entityType !== 'all') params.set('entityType', entityType)
      if (action !== 'all') params.set('action', action)
      const res = await fetch(`/api/audit-logs?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      const json = (await res.json()) as AuditLogResponse
      setData(json)
      // Compute summary counts from current page (best-effort)
      // Server returns filtered set; we show counts for current filter
      const counts = { total: json.total, creates: 0, updates: 0, deletes: 0 }
      for (const e of json.data) {
        const a = e.action.toLowerCase()
        if (a === 'create') counts.creates++
        else if (a === 'update') counts.updates++
        else if (a === 'delete') counts.deletes++
      }
      setSummaryCounts(counts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, entityType, action])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleEntityTypeChange(v: string) {
    setEntityType(v)
    setPage(1)
  }
  function handleActionChange(v: string) {
    setAction(v)
    setPage(1)
  }

  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Audit Log
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete history of all data changes across records, fees, and payments.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Total Entries
                </p>
                <p className="text-2xl font-bold mt-1">{total}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <History className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <PlusCircle className="h-3 w-3" /> Creates
                </p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">
                  {summaryCounts.creates}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <PlusCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Updates
                </p>
                <p className="text-2xl font-bold mt-1 text-blue-600">
                  {summaryCounts.updates}
                </p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Pencil className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Deletes
                </p>
                <p className="text-2xl font-bold mt-1 text-red-600">
                  {summaryCounts.deletes}
                </p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-2">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Entity Type
              </label>
              <Select value={entityType} onValueChange={handleEntityTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All entity types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Action
              </label>
              <Select value={action} onValueChange={handleActionChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(entityType !== 'all' || action !== 'all') && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEntityType('all')
                    setAction('all')
                    setPage(1)
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit log table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Activity Timeline
              </CardTitle>
              <CardDescription>
                Reverse chronological order — click rows with changes to expand
              </CardDescription>
            </div>
            {data && data.data.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {total} entr{total === 1 ? 'y' : 'ies'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-10 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-2" />
              <p className="text-sm font-medium text-destructive">Failed to load audit logs</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : loading ? (
            <AuditLogSkeleton />
          ) : !data || data.data.length === 0 ? (
            <div className="py-12 text-center">
              <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">No audit entries found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {entityType !== 'all' || action !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Activity will appear here as changes are made.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap w-[170px]">Timestamp</TableHead>
                    <TableHead className="whitespace-nowrap w-[100px]">Action</TableHead>
                    <TableHead className="whitespace-nowrap w-[120px]">Entity</TableHead>
                    <TableHead className="whitespace-nowrap w-[110px]">Code</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="w-[60px] text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((entry) => (
                    <AuditLogRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {startIdx}-{endIdx} of {total} entries
            </span>
          </div>
          {totalPages > 1 && (
            <Pagination className="sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={
                      page === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
                <PaginationItem className="px-3 text-sm">
                  Page {page} of {totalPages}
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      page === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  )
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const changesList = normalizeChanges(entry.changes)
  const hasChanges = changesList.length > 0

  const actionKey = entry.action.toLowerCase()
  const actionCfg = ACTION_CONFIG[actionKey] ?? {
    icon: <Activity className="h-3.5 w-3.5" />,
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  }

  const entityBadge = ENTITY_BADGE[entry.entityType] ?? 'bg-muted text-muted-foreground'

  return (
    <>
      <TableRow
        className={hasChanges ? 'cursor-pointer hover:bg-muted/40' : ''}
        onClick={hasChanges ? () => setOpen((v) => !v) : undefined}
      >
        <TableCell className="whitespace-nowrap text-sm">
          <div className="flex flex-col">
            <span className="font-medium">{formatDate(entry.createdAt)}</span>
            <span className="text-xs text-muted-foreground">
              {formatTime(entry.createdAt)}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${actionCfg.badge}`}>
            {actionCfg.icon}
            <span className="ml-1 capitalize">{entry.action}</span>
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${entityBadge}`}>
            {entry.entityType}
          </Badge>
        </TableCell>
        <TableCell>
          <code className="text-xs font-mono font-medium">
            {entry.entityCode || '—'}
          </code>
        </TableCell>
        <TableCell>
          <span className="text-sm text-foreground">{entry.summary || '—'}</span>
        </TableCell>
        <TableCell className="text-right">
          {hasChanges ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((v) => !v)
              }}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {hasChanges && open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="py-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Changes ({changesList.length})
              </p>
              <div className="space-y-1.5">
                {changesList.map((c, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-[160px_1fr_1fr] gap-2 items-center text-xs"
                  >
                    <code className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {c.field}
                    </code>
                    <div className="flex items-center gap-1.5">
                      <span className="text-red-600 text-[10px] uppercase font-medium">From</span>
                      <code className="font-mono bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded truncate max-w-full">
                        {formatValue(c.from)}
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 text-[10px] uppercase font-medium">To</span>
                      <code className="font-mono bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded truncate max-w-full">
                        {formatValue(c.to)}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'string') return v === '' ? '∅' : `"${v}"`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function normalizeChanges(
  changes: AuditLogEntry['changes']
): { field: string; from: unknown; to: unknown }[] {
  if (!changes) return []
  if (Array.isArray(changes)) {
    return changes.map((c) => ({
      field: c.field,
      from: c.from,
      to: c.to,
    }))
  }
  // Object form: { fieldName: { from, to } }
  return Object.entries(changes).map(([field, val]) => {
    if (val && typeof val === 'object' && 'from' in val && 'to' in val) {
      return {
        field,
        from: (val as { from: unknown }).from,
        to: (val as { to: unknown }).to,
      }
    }
    return { field, from: undefined, to: val }
  })
}

function AuditLogSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[170px_100px_120px_110px_1fr_60px] gap-3 items-center py-2"
        >
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-full max-w-[400px]" />
          <Skeleton className="h-7 w-7 ml-auto" />
        </div>
      ))}
    </div>
  )
}
