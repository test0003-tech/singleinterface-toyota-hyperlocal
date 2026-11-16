'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Power,
  Copy,
  FileWarning,
  CalendarOff,
  Building2,
  MapPin,
} from 'lucide-react'

interface FieldQuality {
  field: string
  label: string
  filled: number
  total: number
  missing: number
  completeness: number
}

interface DuplicateEntry {
  field?: string
  value?: string
  count?: number
  codes?: string[]
  [key: string]: unknown
}

interface EntityQuality {
  total: number
  live: number
  overallCompleteness: number
  fieldQuality: FieldQuality[]
  duplicates: DuplicateEntry[]
  withLinkedSpotlight?: number
  liveWithLinkedSpotlight?: number
}

interface DataQualityData {
  si: EntityQuality
  spotlight: EntityQuality
  payments: {
    totalFees: number
    withoutInvoice: number
    withoutDueDate: number
  }
  mediaSpend: {
    totalEntries: number
  }
  recommendations: {
    severity: 'critical' | 'warning' | 'info'
    message: string
  }[]
}

const SEVERITY_CONFIG: Record<
  string,
  { icon: React.ReactNode; border: string; bg: string; badge: string; title: string }
> = {
  critical: {
    icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
    border: 'border-red-200',
    bg: 'bg-red-50 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-700 border-red-200',
    title: 'text-red-700 dark:text-red-400',
  },
  warning: {
    icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
    border: 'border-amber-200',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    title: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    icon: <Info className="h-4 w-4 text-primary" />,
    border: 'border-primary/20',
    bg: 'bg-primary/5',
    badge: 'bg-primary/10 text-primary border-primary/20',
    title: 'text-primary',
  },
}

