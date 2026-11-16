'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  Power,
  Receipt,
  Wallet,
  TrendingDown,
  Clock,
  XCircle,
} from 'lucide-react'
import { getReminders } from '@/lib/api'
import type { RemindersData, ReminderAlert } from '@/lib/types'
import { formatMonth, formatCurrency } from '@/lib/validation'

export function RemindersWidget({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<RemindersData | null>(null)
  const [loadedKey, setLoadedKey] = useState<number | null>(null)
  const loading = loadedKey !== refreshKey
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getReminders()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setLoadedKey(refreshKey)
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setLoadedKey(refreshKey)
          setError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Failed to load reminders. Click refresh to retry.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const criticalCount = data.alerts.filter((a) => a.severity === 'critical').length
  const warningCount = data.alerts.filter((a) => a.severity === 'warning').length
  const hasAlerts = data.alerts.length > 0

  return (
    <Card className={hasAlerts && criticalCount > 0 ? 'border-destructive/40' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="relative">
                <Bell className="h-4 w-4" />
                {criticalCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
              </div>
              Reminders &amp; Alerts
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Live campaign status, fees required vs pending, and per-location media spend for{' '}
              <span className="font-medium">{formatMonth(data.month)}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-xs">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-amber-500 text-white text-xs">{warningCount} warning</Badge>
            )}
            {criticalCount === 0 && warningCount === 0 && (
              <Badge className="bg-emerald-600 text-white text-xs">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                All good
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Live campaigns summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusTile
            label="Live SI"
            value={data.liveCampaigns.si.live}
            total={data.liveCampaigns.si.total}
            icon={<Power className="h-4 w-4" />}
            tone="emerald"
          />
          <StatusTile
            label="Live Spotlight"
            value={data.liveCampaigns.spotlight.live}
            total={data.liveCampaigns.spotlight.total}
            icon={<Power className="h-4 w-4" />}
            tone="emerald"
          />
          <StatusTile
            label="Fees Missing"
            value={data.platformFees.missing}
            suffix={`/ ${data.platformFees.required}`}
            icon={<Receipt className="h-4 w-4" />}
            tone={data.platformFees.missing > 0 ? 'destructive' : 'muted'}
          />
          <StatusTile
            label="Media Untracked"
            value={data.mediaSpend.withoutEntry}
            suffix={`/ ${data.mediaSpend.liveLocations}`}
            icon={<Wallet className="h-4 w-4" />}
            tone={data.mediaSpend.withoutEntry > 0 ? 'destructive' : 'muted'}
          />
        </div>

        {/* Fees required vs pending */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Platform Fees
              </span>
              <Badge variant="outline" className="text-[10px]">
                {formatMonth(data.month)}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Billed</p>
                <p className="text-sm font-bold text-primary">
                  {formatCurrency(data.platformFees.totalBilled)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Paid</p>
                <p className="text-sm font-bold text-emerald-600">
                  {formatCurrency(data.platformFees.totalPaid)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Pending</p>
                <p className="text-sm font-bold text-amber-600">
                  {formatCurrency(data.platformFees.totalPending)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {data.platformFees.pendingCount} unpaid
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {data.platformFees.missing} missing
              </span>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Media Spend
              </span>
              <Badge variant="outline" className="text-[10px]">
                per location varies
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Allocated</p>
                <p className="text-sm font-bold text-emerald-600">
                  {formatCurrency(data.mediaSpend.totalAllocated)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Utilized</p>
                <p className="text-sm font-bold text-amber-600">
                  {formatCurrency(data.mediaSpend.totalUtilized)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">In Wallet</p>
                <p className="text-sm font-bold text-violet-600">
                  {formatCurrency(data.mediaSpend.totalPendingWallet)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {data.mediaSpend.withEntry} tracked
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                {data.mediaSpend.deficitCount} over-budget
              </span>
            </div>
          </div>
        </div>

        {/* Alert list */}
        {hasAlerts ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Alerts ({data.alerts.length})
            </p>
            {data.alerts.map((alert, idx) => (
              <AlertCard key={`${alert.category}-${idx}`} alert={alert} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Everything is on track
              </p>
              <p className="text-xs text-muted-foreground">
                No pending fees, no missing media spend, and no budget deficits for{' '}
                {formatMonth(data.month)}.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusTile({
  label,
  value,
  total,
  suffix,
  icon,
  tone,
}: {
  label: string
  value: number
  total?: number
  suffix?: string
  icon: React.ReactNode
  tone: 'emerald' | 'destructive' | 'muted'
}) {
  const toneMap = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    destructive: 'text-destructive bg-destructive/10',
    muted: 'text-muted-foreground bg-muted',
  }
  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className={`rounded p-1 ${toneMap[tone]}`}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold">{value}</span>
        {total !== undefined && (
          <span className="text-xs text-muted-foreground">/ {total}</span>
        )}
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: ReminderAlert }) {
  const [open, setOpen] = useState(false)
  const hasLocations = alert.locations && alert.locations.length > 0

  const config = {
    critical: {
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      border: 'border-destructive/30',
      bg: 'bg-destructive/5',
      titleClass: 'text-destructive',
    },
    warning: {
      icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
      border: 'border-amber-200',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      titleClass: 'text-amber-700 dark:text-amber-400',
    },
    info: {
      icon: <Info className="h-4 w-4 text-primary" />,
      border: 'border-primary/20',
      bg: 'bg-primary/5',
      titleClass: 'text-primary',
    },
  }[alert.severity]

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg border ${config.border} ${config.bg} p-3`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-medium ${config.titleClass}`}>
                {alert.title}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {alert.count !== undefined && (
                  <Badge variant="outline" className="text-[10px]">
                    {alert.count}
                  </Badge>
                )}
                {alert.amount !== undefined && alert.amount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {formatCurrency(alert.amount)}
                  </Badge>
                )}
                {hasLocations && (
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
            {hasLocations && (
              <CollapsibleContent>
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {alert.locations!.map((loc, i) => (
                    <Badge
                      key={`${loc.code}-${i}`}
                      variant="outline"
                      className="text-[10px] gap-1"
                    >
                      <span className="font-mono">{loc.code}</span>
                      <span className="text-muted-foreground">({loc.type})</span>
                      {loc.name && (
                        <span className="text-muted-foreground truncate max-w-[120px]">
                          {loc.name}
                        </span>
                      )}
                    </Badge>
                  ))}
                  {alert.locations!.length >= 20 && (
                    <Badge variant="secondary" className="text-[10px]">
                      + more...
                    </Badge>
                  )}
                </div>
              </CollapsibleContent>
            )}
          </div>
        </div>
      </div>
    </Collapsible>
  )
}
