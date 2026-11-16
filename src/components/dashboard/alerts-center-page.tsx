'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  RefreshCw,
  Power,
  Receipt,
  Wallet,
  TrendingDown,
  Clock,
  XCircle,
  CalendarClock,
  Shield,
  Filter,
} from 'lucide-react'
import { getReminders } from '@/lib/api'
import type { RemindersData, ReminderAlert } from '@/lib/types'
import { formatMonth, formatCurrency } from '@/lib/validation'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  live_campaign: <Power className="h-4 w-4" />,
  missing_platform_fee: <Receipt className="h-4 w-4" />,
  missing_media_spend: <Wallet className="h-4 w-4" />,
  pending_payment: <Clock className="h-4 w-4" />,
  media_deficit: <TrendingDown className="h-4 w-4" />,
  media_renewal: <CalendarClock className="h-4 w-4" />,
  custom_rule: <Shield className="h-4 w-4" />,
}

export function AlertsCenterPage({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<RemindersData | null>(null)
  const [loadedKey, setLoadedKey] = useState<number | null>(null)
  const loading = loadedKey !== refreshKey
  const [error, setError] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

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
            Failed to load alerts.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const criticalCount = data.alerts.filter((a) => a.severity === 'critical').length
  const warningCount = data.alerts.filter((a) => a.severity === 'warning').length
  const infoCount = data.alerts.filter((a) => a.severity === 'info').length

  const filteredAlerts = severityFilter === 'all'
    ? data.alerts
    : data.alerts.filter((a) => a.severity === severityFilter)

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  const sortedAlerts = [...filteredAlerts].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alerts Center
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All active alerts for{' '}
            <span className="font-medium">{formatMonth(data.month)}</span> — from
            built-in checks and custom rules.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLoadedKey(null)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={criticalCount > 0 ? 'border-destructive/40' : ''}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Critical</p>
                <p className="text-2xl font-bold mt-1 text-destructive">{criticalCount}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={warningCount > 0 ? 'border-amber-300' : ''}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Warnings</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{warningCount}</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Info</p>
                <p className="text-2xl font-bold mt-1 text-primary">{infoCount}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <Info className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Power className="h-3 w-3" /> Live SI
          </p>
          <p className="text-xl font-bold mt-1">
            {data.liveCampaigns.si.live}
            <span className="text-xs text-muted-foreground font-normal">
              {' '}/ {data.liveCampaigns.si.total}
            </span>
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Power className="h-3 w-3" /> Live Spotlight
          </p>
          <p className="text-xl font-bold mt-1">
            {data.liveCampaigns.spotlight.live}
            <span className="text-xs text-muted-foreground font-normal">
              {' '}/ {data.liveCampaigns.spotlight.total}
            </span>
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Receipt className="h-3 w-3" /> Fees Pending
          </p>
          <p className="text-xl font-bold mt-1 text-amber-600">
            {formatCurrency(data.platformFees.totalPending)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Wallet Balance
          </p>
          <p className="text-xl font-bold mt-1 text-violet-600">
            {formatCurrency(data.mediaSpend.totalPendingWallet)}
          </p>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
          <Button
            key={sev}
            variant={severityFilter === sev ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSeverityFilter(sev)}
          >
            {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
          </Button>
        ))}
      </div>

      {/* Alert list */}
      {sortedAlerts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {sortedAlerts.length} Alert{sortedAlerts.length > 1 ? 's' : ''}
          </p>
          {sortedAlerts.map((alert, idx) => (
            <AlertCard key={`${alert.category}-${idx}`} alert={alert} />
          ))}
        </div>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Everything is on track
              </p>
              <p className="text-xs text-muted-foreground">
                No active alerts for {formatMonth(data.month)}. All rules and
                built-in checks passed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
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

  const categoryIcon = CATEGORY_ICONS[alert.category] ?? <Bell className="h-4 w-4" />

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg border ${config.border} ${config.bg} p-3`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-medium ${config.titleClass} flex items-center gap-1.5`}>
                {categoryIcon}
                {alert.title}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {alert.category === 'custom_rule' && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Shield className="h-2.5 w-2.5" /> Rule
                  </Badge>
                )}
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
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
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