export function DataQualityPage() {
  const [data, setData] = useState<DataQualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/data-quality')
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      const json = (await res.json()) as DataQualityData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data quality')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Failed to load data quality</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading || !data) {
    return <DataQualitySkeleton />
  }

  const siDupCount = data.si.duplicates.length
  const spotDupCount = data.spotlight.duplicates.length
  const totalDup = siDupCount + spotDupCount

  const criticalCount = data.recommendations.filter((r) => r.severity === 'critical').length
  const warningCount = data.recommendations.filter((r) => r.severity === 'warning').length
  const infoCount = data.recommendations.filter((r) => r.severity === 'info').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Data Quality
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Field-level completeness, duplicates, and recommendations for healthier data.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall completeness cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompletenessCard
          title="SI Completeness"
          icon={<Building2 className="h-5 w-5 text-emerald-600" />}
          completeness={data.si.overallCompleteness}
          total={data.si.total}
          live={data.si.live}
          colorClass="bg-emerald-500"
          accentBorder="border-emerald-200"
        />
        <CompletenessCard
          title="Spotlight Completeness"
          icon={<MapPin className="h-5 w-5 text-amber-600" />}
          completeness={data.spotlight.overallCompleteness}
          total={data.spotlight.total}
          live={data.spotlight.live}
          colorClass="bg-amber-500"
          accentBorder="border-amber-200"
        />
      </div>

      {/* Live coverage + data issues */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-emerald-600" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">SI Live</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{data.si.live}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              / {data.si.total} records
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Spotlight Live</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{data.spotlight.live}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              / {data.spotlight.total} records
            </p>
          </CardContent>
        </Card>
        <Card className={totalDup > 0 ? 'border-red-200' : ''}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-red-600" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Duplicates</p>
            </div>
            <p className={`text-2xl font-bold mt-1 ${totalDup > 0 ? 'text-red-600' : ''}`}>
              {totalDup}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              SI: {siDupCount} • Spot: {spotDupCount}
            </p>
          </CardContent>
        </Card>
        <Card className={data.payments.withoutInvoice > 0 ? 'border-amber-200' : ''}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fees w/o Invoice</p>
            </div>
            <p
              className={`text-2xl font-bold mt-1 ${
                data.payments.withoutInvoice > 0 ? 'text-amber-600' : ''
              }`}
            >
              {data.payments.withoutInvoice}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              / {data.payments.totalFees} fees
            </p>
          </CardContent>
        </Card>
        <Card className={data.payments.withoutDueDate > 0 ? 'border-amber-200' : ''}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2">
              <CalendarOff className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fees w/o Due Date</p>
            </div>
            <p
              className={`text-2xl font-bold mt-1 ${
                data.payments.withoutDueDate > 0 ? 'text-amber-600' : ''
              }`}
            >
              {data.payments.withoutDueDate}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              / {data.payments.totalFees} fees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-primary" />
                Recommendations
              </CardTitle>
              <CardDescription>
                Actionable suggestions to improve your data quality
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">
                  {criticalCount} critical
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                  {warningCount} warning{warningCount === 1 ? '' : 's'}
                </Badge>
              )}
              {infoCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  {infoCount} info
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.recommendations.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No recommendations</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your data quality looks great — no action items.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recommendations.map((rec, i) => {
                const cfg = SEVERITY_CONFIG[rec.severity]
                return (
                  <div
                    key={i}
                    className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 flex items-start gap-3`}
                  >
                    <div className="mt-0.5">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] capitalize ${cfg.badge}`}>
                          {rec.severity}
                        </Badge>
                      </div>
                      <p className={`text-sm mt-1 ${cfg.title}`}>{rec.message}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Field quality tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FieldQualityTable
          title="SI Field Quality"
          description="Completeness of each SI record field"
          icon={<Building2 className="h-4 w-4 text-emerald-600" />}
          fields={data.si.fieldQuality}
          duplicates={data.si.duplicates}
        />
        <FieldQualityTable
          title="Spotlight Field Quality"
          description="Completeness of each Spotlight record field"
          icon={<MapPin className="h-4 w-4 text-amber-600" />}
          fields={data.spotlight.fieldQuality}
          duplicates={data.spotlight.duplicates}
        />
      </div>
    </div>
  )
}

function CompletenessCard({
  title,
  icon,
  completeness,
  total,
  live,
  colorClass,
  accentBorder,
}: {
  title: string
  icon: React.ReactNode
  completeness: number
  total: number
  live: number
  colorClass: string
  accentBorder: string
}) {
  const pct = Math.max(0, Math.min(100, completeness))
  const status =
    pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 50 ? 'Needs work' : 'Critical'
  const statusColor =
    pct >= 90
      ? 'text-emerald-600'
      : pct >= 75
        ? 'text-emerald-600'
        : pct >= 50
          ? 'text-amber-600'
          : 'text-red-600'
  return (
    <Card className={accentBorder}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline" className={`text-xs ${statusColor}`}>
            {status}
          </Badge>
        </div>
        <CardDescription>
          {total} total records • {live} live
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-bold tabular-nums">{pct.toFixed(1)}%</span>
          <span className="text-xs text-muted-foreground">overall completeness</span>
        </div>
        <Progress value={pct} className={`h-2.5 [&>div]:${colorClass}`} />
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${colorClass}`} />
            Filled: {(pct / 100 * total).toFixed(0)}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            Missing: {(((100 - pct) / 100) * total).toFixed(0)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function FieldQualityTable({
  title,
  description,
  icon,
  fields,
  duplicates,
}: {
  title: string
  description: string
  icon: React.ReactNode
  fields: FieldQuality[]
  duplicates: DuplicateEntry[]
}) {
  const sorted = [...fields].sort((a, b) => a.completeness - b.completeness)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {icon}
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {duplicates.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
              {duplicates.length} duplicate{duplicates.length === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead className="text-right">Filled</TableHead>
                <TableHead className="text-right">Missing</TableHead>
                <TableHead className="w-[140px]">Completeness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((f) => {
                const pct = Math.max(0, Math.min(100, f.completeness))
                const color =
                  pct >= 90
                    ? 'bg-emerald-500'
                    : pct >= 75
                      ? 'bg-amber-500'
                      : pct >= 50
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                return (
                  <TableRow key={f.field}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{f.label}</span>
                        <code className="text-[10px] text-muted-foreground font-mono">{f.field}</code>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {f.filled}
                      <span className="text-xs text-muted-foreground"> / {f.total}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      <span className={f.missing > 0 ? 'text-red-600' : 'text-muted-foreground'}>
                        {f.missing}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${color} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {duplicates.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Copy className="h-3.5 w-3.5 text-red-600" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                Duplicate groups detected
              </span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {duplicates.slice(0, 10).map((dup, i) => (
                <div key={i} className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {dup.field && (
                      <Badge variant="outline" className="text-[10px]">
                        {dup.field}
                      </Badge>
                    )}
                    {dup.value && (
                      <code className="text-[11px] font-mono bg-background px-1.5 py-0.5 rounded">
                        {String(dup.value)}
                      </code>
                    )}
                    {typeof dup.count === 'number' && (
                      <Badge variant="secondary" className="text-[10px]">
                        {dup.count} records
                      </Badge>
                    )}
                  </div>
                  {dup.codes && dup.codes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dup.codes.slice(0, 8).map((c, j) => (
                        <code
                          key={j}
                          className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded"
                        >
                          {c}
                        </code>
                      ))}
                      {dup.codes.length > 8 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dup.codes.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {duplicates.length > 10 && (
                <p className="text-[11px] text-muted-foreground italic">
                  + {duplicates.length - 10} more duplicate groups...
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DataQualitySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-2.5 w-full mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-5 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-8 w-full mb-2" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
