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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Clock,
  Percent,
  AlertTriangle,
  RefreshCw,
  Wallet,
  FileText,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  IndianRupee,
} from 'lucide-react'
import { formatCurrency, formatMonth, recentMonths } from '@/lib/validation'

interface AgingBucket {
  count: number
  amount: number
}

interface FinancialReportData {
  agingBuckets: {
    current: AgingBucket
    days0to30: AgingBucket
    days31to60: AgingBucket
    days61to90: AgingBucket
    days90plus: AgingBucket
  }
  collectionAnalytics: {
    totalBilled: number
    totalCollected: number
    totalOutstanding: number
    collectionRate: number
    avgDaysToPay: number
    totalFees: number
    paidCount: number
    partialCount: number
    unpaidCount: number
  }
  gstSummary: {
    totalBase: number
    totalGST: number
    collectedBase: number
    collectedGST: number
    pendingGST: number
  }
  monthlyTrends: { month: string; billed: number; collected: number; outstanding: number }[]
  topOutstanding: {
    recordCode: string
    recordType: string
    month: string
    invoiceNumber: string | null
    outstanding: number
    daysOverdue: number
    paymentStatus: string
  }[]
}

const AGING_ROWS: {
  key: keyof FinancialReportData['agingBuckets']
  label: string
  description: string
  badge: string
  rowAccent: string
}[] = [
  {
    key: 'current',
    label: 'Current',
    description: 'Not yet due',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rowAccent: 'border-l-4 border-l-emerald-500',
  },
  {
    key: 'days0to30',
    label: '0–30 days',
    description: 'Recently overdue',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    rowAccent: 'border-l-4 border-l-amber-500',
  },
  {
    key: 'days31to60',
    label: '31–60 days',
    description: 'Moderately overdue',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    rowAccent: 'border-l-4 border-l-orange-500',
  },
  {
    key: 'days61to90',
    label: '61–90 days',
    description: 'Significantly overdue',
    badge: 'bg-red-100 text-red-700 border-red-200',
    rowAccent: 'border-l-4 border-l-red-500',
  },
  {
    key: 'days90plus',
    label: '90+ days',
    description: 'Critical — write-off risk',
    badge: 'bg-red-900 text-white border-red-900',
    rowAccent: 'border-l-4 border-l-red-800',
  },
]

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  unpaid: 'bg-red-100 text-red-700 border-red-200',
}

