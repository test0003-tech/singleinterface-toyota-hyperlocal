'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  MapPin,
  CircleDot,
  Globe,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Wallet,
  Receipt,
  Power,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getStats } from '@/lib/api'
import type { DashboardStats } from '@/lib/types'
import { formatCurrency } from '@/lib/validation'

const SI_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899']
const SPOT_COLORS = ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#0ea5e9', '#06b6d4', '#14b8a6']

export function Overview({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadedKey, setLoadedKey] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const loading = loadedKey !== refreshKey

  useEffect(() => {
    let cancelled = false
    getStats()
      .then((s) => {
        if (!cancelled) {
          setStats(s)
          setLoadedKey(refreshKey)
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null)
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
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Failed to load stats. Try refreshing.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const siTopStates = stats.si.byState.slice(0, 8)
  const spotTopStates = stats.spotlight.byState.slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="SI Records"
          value={stats.si.total}
          icon={<Building2 className="h-5 w-5" />}
          accent="emerald"
          subtitle={`${stats.si.live} live • ${stats.si.byState.length} states`}
          liveCount={stats.si.live}
          liveLabel="live"
        />
        <StatCard
          title="Spotlight Records"
          value={stats.spotlight.total}
          icon={<MapPin className="h-5 w-5" />}
          accent="amber"
          subtitle={`${stats.spotlight.live} live • ${stats.spotlight.byState.length} states`}
          liveCount={stats.spotlight.live}
          liveLabel="live"
        />
        <StatCard
          title="SI Circles"
          value={stats.si.byCircle.length}
          icon={<CircleDot className="h-5 w-5" />}
          accent="cyan"
          subtitle={stats.si.byCircle.map((c) => c.circle).join(', ') || '—'}
        />
        <StatCard
          title="Spotlight Regions"
          value={stats.spotlight.byRegion.length}
          icon={<Globe className="h-5 w-5" />}
          accent="violet"
          subtitle={stats.spotlight.byRegion.map((r) => r.region).join(', ') || '—'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-emerald-600" />
              SI Records by State
            </CardTitle>
            <CardDescription>Top 8 states by SI record count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siTopStates} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {siTopStates.map((_, i) => (
                      <Cell key={i} fill={SI_COLORS[i % SI_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-amber-600" />
              Spotlight Records by State
            </CardTitle>
            <CardDescription>Top 8 states by Spotlight record count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spotTopStates} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {spotTopStates.map((_, i) => (
                      <Cell key={i} fill={SPOT_COLORS[i % SPOT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="h-4 w-4 text-cyan-600" />
              SI by Circle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.si.byCircle.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              stats.si.byCircle.map((c) => (
                <div key={c.circle} className="flex items-center justify-between">
                  <span className="text-sm">{c.circle}</span>
                  <Badge variant="secondary">{c.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              SI GMB Listing Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.si.byGmbStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              stats.si.byGmbStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{s.status}</span>
                  <Badge variant={s.status === 'verified' ? 'default' : 'outline'}>
                    {s.count}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-violet-600" />
              Spotlight by Region
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.spotlight.byRegion.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              stats.spotlight.byRegion.map((r) => (
                <div key={r.region} className="flex items-center justify-between">
                  <span className="text-sm">{r.region}</span>
                  <Badge variant="secondary">{r.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Finance summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Media Spend Summary
            </CardTitle>
            <CardDescription>
              Allocated vs utilized vs pending in wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-500/5 p-3">
                <p className="text-xs text-muted-foreground">Allocated</p>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">
                  {formatCurrency(stats.mediaSpend.totalAllocated)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-500/5 p-3">
                <p className="text-xs text-muted-foreground">Utilized</p>
                <p className="text-lg font-bold text-amber-600 mt-0.5">
                  {formatCurrency(stats.mediaSpend.totalUtilized)}
                </p>
              </div>
              <div className="rounded-lg bg-violet-500/5 p-3">
                <p className="text-xs text-muted-foreground">Pending Wallet</p>
                <p className="text-lg font-bold text-violet-600 mt-0.5">
                  {formatCurrency(stats.mediaSpend.totalPending)}
                </p>
              </div>
            </div>
            {stats.mediaSpend.byMonth.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recent months
                </p>
                {stats.mediaSpend.byMonth.slice(0, 3).map((m) => (
                  <div key={m.month} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{m.month}</span>
                    <span>
                      <span className="text-emerald-600">{formatCurrency(m.allocated)}</span>
                      {' / '}
                      <span className="text-amber-600">{formatCurrency(m.utilized)}</span>
                      {' / '}
                      <span className="text-violet-600">{formatCurrency(m.pending)}</span>
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground pt-1">
                  Format: allocated / utilized / pending
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" />
              Platform Fees Summary
            </CardTitle>
            <CardDescription>
              Monthly fees @ ₹8,060 + 18% GST = ₹9,510.80 per live location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Total Billed</p>
                <p className="text-lg font-bold text-primary mt-0.5">
                  {formatCurrency(stats.platformFees.totalBilled)}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-500/5 p-3">
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">
                  {formatCurrency(stats.platformFees.totalPaid)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-500/5 p-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-amber-600 mt-0.5">
                  {formatCurrency(stats.platformFees.totalPending)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span>{stats.platformFees.paidCount} paid</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>{stats.platformFees.pendingCount} pending</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick insight */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Data Summary</p>
              <p className="text-sm text-muted-foreground">
                You are managing{' '}
                <span className="font-semibold text-foreground">
                  {stats.si.total} SI records
                </span>{' '}
                across {stats.si.byState.length} states and{' '}
                <span className="font-semibold text-foreground">
                  {stats.spotlight.total} Spotlight records
                </span>{' '}
                across {stats.spotlight.byState.length} states.
                {stats.si.byGmbStatus.find((s) => s.status !== 'verified') && (
                  <>
                    {' '}
                    <AlertCircle className="inline h-3.5 w-3.5 text-amber-500" />{' '}
                    Some SI records have non-verified GMB listing status.
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
  accent,
  liveCount,
  liveLabel,
}: {
  title: string
  value: number
  icon: React.ReactNode
  subtitle?: string
  accent: 'emerald' | 'amber' | 'cyan' | 'violet'
  liveCount?: number
  liveLabel?: string
}) {
  const accentMap = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    cyan: 'bg-cyan-500/10 text-cyan-600',
    violet: 'bg-violet-500/10 text-violet-600',
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-lg p-2 ${accentMap[accent]}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold tracking-tight">{value.toLocaleString()}</div>
          {liveCount !== undefined && liveCount > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Power className="h-3 w-3" />
              {liveCount} {liveLabel}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 truncate" title={subtitle}>
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