export function FinancialReportsPage() {
  const months = recentMonths(12)
  const [selectedMonth, setSelectedMonth] = useState(months[0])
  const [data, setData] = useState<FinancialReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)

  const fetchData = useCallback(async (month: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/financial-reports?month=${encodeURIComponent(month)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      const json = (await res.json()) as FinancialReportData
      setData(json)
      setLoadedMonth(month)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load financial report')
      setData(null)
      setLoadedMonth(month)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(selectedMonth)
  }, [selectedMonth, fetchData])

  function handleRefresh() {
    fetchData(selectedMonth)
  }

  const isLoading = loading || loadedMonth !== selectedMonth
  const ca = data?.collectionAnalytics
  const gst = data?.gstSummary
  const trends = data?.monthlyTrends ?? []
  const topOutstanding = data?.topOutstanding ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Financial Reports
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collection analytics, aging buckets, GST summary, and outstanding fees
            overview.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[170px]">
              <CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Failed to load report</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading || !data || !ca || !gst ? (
        <FinancialReportsSkeleton />
      ) : (
        <>
          {/* Collection analytics cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" /> Total Billed
                  </p>
                  <div className="rounded-lg bg-primary/10 p-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2">{formatCurrency(ca.totalBilled)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {ca.paidCount + ca.partialCount + ca.unpaidCount} fee records
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Total Collected
                  </p>
                  <div className="rounded-lg bg-emerald-500/10 p-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2 text-emerald-600">
                  {formatCurrency(ca.totalCollected)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Outstanding: {formatCurrency(ca.totalOutstanding)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Collection Rate
                  </p>
                  <div className="rounded-lg bg-violet-500/10 p-1.5">
                    <Percent className="h-4 w-4 text-violet-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2 text-violet-600">
                  {ca.collectionRate.toFixed(1)}%
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all"
                    style={{ width: `${Math.min(100, ca.collectionRate)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Avg Days to Pay
                  </p>
                  <div className="rounded-lg bg-amber-500/10 p-1.5">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2 text-amber-600">
                  {ca.avgDaysToPay.toFixed(1)}
                  <span className="text-sm text-muted-foreground font-normal ml-1">days</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {ca.paidCount} paid fees
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment status breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-emerald-200/60">
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="rounded-lg bg-emerald-500/10 p-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid</p>
                  <p className="text-2xl font-bold mt-0.5">{ca.paidCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200/60">
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="rounded-lg bg-amber-500/10 p-2.5">
                  <CircleDot className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Partial</p>
                  <p className="text-2xl font-bold mt-0.5">{ca.partialCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200/60">
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="rounded-lg bg-red-500/10 p-2.5">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Unpaid</p>
                  <p className="text-2xl font-bold mt-0.5">{ca.unpaidCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aging report + GST side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Aging Report */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Aging Report
                </CardTitle>
                <CardDescription>
                  Outstanding fees bucketed by days overdue for {formatMonth(selectedMonth)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">% of Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {AGING_ROWS.map((row) => {
                        const bucket = data.agingBuckets[row.key]
                        const pct =
                          ca.totalOutstanding > 0
                            ? (bucket.amount / ca.totalOutstanding) * 100
                            : 0
                        return (
                          <TableRow key={row.key} className={row.rowAccent}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={row.badge}>
                                  {row.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  {row.description}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {bucket.count}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(bucket.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {pct.toFixed(1)}%
                                </span>
                                <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow className="bg-muted/40 font-medium">
                        <TableCell>
                          <span className="text-sm">Total Outstanding</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {AGING_ROWS.reduce((s, r) => s + data.agingBuckets[r.key].count, 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(ca.totalOutstanding)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          100%
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* GST Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="h-4 w-4 text-primary" />
                  GST Summary
                </CardTitle>
                <CardDescription>Tax collected vs pending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <GstRow label="Total Base" value={gst.totalBase} />
                <GstRow label="Total GST" value={gst.totalGST} highlight />
                <div className="my-2 border-t" />
                <GstRow
                  label="Collected Base"
                  value={gst.collectedBase}
                  icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                />
                <GstRow
                  label="Collected GST"
                  value={gst.collectedGST}
                  icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                />
                <div className="my-2 border-t" />
                <GstRow
                  label="Pending GST"
                  value={gst.pendingGST}
                  icon={<TrendingDown className="h-3.5 w-3.5 text-amber-600" />}
                  warning
                />
              </CardContent>
            </Card>
          </div>

          {/* Monthly trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Monthly Trends
              </CardTitle>
              <CardDescription>
                Billed vs Collected vs Outstanding for the last {trends.length} months
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No monthly trend data available.
                </p>
              ) : (
                <>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={trends.map((t) => ({
                          ...t,
                          label: formatMonth(t.month),
                        }))}
                        margin={{ top: 10, right: 20, bottom: 5, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                          }
                          width={70}
                        />
                        <RTooltip
                          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 12 }}
                          iconType="circle"
                        />
                        <Bar dataKey="billed" name="Billed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Billed</TableHead>
                          <TableHead className="text-right">Collected</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-right">Collection Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trends.map((t) => {
                          const rate =
                            t.billed > 0 ? (t.collected / t.billed) * 100 : 0
                          return (
                            <TableRow key={t.month}>
                              <TableCell className="font-medium">
                                {formatMonth(t.month)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(t.billed)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-emerald-600">
                                {formatCurrency(t.collected)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-amber-600">
                                {formatCurrency(t.outstanding)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-xs">
                                  {rate.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top outstanding locations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Top Outstanding Locations
                  </CardTitle>
                  <CardDescription>
                    Highest outstanding fees — sorted by amount overdue
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {topOutstanding.length} record{topOutstanding.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {topOutstanding.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">No outstanding fees</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Everything has been collected for this period.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Days Overdue</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topOutstanding.map((row, idx) => (
                        <TableRow key={`${row.recordCode}-${row.month}-${idx}`}>
                          <TableCell>
                            <code className="text-xs font-mono font-medium">
                              {row.recordCode}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {row.recordType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatMonth(row.month)}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-xs">
                            {row.invoiceNumber ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(row.outstanding)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DaysOverdueBadge days={row.daysOverdue} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                STATUS_BADGE[row.paymentStatus.toLowerCase()] ?? ''
                              }`}
                            >
                              {row.paymentStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function GstRow({
  label,
  value,
  icon,
  highlight,
  warning,
}: {
  label: string
  value: number
  icon?: React.ReactNode
  highlight?: boolean
  warning?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {icon}
        <span
          className={`text-xs ${
            highlight ? 'font-semibold' : 'text-muted-foreground'
          }`}
        >
          {label}
        </span>
      </div>
      <span
        className={`text-sm font-medium tabular-nums ${
          warning ? 'text-amber-600' : highlight ? 'text-primary' : ''
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function DaysOverdueBadge({ days }: { days: number }) {
  let color = 'bg-emerald-100 text-emerald-700 border-emerald-200'
  let label = `${days}d`
  if (days === 0) {
    color = 'bg-emerald-100 text-emerald-700 border-emerald-200'
    label = 'On time'
  } else if (days <= 30) {
    color = 'bg-amber-100 text-amber-700 border-amber-200'
  } else if (days <= 60) {
    color = 'bg-orange-100 text-orange-700 border-orange-200'
  } else if (days <= 90) {
    color = 'bg-red-100 text-red-700 border-red-200'
  } else {
    color = 'bg-red-900 text-white border-red-900'
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] tabular-nums ${color}`}>
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{days} days overdue</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function FinancialReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-5 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-5">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
